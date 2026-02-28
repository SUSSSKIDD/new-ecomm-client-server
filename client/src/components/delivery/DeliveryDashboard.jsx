import { RippleButton } from '../ui/ripple-button';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import DeliveryOrderCard from './DeliveryOrderCard';
import DeliveryParcelCard from './DeliveryParcelCard';
import AvailableOrderCard from './AvailableOrderCard';
import DeliveryStatusToggle from './DeliveryStatusToggle';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const DeliveryDashboard = () => {
    const navigate = useNavigate();
    const [person, setPerson] = useState(null);
    const [orders, setOrders] = useState([]);
    const [parcelOrders, setParcelOrders] = useState([]);
    const [availableOrders, setAvailableOrders] = useState([]);
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

    const showToast = useCallback((msg, duration = 4000) => {
        setToast(msg);
        setTimeout(() => setToast(null), duration);
    }, []);

    // Redirect if not logged in
    useEffect(() => {
        if (!token) {
            navigate('/delivery/login');
            return;
        }

        const init = async () => {
            try {
                const [profileRes, ordersRes, parcelRes, availableRes] = await Promise.all([
                    api('get', '/delivery/me'),
                    api('get', '/delivery/orders'),
                    api('get', '/delivery/parcel-orders'),
                    api('get', '/delivery/available-orders'),
                ]);
                setPerson(profileRes.data);
                setStatus(profileRes.data.status);
                setOrders(ordersRes.data);
                setParcelOrders(parcelRes.data);
                setAvailableOrders(availableRes.data);
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
                                    // Legacy: direct assignment notification
                                    const res = await api('get', '/delivery/orders');
                                    setOrders(res.data);
                                    showToast(`New order assigned: ${event.data.orderNumber}`);
                                }

                                if (event.type === 'NEW_AVAILABLE_ORDER') {
                                    // Competitive: new order available for claiming (regular or parcel)
                                    setAvailableOrders((prev) => {
                                        // Avoid duplicates
                                        if (prev.some((o) => o.orderId === event.data.orderId)) return prev;
                                        return [...prev, event.data];
                                    });
                                    const label = event.data.isParcel ? 'parcel' : 'order';
                                    showToast(`New ${label} available: ${event.data.orderNumber}`);
                                }

                                if (event.type === 'ORDER_CLAIMED') {
                                    // Another rider claimed the order — remove from available
                                    setAvailableOrders((prev) =>
                                        prev.filter((o) => o.orderId !== event.data.orderId),
                                    );
                                }

                                if (event.type === 'CLAIM_CONFIRMED') {
                                    // We successfully claimed — refresh assigned orders + parcels
                                    const [ordersRes, parcelRes] = await Promise.all([
                                        api('get', '/delivery/orders'),
                                        api('get', '/delivery/parcel-orders'),
                                    ]);
                                    setOrders(ordersRes.data);
                                    setParcelOrders(parcelRes.data);
                                    setStatus('BUSY');
                                    showToast(`${event.data.orderNumber} claimed!`);
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
    }, [token, api, showToast]);

    const handleStatusToggle = async (newStatus) => {
        if (status === 'BUSY') return;
        const prevStatus = status;
        setStatusLoading(true);
        setStatus(newStatus); // Optimistic update
        try {
            await api('post', '/delivery/status', { status: newStatus });
        } catch (err) {
            console.error('Status update failed:', err);
            setStatus(prevStatus); // Revert on error
            showToast('Failed to update status');
        } finally {
            setStatusLoading(false);
        }
    };

    const handleClaim = async (orderId, isParcel) => {
        // Optimistic removal from available list
        setAvailableOrders((prev) => prev.filter((o) => o.orderId !== orderId));

        const claimPath = isParcel
            ? `/delivery/parcels/${orderId}/claim`
            : `/delivery/orders/${orderId}/claim`;

        try {
            await api('post', claimPath);
            // CLAIM_CONFIRMED SSE event will refresh assigned orders
        } catch (err) {
            if (err.response?.status === 409) {
                showToast('Already claimed by another rider');
            } else {
                console.error('Claim failed:', err);
                showToast('Failed to claim');
                // Re-fetch available orders to restore state
                try {
                    const res = await api('get', '/delivery/available-orders');
                    setAvailableOrders(res.data);
                } catch { }
            }
        }
    };

    const handleAccept = async (orderId) => {
        try {
            await api('post', `/delivery/orders/${orderId}/accept`);
            setOrders((prev) =>
                prev.map((a) =>
                    a.order?.id === orderId ? { ...a, acceptedAt: new Date().toISOString() } : a
                ),
            );
            showToast('Order accepted!', 3000);
        } catch (err) {
            console.error('Accept failed:', err);
            showToast('Failed to accept order', 3000);
        }
    };

    const handleReject = async (orderId) => {
        try {
            await api('post', `/delivery/orders/${orderId}/reject`);
            setOrders((prev) => prev.filter((a) => a.order?.id !== orderId));
            setStatus('FREE');
            showToast('Order rejected — reassigning to another delivery partner');
        } catch (err) {
            console.error('Reject failed:', err);
            showToast('Failed to reject order', 3000);
        }
    };

    const handleComplete = async (orderId, result) => {
        try {
            await api('post', `/delivery/orders/${orderId}/complete`, { result });
            setOrders((prev) => prev.filter((a) => a.order?.id !== orderId));
            setStatus('FREE');
            showToast(`Order marked as ${result}`, 3000);
        } catch (err) {
            console.error('Complete delivery failed:', err);
        }
    };

    // Parcel-specific handlers
    const handleParcelAccept = async (parcelOrderId) => {
        try {
            await api('post', `/delivery/parcels/${parcelOrderId}/accept`);
            setParcelOrders((prev) =>
                prev.map((a) =>
                    a.parcelOrder?.id === parcelOrderId ? { ...a, acceptedAt: new Date().toISOString() } : a
                ),
            );
            showToast('Parcel accepted!', 3000);
        } catch (err) {
            console.error('Parcel accept failed:', err);
            showToast('Failed to accept parcel', 3000);
        }
    };

    const handleParcelReject = async (parcelOrderId) => {
        try {
            await api('post', `/delivery/parcels/${parcelOrderId}/reject`);
            setParcelOrders((prev) => prev.filter((a) => a.parcelOrder?.id !== parcelOrderId));
            setStatus('FREE');
            showToast('Parcel rejected — reassigning to another delivery partner');
        } catch (err) {
            console.error('Parcel reject failed:', err);
            showToast('Failed to reject parcel', 3000);
        }
    };

    const handleParcelComplete = async (parcelOrderId, result) => {
        try {
            await api('post', `/delivery/parcels/${parcelOrderId}/complete`, { result });
            setParcelOrders((prev) => prev.filter((a) => a.parcelOrder?.id !== parcelOrderId));
            setStatus('FREE');
            showToast(`Parcel marked as ${result}`, 3000);
        } catch (err) {
            console.error('Complete parcel delivery failed:', err);
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
            <div className="h-[100dvh] flex items-center justify-center bg-gray-50 w-full overflow-hidden">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    const totalAssigned = orders.length + parcelOrders.length;

    return (
        <div className="h-[100dvh] w-full bg-gray-50 flex flex-col overflow-hidden overscroll-none">
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

            <main className="flex-1 w-full max-w-lg mx-auto px-4 py-4 space-y-6 overflow-y-auto min-h-0">
                {/* Available Orders (Competitive Claiming) */}
                {availableOrders.length > 0 && (
                    <section>
                        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Available Orders ({availableOrders.length})
                        </h2>
                        <div className="space-y-3">
                            {availableOrders.map((order) => (
                                <AvailableOrderCard
                                    key={order.orderId}
                                    order={order}
                                    onClaim={handleClaim}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* Assigned Orders + Parcels */}
                <section>
                    {totalAssigned === 0 && availableOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <p className="text-lg font-medium">No active deliveries</p>
                            <p className="text-sm mt-1">
                                {status === 'BUSY'
                                    ? "Delivery in progress"
                                    : status === 'FREE'
                                        ? "You'll be notified when orders are available"
                                        : "Go online to start receiving orders"}
                            </p>
                        </div>
                    ) : (
                        <>
                            {totalAssigned > 0 && (
                                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">
                                    My Deliveries ({totalAssigned})
                                </h2>
                            )}
                            <div className="space-y-4">
                                {orders.map((assignment) => (
                                    <DeliveryOrderCard
                                        key={assignment.id}
                                        assignment={assignment}
                                        onAccept={handleAccept}
                                        onReject={handleReject}
                                        onComplete={handleComplete}
                                    />
                                ))}
                                {parcelOrders.map((assignment) => (
                                    <DeliveryParcelCard
                                        key={assignment.id}
                                        assignment={assignment}
                                        onAccept={handleParcelAccept}
                                        onReject={handleParcelReject}
                                        onComplete={handleParcelComplete}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </section>
            </main>
        </div>
    );
};

export default DeliveryDashboard;
