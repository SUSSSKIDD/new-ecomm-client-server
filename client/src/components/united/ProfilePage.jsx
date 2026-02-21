import { useState } from 'react';
import { useCategory } from '../../context/CategoryContext';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import AddressManager from './profile/AddressManager';
import OrderList from './profile/OrderList';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ProfileSideBar = () => {
    const { activePage, setActivePage } = useCategory();
    const { user, isAuthenticated, token, logout, openLoginModal, updateUser } = useAuth();
    const [view, setView] = useState('main'); // 'main', 'addresses', 'orders', 'support'
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [nameSaving, setNameSaving] = useState(false);
    const [nameError, setNameError] = useState('');

    const canEditName = !user?.name;

    const handleSaveName = async () => {
        const trimmed = nameInput.trim();
        if (trimmed.length < 2) {
            setNameError('Name must be at least 2 characters');
            return;
        }
        setNameSaving(true);
        setNameError('');
        try {
            const res = await axios.patch(
                `${API_URL}/users/me/name`,
                { name: trimmed },
                { headers: { Authorization: `Bearer ${token}` } },
            );
            updateUser({ name: res.data.name });
            setIsEditingName(false);
        } catch (err) {
            setNameError(err.response?.data?.message || 'Failed to update name');
        } finally {
            setNameSaving(false);
        }
    };

    if (activePage !== 'profile') return null;

    const handleClose = () => {
        setActivePage('home');
        setView('main');
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={handleClose}
            ></div>

            {/* Sidebar */}
            <div className="absolute inset-y-0 right-0 w-full md:max-w-xs bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0 h-full">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white">
                    <h2 className="text-lg font-bold text-gray-900">
                        {isAuthenticated ? 'My Profile' : 'Welcome'}
                    </h2>
                    <button
                        onClick={handleClose}
                        className="p-2 -mr-2 text-gray-400 hover:text-gray-500"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col h-full">
                    {!isAuthenticated ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-4xl">👋</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">Welcome to NEYOKART</h3>
                                <p className="text-gray-500 text-sm max-w-[200px] mx-auto">
                                    Log in to view your profile, track orders, and save addresses.
                                </p>
                            </div>
                            <button
                                onClick={openLoginModal}
                                className="w-full max-w-xs py-3 bg-ud-primary text-white font-bold rounded-xl hover:bg-emerald-600 active:scale-95 transition-all shadow-lg shadow-ud-primary/20"
                            >
                                Login or Sign Up
                            </button>
                        </div>
                    ) : (
                        view === 'main' ? (
                            <div className="space-y-6">
                                {/* User Info Card */}
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 rounded-full bg-ud-primary/10 flex items-center justify-center text-ud-primary font-bold text-lg">
                                            {user?.name ? user.name.charAt(0).toUpperCase() : (user?.phone ? user.phone.charAt(3) : 'U')}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            {!isEditingName ? (
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm font-bold text-gray-900 truncate">
                                                        {user?.name || 'User'}
                                                    </h3>
                                                    {canEditName && (
                                                        <button
                                                            onClick={() => { setIsEditingName(true); setNameInput(''); setNameError(''); }}
                                                            className="text-xs text-ud-primary font-medium hover:underline"
                                                        >
                                                            Set name
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={nameInput}
                                                        onChange={(e) => setNameInput(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                                        placeholder="Enter your name"
                                                        autoFocus
                                                        className="text-sm border border-gray-200 rounded-lg px-2 py-1 flex-1 min-w-0 focus:outline-none focus:border-ud-primary"
                                                        maxLength={50}
                                                    />
                                                    <button
                                                        onClick={handleSaveName}
                                                        disabled={nameSaving}
                                                        className="text-xs bg-ud-primary text-white px-3 py-1 rounded-lg font-medium disabled:opacity-50"
                                                    >
                                                        {nameSaving ? '...' : 'Save'}
                                                    </button>
                                                    <button
                                                        onClick={() => setIsEditingName(false)}
                                                        className="text-xs text-gray-400 hover:text-gray-600"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-500">{user?.phone}</p>
                                        </div>
                                    </div>
                                    {nameError && (
                                        <p className="text-xs text-red-500 mt-2 pl-16">{nameError}</p>
                                    )}
                                </div>

                                {/* Info Sections */}
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                    {/* My Orders */}
                                    <div
                                        className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group"
                                        onClick={() => setView('orders')}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-sm font-bold text-gray-900">My Orders</h3>
                                                <p className="text-xs text-gray-500">View current and past orders</p>
                                            </div>
                                            <svg className="w-5 h-5 text-gray-300 group-hover:text-ud-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </div>

                                    {/* My Address */}
                                    <div
                                        className="p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer group"
                                        onClick={() => setView('addresses')}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-sm font-bold text-gray-900">Saved Addresses</h3>
                                                <p className="text-xs text-gray-500">Manage your delivery locations</p>
                                            </div>
                                            <svg className="w-5 h-5 text-gray-300 group-hover:text-ud-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </div>

                                    {/* Support */}
                                    <div className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-sm font-bold text-gray-900">Support & Help</h3>
                                                <p className="text-xs text-gray-500">Contact us for any queries</p>
                                            </div>
                                            <svg className="w-5 h-5 text-gray-300 group-hover:text-ud-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        logout();
                                        handleClose();
                                    }}
                                    className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors mt-auto shadow-sm border border-red-100"
                                >
                                    Log Out
                                </button>
                            </div>
                        ) : view === 'addresses' ? (
                            <AddressManager onBack={() => setView('main')} />
                        ) : view === 'orders' ? (
                            <OrderList onBack={() => setView('main')} />
                        ) : null
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProfileSideBar;
