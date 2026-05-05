import { RippleButton } from '../ui/ripple-button';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { setUserId, logEvent } from '../../lib/analytics';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const DeliveryLogin = () => {
    const navigate = useNavigate();
    const [phone, setPhone] = useState('+91');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
            const res = await axios.post(`${API_URL}/delivery/auth/login`, {
                phone: formattedPhone,
                pin,
            });
            localStorage.setItem('delivery_token', res.data.access_token);
            localStorage.setItem('delivery_person', JSON.stringify(res.data.person));
            
            // Analytics
            await setUserId(res.data.person.id);
            await logEvent('login', { method: 'pin' });
            
            navigate('/delivery/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-[100dvh] w-full flex flex-col overflow-hidden overscroll-none bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Delivery Partner</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sign in to start delivering</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none p-6 space-y-5 border border-transparent dark:border-slate-700">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Phone Number</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">+91</span>
                            <input
                                type="tel"
                                value={phone.replace('+91', '')}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                    setPhone('+91' + val);
                                }}
                                placeholder="9876543210"
                                maxLength={10}
                                required
                                className="w-full pl-12 pr-4 py-3 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium tracking-wider"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">4-Digit PIN</label>
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value.slice(0, 4))}
                            placeholder="••••"
                            maxLength={4}
                            required
                            className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 rounded-xl text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm rounded-xl px-4 py-3">
                            {error}
                        </div>
                    )}

                    <RippleButton
                        type="submit"
                        disabled={loading || pin.length !== 4}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Signing in...
                            </span>
                        ) : (
                            'Sign In'
                        )}
                    </RippleButton>
                </form>
            </div>
        </div>
    );
};

export default DeliveryLogin;
