import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const OrderList = ({ onBack }) => {
    const { token } = useAuth();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`${API_URL}/orders`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { limit: 50 } // Get last 50 orders
                });
                setOrders(res.data.data); // data.data because pagination response
            } catch (err) {
                console.error("Failed to fetch orders", err);
                setError(err.response?.data?.message || 'Failed to load orders');
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchOrders();
    }, [token]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'DELIVERED': return 'bg-green-100 text-green-700';
            case 'CANCELLED': return 'bg-red-100 text-red-700';
            case 'Processing': return 'bg-blue-100 text-blue-700';
            case 'PENDING': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-white">
                <div className="flex items-center gap-3 p-4 border-b border-gray-100">
                    <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
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
                <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
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
                    orders.map((order) => (
                        <div key={order.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="text-xs text-gray-500 font-medium">#{order.orderNumber}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                            day: 'numeric', month: 'short', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold leading-none ${getStatusColor(order.status)}`}>
                                    {order.status.replace('_', ' ')}
                                </span>
                            </div>

                            <div className="space-y-2 mb-3">
                                {order.items?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-gray-700 line-clamp-1 flex-1 pr-4">
                                            <span className="font-medium text-gray-900">{item.quantity}x</span> {item.name}
                                        </span>
                                        <span className="text-gray-900 font-medium">₹{item.total}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                                <span className="text-xs text-gray-500">Total Amount</span>
                                <span className="text-base font-bold text-gray-900">₹{order.total}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default OrderList;
