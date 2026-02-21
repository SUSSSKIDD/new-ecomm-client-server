import { useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useAddresses = () => {
    const { token } = useAuth();
    const [addresses, setAddresses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchAddresses = useCallback(async () => {
        if (!token) return;

        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${API_URL}/users/addresses?t=${new Date().getTime()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAddresses(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error("Failed to fetch addresses", err);
            setError(err.response?.data?.message || 'Failed to fetch addresses');
            setAddresses([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    const addAddress = async (addressData) => {
        if (!token) return { success: false, error: 'Not authenticated' };

        setLoading(true);
        setError(null);
        try {
            await axios.post(`${API_URL}/users/addresses`, addressData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchAddresses(); // Refresh list after adding
            return { success: true };
        } catch (err) {
            console.error("Failed to save address", err);
            setError(err.response?.data?.message || 'Failed to save address');
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const updateAddress = async (id, addressData) => {
        if (!token) return { success: false, error: 'Not authenticated' };

        setLoading(true);
        setError(null);
        try {
            // Remove fields that should not be sent to the backend
            const { id: _id, userId, createdAt, user, ...dataToSend } = addressData;

            await axios.patch(`${API_URL}/users/addresses/${id}`, dataToSend, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchAddresses();
            return { success: true };
        } catch (err) {
            console.error("Failed to update address", err);
            setError(err.response?.data?.message || 'Failed to update address');
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    const deleteAddress = async (id) => {
        if (!token) return { success: false, error: 'Not authenticated' };

        setLoading(true);
        setError(null);
        try {
            await axios.delete(`${API_URL}/users/addresses/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchAddresses();
            return { success: true };
        } catch (err) {
            console.error("Failed to delete address", err);
            setError(err.response?.data?.message || 'Failed to delete address');
            return { success: false, error: err.message };
        } finally {
            setLoading(false);
        }
    };

    return {
        addresses,
        loading,
        error,
        fetchAddresses,
        addAddress,
        updateAddress,
        deleteAddress
    };
};
