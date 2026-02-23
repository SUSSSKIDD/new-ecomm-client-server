import { createContext, useContext, useState } from 'react';
import PropTypes from 'prop-types';
import { useCart } from './CartContext';

const CategoryContext = createContext();

export const CategoryProvider = ({ children }) => {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [activeSubCategory, setActiveSubCategory] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [activePage, setActivePage] = useState('home');

    return (
        <CategoryContext.Provider value={{
            selectedCategory, setSelectedCategory,
            activeSubCategory, setActiveSubCategory,
            selectedProduct, setSelectedProduct,
            activePage, setActivePage,
        }}>
            {children}
        </CategoryContext.Provider>
    );
};

CategoryProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

/**
 * useCategory — backward-compatible hook that merges UI context + cart context.
 * Existing consumers keep working without changes.
 * New code should prefer useCart() for cart-only access (avoids re-renders on UI changes).
 */
export const useCategory = () => {
    const ui = useContext(CategoryContext);
    const cart = useCart();
    return { ...ui, ...cart };
};
