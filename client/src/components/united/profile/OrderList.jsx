import { RippleButton } from '../../../components/ui/ripple-button';
import { useState, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api } from '../../../lib/api';
import { STATUS_MAP, getStatusLabel } from '../../../lib/status';
import { usePolling } from '../../../hooks/usePolling';

const STEPS = ['Confirmed', 'Packed', 'Shipped', 'Delivered'];

const StatusTracker = ({ status }) => {
    const cfg = STATUS_MAP[status] || { step: 0 };
    if (cfg.step < 1) return null;

    return (
        <div className="flex items-center gap-1 w-full mt-3 mb-1">
            {STEPS.map((label, i) => {
                const stepNum = i + 1;
                const isComplete = cfg.step >= stepNum;
                const isCurrent = cfg.step === stepNum;
                return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-center">
                            <div className={`h-1.5 flex-1 rounded-full transition-all ${isComplete ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                        </div>
                        <span className={`text-[10px] leading-none ${isCurrent ? 'font-bold text-emerald-700' : isComplete ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const OrderList = ({ onBack }) => {
    const { token } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [cancellingId, setCancellingId] = useState(null);
    const [cancelError, setCancelError] = useState('');

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

    // Polling: returns true if there are active orders (keep polling)
    const fetchOrders = useCallback(async () => {
        try {
            const res = await api(token).get('/orders', { params: { limit: 50 } });
            const fetchedOrders = res.data.data || [];
            setOrders(fetchedOrders);
            setLoading(false);
            return fetchedOrders.some(o =>
                ['PENDING', 'CONFIRMED', 'ORDER_PICKED', 'SHIPPED'].includes(o.status)
            );
        } catch (err) {
            console.error("Failed to fetch orders", err);
            setLoading(false);
            return true; // retry on error
        }
    }, [token]);

    usePolling(fetchOrders, 15000, !!token);

    const getCfg = (status) => STATUS_MAP[status] || { label: status, color: 'bg-gray-100 text-gray-700', step: 0 };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-white">
                <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                    <RippleButton onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </RippleButton>
                    <h2 className="text-lg font-bold text-gray-900">My Orders</h2>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ud-primary"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                <RippleButton onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </RippleButton>
                <h2 className="text-lg font-bold text-gray-900">My Orders</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
                {cancelError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between items-center">
                        <span>{cancelError}</span>
                        <button onClick={() => setCancelError('')} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
                    </div>
                )}
                {orders.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">No orders yet</h3>
                        <p className="text-gray-500 text-sm mt-1">Your past orders will appear here</p>
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
                                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                            >
                                {/* Header — always visible, tappable */}
                                <div
                                    className="p-4 cursor-pointer active:bg-gray-50"
                                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-gray-500 font-medium">#{order.orderNumber}</p>
                                            <p className="text-[11px] text-gray-400 mt-0.5">
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

                                    {/* Quick summary when collapsed */}
                                    {!isExpanded && (
                                        <div className="mt-2 flex justify-between items-center">
                                            <span className="text-xs text-gray-500">
                                                {order.isParent
                                                    ? `${order.childOrders?.length || 0} sub-orders`
                                                    : `${items.length} item${items.length !== 1 ? 's' : ''}`
                                                }
                                                {order.isParent && (
                                                    <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">
                                                        Multi-store
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-sm font-bold text-gray-900">₹{order.total}</span>
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
                                                        <div key={child.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <span className="text-xs font-medium text-gray-600">#{child.orderNumber}</span>
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
                                                                                <span className="text-gray-800">{item.name}</span>
                                                                                <span className="text-gray-400 ml-1">{item.quantity}x</span>
                                                                            </div>
                                                                            <span className="font-medium text-gray-700">₹{item.total || (item.price * item.quantity)}</span>
                                                                        </div>
                                                                        {(item.selectedSize || item.userUploadUrls?.length > 0) && (
                                                                            <div className="flex flex-wrap gap-1 mt-0.5 ml-0.5">
                                                                                {item.selectedSize && (
                                                                                    <span className="text-[10px] px-1 py-0.5 bg-blue-50 text-blue-600 rounded">Size: {item.selectedSize}</span>
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
                                                            <div className="flex justify-between text-xs font-bold text-gray-900 mt-2 pt-1.5 border-t border-gray-200">
                                                                <span>Subtotal</span>
                                                                <span>₹{child.subtotal}</span>
                                                            </div>
                                                            {child.assignment?.deliveryPerson && (
                                                                <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                                                                    <span>Delivery by</span>
                                                                    <span className="font-medium text-gray-700">{child.assignment.deliveryPerson.name}</span>
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
                                                                    <p className="text-sm text-gray-900 leading-tight">{item.name}</p>
                                                                    <p className="text-[11px] text-gray-400">{item.quantity} x ₹{item.price}</p>
                                                                </div>
                                                                <span className="text-sm font-semibold text-gray-800">₹{item.total || (item.price * item.quantity)}</span>
                                                            </div>
                                                            {(item.selectedSize || item.userUploadUrls?.length > 0) && (
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
                                        <div className="mx-4 pt-2 pb-3 border-t border-dashed border-gray-200 space-y-1.5">
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>Subtotal</span>
                                                <span>₹{order.subtotal}</span>
                                            </div>
                                            {order.deliveryFee != null && (
                                                <div className="flex justify-between text-xs text-gray-500">
                                                    <span>Delivery</span>
                                                    <span>{order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}</span>
                                                </div>
                                            )}
                                            {order.tax > 0 && (
                                                <div className="flex justify-between text-xs text-gray-500">
                                                    <span>Tax</span>
                                                    <span>₹{order.tax}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-sm font-bold text-gray-900 pt-1">
                                                <span>Total</span>
                                                <span className="text-emerald-600">₹{order.total}</span>
                                            </div>
                                        </div>

                                        {/* Payment & Delivery Info */}
                                        <div className="mx-4 pt-2 pb-3 border-t border-gray-100 space-y-2">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-gray-400">Payment</span>
                                                <span className="text-gray-700 font-medium">
                                                    {order.paymentMethod === 'COD' ? 'Cash on Delivery' : order.paymentMethod}
                                                    {order.paymentStatus === 'PAID' && (
                                                        <span className="ml-1.5 text-green-600">Paid</span>
                                                    )}
                                                </span>
                                            </div>

                                            {order.assignment?.deliveryPerson && (
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-400">Delivery by</span>
                                                    <span className="text-gray-700 font-medium">{order.assignment.deliveryPerson.name}</span>
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
                                            <div className="mx-4 pt-2 pb-3 border-t border-gray-100">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Delivery Address</p>
                                                <p className="text-xs text-gray-600 leading-relaxed">
                                                    {addr.recipientName && <span className="font-medium text-gray-800">{addr.recipientName}<br /></span>}
                                                    {addr.flatBuilding && <>{addr.flatBuilding}, </>}
                                                    {addr.street && <>{addr.street}, </>}
                                                    {addr.landmark && <>{addr.landmark}, </>}
                                                    {addr.city}
                                                    {addr.recipientPhone && (
                                                        <span className="block mt-0.5 text-gray-400">{addr.recipientPhone}</span>
                                                    )}
                                                </p>
                                            </div>
                                        )}

                                        {/* Cancel button — grace period */}
                                        {order.canCancel && (
                                            <div className="mx-4 pb-4">
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleCancelOrder(order.id); }}
                                                    disabled={cancellingId === order.id}
                                                    className="w-full py-2.5 bg-red-50 text-red-600 text-sm font-bold rounded-xl border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
                                                >
                                                    {cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}
                                                </button>
                                                {order.graceExpiresAt && new Date(order.graceExpiresAt) > new Date() && (
                                                    <p className="text-[10px] text-amber-600 text-center mt-1">
                                                        Cancel window expires in {Math.max(0, Math.ceil((new Date(order.graceExpiresAt).getTime() - Date.now()) / 1000))}s
                                                    </p>
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
