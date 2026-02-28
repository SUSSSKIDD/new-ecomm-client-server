import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
    const { token, isAuthenticated } = useAuth();

    const [cart, setCart] = useState(() => {
        try {
            const saved = localStorage.getItem('cart');
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [buyNowMode, setBuyNowMode] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const toastTimerRef = useRef(null);

    const clientApi = useCallback(() => api(token), [token]);

    // Persist cart to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('cart', JSON.stringify(cart));
    }, [cart]);

    // Clean up toast timer on unmount
    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    const showToast = (msg) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMessage(msg);
        toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000);
    };

    // Load server cart on login / token change
    useEffect(() => {
        if (!isAuthenticated || !token) return;
        clientApi().get('/cart')
            .then(async (res) => {
                const serverItems = (res.data?.items || []).map((item) => ({
                    id: item.productId,
                    name: item.name,
                    price: item.price,
                    image: item.image,
                    quantity: item.quantity,
                    category: item.category || null,
                }));

                let currentLocalCart = [];
                try {
                    const saved = localStorage.getItem('cart');
                    if (saved) currentLocalCart = JSON.parse(saved);
                } catch { }

                // Sync local cart to server if server is empty
                if (serverItems.length === 0 && currentLocalCart.length > 0) {
                    for (const item of currentLocalCart) {
                        try {
                            await clientApi().post('/cart/items', { productId: item.id, quantity: item.quantity });
                        } catch (err) {
                            console.error('Failed to sync item', item.id, err);
                        }
                    }
                } else if (serverItems.length > 0) {
                    // Server has items, overwrite local
                    setCart(serverItems);
                }
            })
            .catch(() => { /* ignore — cart will sync on next add */ });
    }, [isAuthenticated, token, clientApi]);

    const addToCart = (product, category) => {
        const itemCategory = category || product.category;

        setCart((prevCart) => {
            if (prevCart.length > 0 && itemCategory) {
                const existingCategory = prevCart[0].category;
                if (existingCategory && existingCategory !== itemCategory) {
                    showToast(`Cannot mix ${existingCategory} with ${itemCategory}! Clear cart first.`);
                    return prevCart;
                }
            }

            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                const newQty = existingItem.quantity + 1;
                showToast(`${product.name} Quantity Updated!`);
                if (token) {
                    clientApi().patch(`/cart/items/${product.id}`, { quantity: newQty }).catch(() => { });
                }
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: newQty } : item
                );
            }

            showToast(`${product.name} Added!`);
            if (token) {
                clientApi().post('/cart/items', { productId: product.id, quantity: 1 }).catch(() => { });
            }
            return [...prevCart, { ...product, quantity: 1, category: itemCategory }];
        });
    };

    const updateQuantity = (productId, delta) => {
        setCart(prevCart => prevCart.map(item => {
            if (item.id === productId) {
                const newQuantity = Math.max(1, item.quantity + delta);
                if (token) {
                    clientApi().patch(`/cart/items/${productId}`, { quantity: newQuantity }).catch(() => { });
                }
                return { ...item, quantity: newQuantity };
            }
            return item;
        }));
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
        showToast("Item Removed");
        if (token) {
            clientApi().delete(`/cart/items/${productId}`).catch(() => { });
        }
    };

    const clearCart = () => {
        setCart([]);
        if (token) {
            clientApi().delete('/cart').catch(() => { });
        }
    };

    return (
        <CartContext.Provider value={{
            cart, addToCart, updateQuantity, removeFromCart, clearCart,
            isCartOpen, setIsCartOpen,
            buyNowMode, setBuyNowMode,
            toastMessage,
        }}>
            {children}
        </CartContext.Provider>
    );
};

CartProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useCart = () => useContext(CartContext);
