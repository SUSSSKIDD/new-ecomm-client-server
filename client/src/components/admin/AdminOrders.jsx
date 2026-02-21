/* eslint-disable react/prop-types */
import { RippleButton } from '../ui/ripple-button';
import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const STATUS_COLORS = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-indigo-100 text-indigo-800',
    ORDER_PICKED: 'bg-orange-100 text-orange-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

const STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'ORDER_PICKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const AdminOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [assigningId, setAssigningId] = useState(null);
    const limit = 10;

    useEffect(() => {
        fetchOrders();
    }, [page, statusFilter]);

    const getToken = () => localStorage.getItem('ud_admin_token');

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit });
            if (statusFilter) params.append('status', statusFilter);
            const res = await fetch(`${API_URL}/orders/admin/store?${params}`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data.data || []);
                setOrders(list);
                if (data.meta?.totalPages) setTotalPages(data.meta.totalPages);
                else if (data.totalPages) setTotalPages(data.totalPages);
                else if (data.total) setTotalPages(Math.ceil(data.total / limit));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (orderId, newStatus) => {
        setUpdatingId(orderId);
        try {
            const res = await fetch(`${API_URL}/orders/admin/${orderId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            } else {
                const data = await res.json().catch(() => null);
                alert(data?.message || `Cannot update status to ${newStatus}`);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUpdatingId(null);
        }
    };

    const assignDelivery = async (orderId) => {
        setAssigningId(orderId);
        try {
            const res = await fetch(`${API_URL}/orders/admin/${orderId}/assign-delivery`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`
                }
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message || 'Assignment triggered');
                fetchOrders();
            } else {
                alert(data.message || 'Assignment failed');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to assign delivery');
        } finally {
            setAssigningId(null);
        }
    };

    const canAssignDelivery = (order) => {
        return !order.assignment && !['CANCELLED', 'DELIVERED', 'PENDING'].includes(order.status);
    };

    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
                <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-ud-primary"
                >
                    <option value="">All Statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="text-center p-10 animate-pulse text-gray-500">Loading orders...</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan="9" className="px-6 py-10 text-center text-gray-500">No orders found.</td>
                                </tr>
                            )}
                            {orders.map(o => (
                                <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {(o.orderNumber || o.id?.substring(0, 8))}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {formatDate(o.createdAt)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {o.user?.name || o.user?.phone || o.userId?.substring(0, 8) || '—'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {o.items?.length || o.orderItems?.length || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                                        ₹{o.totalAmount || o.total || 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${o.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {o.paymentStatus || '—'}
                                        </span>
                                        {o.paymentMethod && (
                                            <span className="ml-1 text-xs text-gray-400">{o.paymentMethod}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-800'}`}>
                                            {o.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {o.assignment ? (
                                            <span className="text-xs text-green-700">
                                                {o.assignment.deliveryPerson?.name || 'Assigned'}
                                            </span>
                                        ) : canAssignDelivery(o) ? (
                                            <RippleButton
                                                onClick={() => assignDelivery(o.id)}
                                                disabled={assigningId === o.id}
                                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                            >
                                                {assigningId === o.id ? 'Assigning...' : 'Find Delivery'}
                                            </RippleButton>
                                        ) : (
                                            <span className="text-xs text-gray-400">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <select
                                            value={o.status}
                                            disabled={updatingId === o.id}
                                            onChange={e => updateStatus(o.id, e.target.value)}
                                            className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-ud-primary disabled:opacity-50"
                                        >
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
                        <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <RippleButton
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </RippleButton>
                            <RippleButton
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </RippleButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminOrders;
