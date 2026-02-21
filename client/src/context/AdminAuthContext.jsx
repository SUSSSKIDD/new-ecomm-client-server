/* eslint-disable react/prop-types */
import { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('ud_admin_token');
        const user = localStorage.getItem('ud_admin_user');

        if (token && user) {
            try {
                setAdmin(JSON.parse(user));
            } catch {
                localStorage.removeItem('ud_admin_token');
                localStorage.removeItem('ud_admin_user');
            }
        }
        setLoading(false);
    }, []);

    const login = (userData, token) => {
        localStorage.setItem('ud_admin_token', token);
        localStorage.setItem('ud_admin_user', JSON.stringify(userData));
        setAdmin(userData);
        navigate('/admin/dashboard');
    };

    const logout = () => {
        localStorage.removeItem('ud_admin_token');
        localStorage.removeItem('ud_admin_user');
        setAdmin(null);
        navigate('/admin/login');
    };

    return (
        <AdminAuthContext.Provider value={{ admin, login, logout, loading }}>
            {children}
        </AdminAuthContext.Provider>
    );
};
