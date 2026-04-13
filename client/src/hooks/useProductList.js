import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useLocation } from '../context/LocationContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useProductList = ({ category, subCategory, limit = 10 }) => {
    const { location, userPincode } = useLocation();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const abortControllerRef = useRef(null);

    useEffect(() => {
        setProducts([]);
        setPage(1);
        setHasMore(true);
    }, [category, subCategory]);

    useEffect(() => {
        // Allow fetching all products without category/subCategory filter

        const fetchProducts = async () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            const controller = new AbortController();
            abortControllerRef.current = controller;

            setLoading(true);
            setError(null);

            try {
                const response = await axios.get(`${API_URL}/products`, {
                    params: {
                        category,
                        subCategory,
                        page: 1,
                        limit,
                        lat: location?.lat,
                        lng: location?.lng,
                        pincode: userPincode
                    },
                    signal: controller.signal
                });

                setProducts(response.data.data || []);
                setHasMore((response.data.meta?.page || 1) < (response.data.meta?.totalPages || 1));
            } catch (err) {
                if (axios.isCancel(err)) return;
                console.error("Failed to fetch products", err);
                setError(err.message);
            } finally {
                if (abortControllerRef.current === controller) {
                    setLoading(false);
                }
            }
        };

        fetchProducts();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [category, subCategory, limit, location, userPincode]);

    const loadMore = async () => {
        if (!hasMore || loading) return;

        setLoading(true);
        try {
            const nextPage = page + 1;
            const response = await axios.get(`${API_URL}/products`, {
                params: {
                    category,
                    subCategory,
                    page: nextPage,
                    limit,
                    lat: location?.lat,
                    lng: location?.lng,
                    pincode: userPincode
                }
            });

            setProducts(prev => [...prev, ...(response.data.data || [])]);
            setPage(nextPage);
            setHasMore((response.data.meta?.page || 1) < (response.data.meta?.totalPages || 1));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return { products, loading, error, hasMore, loadMore };
};
