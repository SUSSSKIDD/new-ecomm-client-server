import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const CategoryContext = createContext();

export const CategoryProvider = ({ children }) => {
    const { token, isAuthenticated } = useAuth();

    const [selectedCategory, setSelectedCategory] = useState('All');
    const [activeSubCategory, setActiveSubCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const [activePage, setActivePage] = useState('home');
    const toastTimerRef = useRef(null);

    const apiHeaders = useCallback(() => ({
        Authorization: `Bearer ${token}`,
    }), [token]);

    const showToast = (msg) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMessage(msg);
        toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000);
    };

    // Load server cart on login / token change
    useEffect(() => {
        if (!isAuthenticated || !token) return;
        axios.get(`${API_URL}/cart`, { headers: { Authorization: `Bearer ${token}` } })
            .then((res) => {
                const serverItems = (res.data?.items || []).map((item) => ({
                    id: item.productId,
                    name: item.name,
                    price: item.price,
                    image: item.image,
                    quantity: item.quantity,
                    category: item.category || null,
                }));
                if (serverItems.length > 0) {
                    setCart(serverItems);
                }
            })
            .catch(() => { /* ignore — cart will sync on next add */ });
    }, [isAuthenticated, token]);

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

                // Sync to server
                if (token) {
                    axios.patch(`${API_URL}/cart/items/${product.id}`, { quantity: newQty }, { headers: apiHeaders() }).catch(() => {});
                }

                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: newQty } : item
                );
            }

            showToast(`${product.name} Added!`);

            // Sync to server
            if (token) {
                axios.post(`${API_URL}/cart/items`, { productId: product.id, quantity: 1 }, { headers: apiHeaders() }).catch(() => {});
            }

            return [...prevCart, { ...product, quantity: 1, category: itemCategory }];
        });
    };

    const updateQuantity = (productId, delta) => {
        setCart(prevCart => prevCart.map(item => {
            if (item.id === productId) {
                const newQuantity = Math.max(1, item.quantity + delta);

                // Sync to server
                if (token) {
                    axios.patch(`${API_URL}/cart/items/${productId}`, { quantity: newQuantity }, { headers: apiHeaders() }).catch(() => {});
                }

                return { ...item, quantity: newQuantity };
            }
            return item;
        }));
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
        showToast("Item Removed");

        // Sync to server
        if (token) {
            axios.delete(`${API_URL}/cart/items/${productId}`, { headers: apiHeaders() }).catch(() => {});
        }
    };

    const clearCart = () => {
        setCart([]);

        // Sync to server
        if (token) {
            axios.delete(`${API_URL}/cart`, { headers: apiHeaders() }).catch(() => {});
        }
    };

    return (
        <CategoryContext.Provider value={{
            selectedCategory, setSelectedCategory,
            activeSubCategory, setActiveSubCategory,
            selectedProduct, setSelectedProduct,
            cart, addToCart, updateQuantity, removeFromCart, clearCart,
            isCartOpen, setIsCartOpen,
            toastMessage,
            activePage, setActivePage
        }}>
            {children}
        </CategoryContext.Provider>
    );
};

CategoryProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useCategory = () => useContext(CategoryContext);
