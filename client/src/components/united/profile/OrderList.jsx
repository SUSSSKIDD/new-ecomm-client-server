import { RippleButton } from '../../../components/ui/ripple-button';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const STATUS_CONFIG = {
    CONFIRMED: { label: 'Confirmed', color: 'bg-blue-100 text-blue-700', step: 1 },
    ORDER_PICKED: { label: 'Order Packed', color: 'bg-orange-100 text-orange-700', step: 2 },
    SHIPPED: { label: 'Shipped', color: 'bg-purple-100 text-purple-700', step: 3 },
    DELIVERED: { label: 'Delivered', color: 'bg-green-100 text-green-700', step: 4 },
    PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700', step: 0 },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700', step: -1 },
};

const STEPS = ['Confirmed', 'Packed', 'Shipped', 'Delivered'];

const StatusTracker = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || { step: 0 };
    if (cfg.step < 1) return null; // Don't show tracker for PENDING/CANCELLED

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

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`${API_URL}/orders`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { limit: 50 }
                });
                setOrders(res.data.data);
            } catch (err) {
                console.error("Failed to fetch orders", err);
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchOrders();
    }, [token]);

    const getStatusCfg = (status) => STATUS_CONFIG[status] || { label: status, color: 'bg-gray-100 text-gray-700', step: 0 };

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
                        const cfg = getStatusCfg(order.status);
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
                                                {items.length} item{items.length !== 1 ? 's' : ''}
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

                                        {/* Items */}
                                        <div className="px-4 pt-3 pb-2">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Items</p>
                                            <div className="space-y-2">
                                                {items.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-start">
                                                        <div className="flex-1 min-w-0 pr-3">
                                                            <p className="text-sm text-gray-900 leading-tight">{item.name}</p>
                                                            <p className="text-[11px] text-gray-400">{item.quantity} x ₹{item.price}</p>
                                                        </div>
                                                        <span className="text-sm font-semibold text-gray-800">₹{item.total || (item.price * item.quantity)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

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
                                            <div className="mx-4 pt-2 pb-4 border-t border-gray-100">
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
