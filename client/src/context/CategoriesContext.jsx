import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API_URL } from '../lib/api';

const CategoriesContext = createContext();

export const CategoriesProvider = ({ children }) => {
    const [bannerImages, setBannerImages] = useState({});
    const [subcategories, setSubcategories] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchCategories = useCallback(async () => {
        try {
            const response = await fetch(`${API_URL}/stores/categories`);
            if (!response.ok) throw new Error('Failed to fetch categories');
            const data = await response.json();
            
            if (data?.bannerImages) setBannerImages(data.bannerImages);
            if (data?.subcategories) setSubcategories(data.subcategories);
        } catch (err) {
            console.error('Failed to fetch categories:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    return (
        <CategoriesContext.Provider value={{
            bannerImages,
            subcategories,
            loading,
            error,
            refetch: fetchCategories,
        }}>
            {children}
        </CategoriesContext.Provider>
    );
};

export const useCategories = () => {
    const context = useContext(CategoriesContext);
    if (!context) {
        throw new Error('useCategories must be used within a CategoriesProvider');
    }
    return context;
};

export default CategoriesContext;