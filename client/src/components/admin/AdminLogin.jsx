import { useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AdminLogin = () => {
    const [phone, setPhone] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const { login } = useAdminAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Basic validation
        if (!phone || !pin) {
            setError('Please enter phone and PIN');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/auth/store-admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, pin })
            });

            const data = await res.json();

            if (res.ok) {
                login(data.user, data.access_token);
            } else {
                setError(data.message || 'Login failed');
            }
        } catch (err) {
            console.error(err);
            setError('Network error. Please try again.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center text-ud-primary">Store Admin Login</h2>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 mb-2 font-medium">Phone Number</label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-ud-primary"
                            placeholder="+919999999999"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 mb-2 font-medium">PIN</label>
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:border-ud-primary"
                            placeholder="4-digit PIN"
                            required
                            maxLength={4}
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full bg-ud-primary text-white p-2 rounded hover:brightness-110 transition-colors font-bold"
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminLogin;
