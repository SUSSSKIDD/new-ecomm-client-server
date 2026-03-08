import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import LoginModal from '../components/auth/LoginModal';

const AuthContext = createContext();

// Production URL based on .env logic or default to local
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
    const logoutRef = useRef(null);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('selectedAddress');
        localStorage.removeItem('cart');
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
    }, []);

    // Keep ref in sync so interceptor always calls latest logout
    logoutRef.current = logout;

    // Global 401 interceptor — triggers logout on expired/invalid JWT
    useEffect(() => {
        const interceptorId = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    logoutRef.current();
                }
                return Promise.reject(error);
            },
        );
        return () => axios.interceptors.response.eject(interceptorId);
    }, []);

    useEffect(() => {
        // Check for token on mount
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                setIsAuthenticated(true);
            } catch {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        setLoading(false);
    }, []);

    const sendOtp = async (phone) => {
        try {
            await axios.post(`${API_URL}/auth/send-otp`, { phone });
            return { success: true };
        } catch (error) {
            console.error(error);
            return { success: false, message: error.response?.data?.message || 'Failed to send OTP' };
        }
    };

    const verifyOtp = async (phone, otp) => {
        try {
            const response = await axios.post(`${API_URL}/auth/verify-otp`, { phone, otp });
            const { access_token, user: userData } = response.data;

            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(userData));

            setToken(access_token);
            setUser(userData);
            setIsAuthenticated(true);
            return { success: true, user: userData };
        } catch (error) {
            console.error(error);
            return { success: false, message: error.response?.data?.message || 'Invalid OTP' };
        }
    };

    const updateUser = (updatedFields) => {
        const updated = { ...user, ...updatedFields };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            loading,
            token,
            sendOtp,
            verifyOtp,
            updateUser,
            logout,
            openLoginModal: () => setIsLoginModalOpen(true)
        }}>
            {children}
            <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
        </AuthContext.Provider>
    );
};

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useAuth = () => useContext(AuthContext);
