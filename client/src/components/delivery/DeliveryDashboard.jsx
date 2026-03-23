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
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('active');
    const [status, setStatus] = useState('FREE');
    const [gpsActive, setGpsActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const watchIdRef = useRef(null);
    const sseAbortRef = useRef(null);
    const historyFetchedRef = useRef(false);

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

    const toastTimerRef = useRef(null);
    const showToast = useCallback((msg, duration = 4000) => {
        setToast(msg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), duration);
    }, []);

    // Fetch history when tab is first opened
    const fetchHistory = useCallback(async () => {
        if (historyFetchedRef.current) return;
        setHistoryLoading(true);
        try {
            const res = await api('get', '/delivery/history');
            setHistory(res.data);
            historyFetchedRef.current = true;
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setHistoryLoading(false);
        }
    }, [api]);

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
                                    // New order available — show with accept/reject
                                    setAvailableOrders((prev) => {
                                        if (prev.some((o) => o.orderId === event.data.orderId)) return prev;
                                        return [...prev, event.data];
                                    });
                                    const label = event.data.isParcel ? 'parcel' : 'order';
                                    showToast(`New ${label} available: ${event.data.orderNumber}`);
                                }

                                if (event.type === 'ORDER_CLAIMED') {
                                    // Another rider claimed — remove from available
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
                                    showToast(`${event.data.orderNumber} accepted!`);
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

    // Accept broadcast order: claim + auto-accept in sequence
    const handleAcceptBroadcast = async (orderId, isParcel) => {
        // Optimistic removal from available list
        setAvailableOrders((prev) => prev.filter((o) => o.orderId !== orderId));

        const claimPath = isParcel
            ? `/delivery/parcels/${orderId}/claim`
            : `/delivery/orders/${orderId}/claim`;

        const acceptPath = isParcel
            ? `/delivery/parcels/${orderId}/accept`
            : `/delivery/orders/${orderId}/accept`;

        try {
            await api('post', claimPath);
            // Auto-accept immediately after claim
            try {
                await api('post', acceptPath);
            } catch {
                // Accept may fail if CLAIM_CONFIRMED SSE hasn't processed yet, but assignment is created
            }
            // CLAIM_CONFIRMED SSE event will refresh assigned orders
        } catch (err) {
            if (err.response?.status === 409) {
                showToast(err.response?.data?.message || 'Already claimed by another rider');
            } else {
                console.error('Accept failed:', err);
                showToast('Failed to accept');
                // Re-fetch available orders to restore state
                try {
                    const res = await api('get', '/delivery/available-orders');
                    setAvailableOrders(res.data);
                } catch { }
            }
        }
    };

    // Reject broadcast order: just dismiss from local available list
    const handleRejectBroadcast = async (orderId) => {
        setAvailableOrders((prev) => prev.filter((o) => o.orderId !== orderId));
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

    const handleComplete = async (orderId, result, reason) => {
        try {
            await api('post', `/delivery/orders/${orderId}/complete`, { result, reason });
            setOrders((prev) => prev.filter((a) => a.order?.id !== orderId));
            setStatus('FREE');
            showToast(`Order marked as ${result}`, 3000);
            // Invalidate history cache so it refreshes on next tab switch
            historyFetchedRef.current = false;
        } catch (err) {
            console.error('Complete delivery failed:', err);
            showToast(err.response?.data?.message || 'Failed to update', 3000);
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

    const handleParcelComplete = async (parcelOrderId, result, reason) => {
        try {
            await api('post', `/delivery/parcels/${parcelOrderId}/complete`, { result, reason });
            setParcelOrders((prev) => prev.filter((a) => a.parcelOrder?.id !== parcelOrderId));
            setStatus('FREE');
            showToast(`Parcel marked as ${result}`, 3000);
            historyFetchedRef.current = false;
        } catch (err) {
            console.error('Complete parcel delivery failed:', err);
            showToast(err.response?.data?.message || 'Failed to update', 3000);
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

    // Fetch history when switching to that tab
    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, fetchHistory]);

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

            {/* Tab Switcher */}
            <div className="max-w-lg mx-auto px-4 pb-2">
                <div className="flex bg-gray-200 rounded-xl p-1">
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                            activeTab === 'active'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Active {(totalAssigned + availableOrders.length) > 0 && (
                            <span className="ml-1 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-xs">
                                {totalAssigned + availableOrders.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                            activeTab === 'history'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        My Deliveries
                    </button>
                </div>
            </div>

            <main className="flex-1 w-full max-w-lg mx-auto px-4 py-4 space-y-6 overflow-y-auto min-h-0">
                {activeTab === 'active' ? (
                    <>
                        {/* Available Orders (Accept/Reject) */}
                        {availableOrders.length > 0 && (
                            <section>
                                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                    New Orders ({availableOrders.length})
                                </h2>
                                <div className="space-y-3">
                                    {availableOrders.map((order) => (
                                        <AvailableOrderCard
                                            key={order.orderId}
                                            order={order}
                                            onAccept={handleAcceptBroadcast}
                                            onReject={handleRejectBroadcast}
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
                                            Assigned ({totalAssigned})
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
                    </>
                ) : (
                    /* History Tab */
                    <section>
                        {historyLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-8 h-8 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin"></div>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-lg font-medium">No delivery history</p>
                                <p className="text-sm mt-1">Completed deliveries will appear here</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {history.map((item) => (
                                    <HistoryCard key={item.id} item={item} />
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
};

const HistoryCard = ({ item }) => {
    const isParcel = item.type === 'parcel';
    const isDelivered = item.result === 'DELIVERED';
    const completedDate = new Date(item.completedAt);
    const addr = item.deliveryAddress || {};

    return (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
            {/* Header */}
            <div className={`px-4 py-3 flex items-center justify-between ${
                isParcel
                    ? 'bg-gradient-to-r from-purple-50 to-violet-50'
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50'
            }`}>
                <div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isParcel
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                        }`}>
                            {isParcel ? 'Parcel' : 'Order'}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isDelivered
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                        }`}>
                            {isDelivered ? 'Delivered' : 'Not Delivered'}
                        </span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 mt-1">{item.orderNumber}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500">
                        {completedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                        {item.total != null ? `₹${item.total}` : '—'}
                    </p>
                </div>
            </div>

            {/* Address */}
            <div className="px-4 py-2.5">
                <p className="text-xs text-gray-500">
                    {addr.houseNo && `${addr.houseNo}, `}
                    {addr.street && `${addr.street}, `}
                    {addr.city}
                    {(addr.zipCode || addr.pincode) && ` ${addr.zipCode || addr.pincode}`}
                </p>
                {isParcel && item.category && (
                    <p className="text-xs text-purple-600 mt-1">
                        {item.category} &middot; {item.weight} kg
                    </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                    {completedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{item.paymentMethod}
                </p>
            </div>
        </div>
    );
};

export default DeliveryDashboard;
