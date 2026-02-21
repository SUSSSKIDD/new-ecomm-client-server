import { RippleButton } from '../ui/ripple-button';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DeliveryOrderCard from './DeliveryOrderCard';
import DeliveryStatusToggle from './DeliveryStatusToggle';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const DeliveryDashboard = () => {
    const navigate = useNavigate();
    const [person, setPerson] = useState(null);
    const [orders, setOrders] = useState([]);
    const [status, setStatus] = useState('FREE');
    const [gpsActive, setGpsActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const [statusLoading, setStatusLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const watchIdRef = useRef(null);
    const sseAbortRef = useRef(null);

    const [token] = useState(() => localStorage.getItem('delivery_token'));

    const api = useCallback(
        (method, path, data) =>
            axios({
                method,
                url: `${API_URL}${path}`,
                data,
                headers: { Authorization: `Bearer ${token}` },
            }),
        [token],
    );

    // Redirect if not logged in
    useEffect(() => {
        if (!token) {
            navigate('/delivery/login');
            return;
        }

        const init = async () => {
            try {
                const [profileRes, ordersRes] = await Promise.all([
                    api('get', '/delivery/me'),
                    api('get', '/delivery/orders'),
                ]);
                setPerson(profileRes.data);
                setStatus(profileRes.data.status);
                setOrders(ordersRes.data);
            } catch (err) {
                console.error('Dashboard init failed:', err);
                if (err.response?.status === 401) {
                    localStorage.removeItem('delivery_token');
                    navigate('/delivery/login');
                }
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [token, navigate, api]);

    // GPS watching
    useEffect(() => {
        if (!token || !navigator.geolocation) return;

        const watchId = navigator.geolocation.watchPosition(
            async (pos) => {
                setGpsActive(true);
                try {
                    await api('post', '/delivery/location', {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                    });
                } catch {
                    // silent — GPS updates are non-critical
                }
            },
            () => setGpsActive(false),
            { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 },
        );
        watchIdRef.current = watchId;

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [token, api]);

    // SSE for real-time notifications
    useEffect(() => {
        if (!token) return;

        let cancelled = false;
        let currentController = new AbortController();
        let reconnectTimer = null;
        sseAbortRef.current = currentController;

        const connectSSE = async () => {
            if (cancelled) return;
            currentController = new AbortController();
            sseAbortRef.current = currentController;

            try {
                const response = await fetch(`${API_URL}/delivery/sse`, {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: currentController.signal,
                });

                const reader = response.body?.getReader();
                if (!reader) return;

                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const event = JSON.parse(line.slice(6));
                                if (event.type === 'NEW_ORDER') {
                                    const res = await api('get', '/delivery/orders');
                                    setOrders(res.data);
                                    setToast(`New order assigned: ${event.data.orderNumber}`);
                                    setTimeout(() => setToast(null), 5000);
                                }
                            } catch {
                                // Parse error — skip
                            }
                        }
                    }
                }
            } catch (err) {
                if (err.name !== 'AbortError' && !cancelled) {
                    console.error('SSE connection error:', err);
                    reconnectTimer = setTimeout(connectSSE, 5000);
                }
            }
        };

        connectSSE();

        return () => {
            cancelled = true;
            currentController.abort();
            if (reconnectTimer) clearTimeout(reconnectTimer);
        };
    }, [token, api]);

    const handleStatusToggle = async (newStatus) => {
        setStatusLoading(true);
        try {
            await api('post', '/delivery/status', { status: newStatus });
            setStatus(newStatus);
        } catch (err) {
            console.error('Status update failed:', err);
        } finally {
            setStatusLoading(false);
        }
    };

    const handleComplete = async (orderId, result) => {
        try {
            await api('post', `/delivery/orders/${orderId}/complete`, { result });
            setOrders((prev) => prev.filter((a) => a.order?.id !== orderId));
            setStatus('FREE');
            setToast(`Order marked as ${result}`);
            setTimeout(() => setToast(null), 3000);
        } catch (err) {
            console.error('Complete delivery failed:', err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('delivery_token');
        localStorage.removeItem('delivery_person');
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
        }
        if (sseAbortRef.current) {
            sseAbortRef.current.abort();
        }
        navigate('/delivery/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Toast */}
            {toast && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/30 text-sm font-medium animate-bounce">
                    {toast}
                </div>
            )}

            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">
                            Delivery Dashboard
                        </h1>
                        <p className="text-xs text-gray-500">
                            {person?.name || 'Partner'}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <DeliveryStatusToggle
                            status={status}
                            onToggle={handleStatusToggle}
                            loading={statusLoading}
                        />
                        <RippleButton
                            onClick={handleLogout}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </RippleButton>
                    </div>
                </div>
            </header>

            {/* GPS Indicator */}
            <div className="max-w-lg mx-auto px-4 py-2">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${gpsActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${gpsActive ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                    {gpsActive ? 'GPS Active' : 'GPS Inactive'}
                </div>
            </div>

            {/* Orders */}
            <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
                {orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <p className="text-lg font-medium">No active deliveries</p>
                        <p className="text-sm mt-1">
                            {status === 'FREE'
                                ? "You'll be notified when an order is assigned"
                                : "Set status to 'Available' to receive orders"}
                        </p>
                    </div>
                ) : (
                    orders.map((assignment) => (
                        <DeliveryOrderCard
                            key={assignment.id}
                            assignment={assignment}
                            onComplete={handleComplete}
                        />
                    ))
                )}
            </main>
        </div>
    );
};

export default DeliveryDashboard;
