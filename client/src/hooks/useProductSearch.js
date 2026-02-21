import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useDebounce } from './useDebounce';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useProductSearch = (initialQuery = '') => {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Use a ref to store the latest AbortController
    const abortControllerRef = useRef(null);

    const debouncedQuery = useDebounce(query, 300); // 300ms debounce

    useEffect(() => {
        // Cancel previous request if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        if (!debouncedQuery || debouncedQuery.trim().length < 2) {
            setResults([]);
            setPage(1);
            setHasMore(true);
            setLoading(false);
            return;
        }

        const fetchResults = async () => {
            setLoading(true);
            setError(null);

            const controller = new AbortController();
            abortControllerRef.current = controller;

            try {
                const response = await axios.get(`${API_URL}/products`, {
                    params: {
                        search: debouncedQuery,
                        page: 1, // Reset to page 1 for new search
                        limit: 5 // Limit suggestions
                    },
                    signal: controller.signal
                });

                setResults(response.data.data || []);
                setHasMore((response.data.meta?.page || 1) < (response.data.meta?.totalPages || 1));
            } catch (err) {
                if (axios.isCancel(err)) return;
                console.error("Search error:", err);
                setError(err.message);
                setResults([]);
            } finally {
                if (abortControllerRef.current === controller) {
                    setLoading(false);
                }
            }
        };

        fetchResults();

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [debouncedQuery]);

    const loadMore = async () => {
        if (!hasMore || loading) return;

        setLoading(true);
        try {
            const nextPage = page + 1;
            const response = await axios.get(`${API_URL}/products`, {
                params: {
                    search: debouncedQuery,
                    page: nextPage,
                    limit: 5
                }
            });

            setResults(prev => [...prev, ...(response.data.data || [])]);
            setPage(nextPage);
            setHasMore((response.data.meta?.page || 1) < (response.data.meta?.totalPages || 1));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        query,
        setQuery,
        results,
        loading,
        error,
        hasMore,
        loadMore
    };
};
