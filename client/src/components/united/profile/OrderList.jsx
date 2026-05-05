import { RippleButton } from '../../../components/ui/ripple-button';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

import { useAuth } from '../../../context/AuthContext';
import { api, API_URL } from '../../../lib/api';
import { STATUS_MAP, getStatusLabel } from '../../../lib/status';
import { usePolling } from '../../../hooks/usePolling';
import { loadRazorpayScript } from '../../../lib/utils';

// The steps correspond exactly to STATUS_MAP.step (1, 2, 3, 4).
const STEPS = ['Confirmed', 'Packed', 'Shipped', 'Delivered'];

const StatusTracker = ({ status }) => {
    const cfg = STATUS_MAP[status] || { step: 0 };
    if (cfg.step < 1) return null;

    return (
        <div className="flex items-center gap-1 w-full mt-3 mb-1">
            {STEPS.map((label, i) => {
                // STATUS_MAP mapped steps: CONFIRMED(1), PACKED(2), SHIPPED(3), DELIVERED(4)
                const stepNum = i + 1;
                const isComplete = cfg.step >= stepNum;
                const isCurrent = cfg.step === stepNum;
                return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-center">
                            <div className={`h-1.5 flex-1 rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-slate-700'}`} />
                        </div>
                        <span className={`text-[10px] leading-none ${isCurrent ? 'font-bold text-emerald-700 dark:text-emerald-400' : isComplete ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400 dark:text-gray-600'}`}>
                            {label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const OrderList = ({ onBack }) => {
    const { token, user } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [cancellingId, setCancellingId] = useState(null);
    const [payingId, setPayingId] = useState(null);
    const [cancelError, setCancelError] = useState('');

    const handlePayNow = useCallback(async (order) => {
        setPayingId(order.id);
        setCancelError('');
        const http = api(token);

        try {
            const isLoaded = await loadRazorpayScript();
            if (!isLoaded) {
                setCancelError('Razorpay SDK failed to load. Please check your internet connection.');
                setPayingId(null);
                return;
            }

            // Create Razorpay order on server
            const rzpOrderRes = await http.post(`/payments/create/${order.id}`);
            const rzpOrder = rzpOrderRes.data;

            // Handle Mock Mode
            if (rzpOrder.mockMode) {
                try {
                    const mockRes = await http.post(`/payments/mock/${order.id}`);
                    setOrders((prev) => prev.map((o) =>
                        o.id === order.id ? { ...o, ...mockRes.data.order } : o
                    ));
                    setCancelError('');
                } catch (err) {
                    setCancelError(err.response?.data?.message || 'Mock payment failed');
                } finally {
                    setPayingId(null);
                }
                return;
            }

            const options = {
                key: rzpOrder.key,
                amount: rzpOrder.amount,
                currency: rzpOrder.currency,
                name: 'New Grocery',
                description: `Order #${order.orderNumber}`,
                order_id: rzpOrder.razorpayOrderId,
                config: {
                    display: {
                        blocks: {
                            utupi: {
                                name: 'UPI',
                                instruments: [{ method: 'upi' }]
                            },
                            utcard: {
                                name: 'Cards',
                                instruments: [{ method: 'card' }]
                            },
                            utnb: {
                                name: 'Netbanking',
                                instruments: [{ method: 'netbanking' }]
                            },
                            utwallet: {
                                name: 'Wallets',
                                instruments: [{ method: 'wallet' }]
                            }
                        },
                        sequence: ['block.utupi', 'block.utcard', 'block.utnb', 'block.utwallet'],
                        preferences: {
                            show_default_blocks: false
                        }
                    }
                },
                handler: async (response) => {
                    setPayingId(order.id);
                    try {
                        const verifyRes = await http.post('/payments/verify', {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });

                        setOrders((prev) => prev.map((o) =>
                            o.id === order.id ? { ...o, ...verifyRes.data.order } : o
                        ));
                        setCancelError('');
                    } catch (err) {
                        setCancelError(err.response?.data?.message || 'Payment verification failed');
                    } finally {
                        setPayingId(null);
                    }
                },
                modal: {
                    ondismiss: () => {
                        setPayingId(null);
                    },
                },
                prefill: {
                    name: user?.name || '',
                    contact: user?.phone || '',
                },
                theme: {
                    color: '#10b981',
                },
            };

            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (err) {
            setCancelError(err.response?.data?.message || 'Payment failed to initiate');
            setPayingId(null);
        }
    }, [token, user]);

    const handleCancelOrder = useCallback(async (orderId) => {
        setCancellingId(orderId);
        setCancelError('');
        try {
            await api(token).post(`/orders/${orderId}/cancel`);
            setOrders((prev) => prev.map((o) =>
                o.id === orderId ? { ...o, status: 'CANCELLED', canCancel: false, canModify: false } : o
            ));
        } catch (err) {
            setCancelError(err.response?.data?.message || 'Failed to cancel order');
        } finally {
            setCancellingId(null);
        }
    }, [token]);

    // Polling: always keep running while on orders page
    const fetchOrders = useCallback(async () => {
        try {
            const res = await api(token).get('/orders', { params: { limit: 50 } });
            const fetchedOrders = res.data.data || [];
            setOrders(fetchedOrders);
            setLoading(false);
            return true; // keep polling always
        } catch (err) {
            console.error("Failed to fetch orders", err);
            setLoading(false);
            return true; // retry on error
        }
    }, [token]);

    usePolling(fetchOrders, 8000, !!token);

    // Real-time SSE updates (Web only)
    const reconnectTimeout = useRef(null);
    useEffect(() => {
        if (!token || Capacitor.isNativePlatform()) return;

        let eventSource;
        const connect = () => {
            const url = new URL(`${API_URL}/orders/sse`, window.location.origin);
            url.searchParams.append('token', token);

            eventSource = new EventSource(url.toString());

            eventSource.onmessage = (event) => {
                try {
                    const { type, data } = JSON.parse(event.data);
                    if (type === 'ORDER_STATUS_UPDATED') {
                        setOrders((prev) => prev.map((o) =>
                            o.id === data.orderId ? { ...o, status: data.status } : o
                        ));
                        // If current order status changed, maybe trigger a notification or highlight?
                        console.log(`SSE UPDATE RECEIVED: Order ${data.orderNumber} status updated to ${data.status} (ID: ${data.orderId})`);
                    }

                } catch (err) {
                    console.error('SSE message parse error:', err);
                }
            };

            eventSource.onerror = () => {
                eventSource.close();
                // Attempt to reconnect after 5 seconds
                reconnectTimeout.current = setTimeout(connect, 5000);
            };
        };

        connect();

        return () => {
            if (eventSource) eventSource.close();
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        };
    }, [token]);


    const getCfg = (status) => STATUS_MAP[status] || { label: status, color: 'bg-gray-100 text-gray-700', step: 0 };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-slate-900">
                <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-slate-800">
                    <RippleButton onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full">
                        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </RippleButton>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">My Orders</h2>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ud-primary"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
                <RippleButton onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full">
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </RippleButton>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">My Orders</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-slate-900 space-y-4">
                {cancelError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg text-red-700 dark:text-red-400 text-sm flex justify-between items-center">
                        <span>{cancelError}</span>
                        <button onClick={() => setCancelError('')} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
                    </div>
                )}
                {orders.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">No orders yet</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Your past orders will appear here</p>
                    </div>
                ) : (
                    orders.map((order) => {
                        const cfg = getCfg(order.status);
                        const isExpanded = expandedId === order.id;
                        const items = order.items || [];
                        const addr = order.deliveryAddress;

                        return (
                            <div
                                key={order.id}
                                className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden"
                            >
                                {/* Header — always visible, tappable */}
                                <div
                                    className="p-4 cursor-pointer active:bg-gray-50 dark:active:bg-slate-700"
                                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">#{order.orderNumber}</p>
                                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                                                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                                    day: 'numeric', month: 'short', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold leading-none ${cfg.color}`}>
                                                {cfg.label}
                                            </span>
                                            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Delivery PIN — visible only for active orders */}
                                    {order.deliveryPin && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                                        <div className="mt-3 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 rounded-lg flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">Delivery PIN</p>
                                                <p className="text-xs text-emerald-500 dark:text-emerald-500/80 mt-0.5">Share this with the rider</p>
                                            </div>
                                            <div className="flex gap-1.5">
                                                {order.deliveryPin.split('').map((digit, i) => (
                                                    <span key={i} className="w-8 h-9 bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-900/50 rounded flex items-center justify-center text-lg font-black text-emerald-700 dark:text-emerald-400 shadow-sm">
                                                        {digit}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick summary when collapsed */}
                                    {!isExpanded && (
                                        <div className="mt-2 flex justify-between items-center">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {order.isParent
                                                    ? `${order.childOrders?.length || 0} sub-orders`
                                                    : `${items.length} item${items.length !== 1 ? 's' : ''}`
                                                }
                                                {order.isParent && (
                                                    <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded text-[10px] font-bold">
                                                        Multi-store
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">₹{order.total}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100">
                                        {/* Status Tracker */}
                                        <div className="px-4 pt-3">
                                            <StatusTracker status={order.status} />
                                        </div>

                                        {/* Items or Sub-orders */}
                                        {order.isParent && (!order.childOrders || order.childOrders.length === 0) ? (
                                            <div className="px-4 pt-3 pb-2">
                                                <p className="text-xs text-gray-400 text-center py-2">Sub-orders loading...</p>
                                            </div>
                                        ) : order.isParent && order.childOrders?.length > 0 ? (
                                            <div className="px-4 pt-3 pb-2 space-y-3">
                                                <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                                                    {order.childOrders.length} Sub-orders
                                                </p>
                                                {order.childOrders.map((child) => {
                                                    const childCfg = getCfg(child.status);
                                                    return (
                                                        <div key={child.id} className="bg-gray-50 dark:bg-slate-900 rounded-lg p-3 border border-gray-100 dark:border-slate-700">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                                                    {child.storeTypeName || 'Store'} <span className="text-gray-500 dark:text-gray-400 font-medium ml-1">#{child.orderNumber}</span>
                                                                </span>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${childCfg.color}`}>
                                                                    {childCfg.label}
                                                                </span>
                                                            </div>
                                                            <StatusTracker status={child.status} />
                                                            <div className="space-y-1 mt-2">
                                                                {(child.items || []).map((item, idx) => (
                                                                    <div key={item.id || idx} className="text-xs">
                                                                        <div className="flex justify-between items-start">
                                                                            <div className="flex-1 min-w-0 pr-2">
                                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                                    <span className="text-gray-800 dark:text-gray-200">{item.name}</span>
                                                                                    {item.variantLabel && (
                                                                                        <span className="text-[9px] px-1 py-0.5 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded font-bold uppercase ring-1 ring-emerald-100 dark:ring-emerald-900">
                                                                                            {item.variantLabel}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <span className="text-gray-400 dark:text-gray-500 text-[10px]">{item.quantity}x</span>
                                                                            </div>
                                                                            <span className="font-medium text-gray-700 dark:text-gray-300">₹{item.total || (item.price * item.quantity)}</span>
                                                                        </div>
                                                                        {(item.variantLabel || item.selectedSize || item.userUploadUrls?.length > 0) && (
                                                                            <div className="flex flex-wrap gap-1 mt-0.5 ml-0.5">
                                                                                {item.selectedSize && (
                                                                                    <span className="text-[10px] px-1 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">Size: {item.selectedSize}</span>
                                                                                )}
                                                                                {item.userUploadUrls?.map((url, ui) => (
                                                                                    <a key={ui} href={url} target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded overflow-hidden border border-gray-200 inline-block">
                                                                                        <img src={url} alt={`Upload ${ui + 1}`} className="w-full h-full object-cover" />
                                                                                    </a>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="flex justify-between text-xs font-bold text-gray-900 dark:text-gray-100 mt-2 pt-1.5 border-t border-gray-200 dark:border-slate-700">
                                                                <span>Subtotal</span>
                                                                <span>₹{child.subtotal}</span>
                                                            </div>
                                                            {child.assignment?.deliveryPerson && (
                                                                <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                                                                    <span>Delivery by</span>
                                                                    <span className="font-medium text-gray-700 dark:text-gray-300">{child.assignment.deliveryPerson.name}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="px-4 pt-3 pb-2">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Items</p>
                                                <div className="space-y-2">
                                                    {items.map((item, idx) => (
                                                        <div key={item.id || idx}>
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex-1 min-w-0 pr-3">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <p className="text-sm text-gray-900 dark:text-gray-100 leading-tight">{item.name}</p>
                                                                        {item.variantLabel && (
                                                                            <span className="text-[9px] px-1 py-0.5 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded font-bold uppercase ring-1 ring-emerald-100 dark:ring-emerald-900">
                                                                                {item.variantLabel}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[11px] text-gray-400 dark:text-gray-500">{item.quantity} x ₹{item.price}</p>
                                                                </div>
                                                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">₹{item.total || (item.price * item.quantity)}</span>
                                                            </div>
                                                            {(item.variantLabel || item.selectedSize || item.userUploadUrls?.length > 0) && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {item.selectedSize && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">Size: {item.selectedSize}</span>
                                                                    )}
                                                                    {item.userUploadUrls?.map((url, ui) => (
                                                                        <a key={ui} href={url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded overflow-hidden border border-gray-200 inline-block">
                                                                            <img src={url} alt={`Upload ${ui + 1}`} className="w-full h-full object-cover" />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Price Breakdown */}
                                        <div className="mx-4 pt-2 pb-3 border-t border-dashed border-gray-200 dark:border-slate-700 space-y-1.5">
                                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                                <span>Subtotal</span>
                                                <span>₹{order.subtotal}</span>
                                            </div>
                                            {order.deliveryFee != null && (
                                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                                    <span>Delivery</span>
                                                    <span>{order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}</span>
                                                </div>
                                            )}
                                            {order.tax > 0 && (
                                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                                    <span>Tax</span>
                                                    <span>₹{order.tax}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-gray-100 pt-1">
                                                <span>Total</span>
                                                <span className="text-emerald-600 dark:text-emerald-400">₹{order.total}</span>
                                            </div>
                                        </div>

                                        {/* Payment & Delivery Info */}
                                        <div className="mx-4 pt-2 pb-3 border-t border-gray-100 dark:border-slate-700 space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-400 dark:text-gray-500">Payment</span>
                                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                                    {order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}
                                                    {order.paymentStatus === 'PAID' && (
                                                        <span className="ml-1.5 text-green-600 dark:text-green-400">Paid</span>
                                                    )}
                                                </span>
                                            </div>

                                            {order.assignment?.deliveryPerson && (
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-400 dark:text-gray-500">Delivery by</span>
                                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{order.assignment.deliveryPerson.name}</span>
                                                </div>
                                            )}

                                            {order.deliveredAt && (
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-400">Delivered on</span>
                                                    <span className="text-gray-700 font-medium">
                                                        {new Date(order.deliveredAt).toLocaleDateString('en-IN', {
                                                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Delivery Address */}
                                        {addr && (
                                            <div className="mx-4 pt-2 pb-3 border-t border-gray-100 dark:border-slate-700">
                                                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Delivery Address</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                                    {addr.recipientName && <span className="font-medium text-gray-800 dark:text-gray-200">{addr.recipientName}<br /></span>}
                                                    {addr.flatBuilding && <>{addr.flatBuilding}, </>}
                                                    {addr.street && <>{addr.street}, </>}
                                                    {addr.landmark && <>{addr.landmark}, </>}
                                                    {addr.city}
                                                    {addr.recipientPhone && (
                                                        <span className="block mt-0.5 text-gray-400 dark:text-gray-500">{addr.recipientPhone}</span>
                                                    )}
                                                </p>
                                            </div>
                                        )}

                                        {/* Actions — Pay Now / Cancel */}
                                        {(order.canCancel || (order.paymentMethod === 'RAZORPAY' && order.paymentStatus === 'PENDING' && order.status !== 'CANCELLED')) && (
                                            <div className="mx-4 pb-4 space-y-2">
                                                {/* Pay Now button */}
                                                {order.paymentMethod === 'RAZORPAY' && order.paymentStatus === 'PENDING' && order.status !== 'CANCELLED' && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handlePayNow(order); }}
                                                        disabled={payingId === order.id}
                                                        className="w-full py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-lg shadow-emerald-500/20"
                                                    >
                                                        {payingId === order.id ? 'Processing...' : 'Pay Now'}
                                                    </button>
                                                )}

                                                {/* Cancel button — grace period */}
                                                {order.canCancel && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleCancelOrder(order.id); }}
                                                        disabled={cancellingId === order.id}
                                                        className="w-full py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 transition-colors"
                                                    >
                                                        {cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default OrderList;
