import { createContext, useContext, useState, useRef } from 'react';
import PropTypes from 'prop-types';

const CategoryContext = createContext();

export const CategoryProvider = ({ children }) => {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [activeSubCategory, setActiveSubCategory] = useState(null);
    const [cart, setCart] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState(null);
    const [activePage, setActivePage] = useState('home'); // 'home', 'profile'
    const toastTimerRef = useRef(null);

    const showToast = (msg) => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastMessage(msg);
        toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000);
    };

    const addToCart = (product, category) => {
        // Use provided category or fallback to product's attached category
        const itemCategory = category || product.category;

        setCart((prevCart) => {
            // Category Silo: Check if cart has items from a different category
            if (prevCart.length > 0 && itemCategory) {
                const existingCategory = prevCart[0].category;
                if (existingCategory && existingCategory !== itemCategory) {
                    showToast(`Cannot mix ${existingCategory} with ${itemCategory}! Clear cart first.`);
                    return prevCart;
                }
            }

            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                showToast(`${product.name} Quantity Updated!`);
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            showToast(`${product.name} Added!`);
            // Store the category with the item
            return [...prevCart, { ...product, quantity: 1, category: itemCategory }];
        });
    };

    const updateQuantity = (productId, delta) => {
        setCart(prevCart => prevCart.map(item => {
            if (item.id === productId) {
                const newQuantity = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQuantity };
            }
            return item;
        }));
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
        showToast("Item Removed");
    };

    const clearCart = () => {
        setCart([]);
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
