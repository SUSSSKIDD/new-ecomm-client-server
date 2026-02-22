/* eslint-disable react/prop-types */
import React from 'react';
import { RippleButton } from '../ui/ripple-button';
import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const STATUS_COLORS = {
    CONFIRMED: 'bg-blue-100 text-blue-800',
    ORDER_PICKED: 'bg-orange-100 text-orange-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    // Legacy (for old orders)
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-indigo-100 text-indigo-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
    CONFIRMED: 'Confirmed',
    ORDER_PICKED: 'Order Packed',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    CANCELLED: 'Cancelled',
};

// What the admin can transition TO from each status (one-way)
// DELIVERED is not here — only delivery person can set it
const NEXT_STATUS = {
    CONFIRMED: 'ORDER_PICKED',
    ORDER_PICKED: 'SHIPPED',
};

const FILTER_STATUSES = ['CONFIRMED', 'ORDER_PICKED', 'SHIPPED', 'DELIVERED'];

const AdminOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
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

    const advanceStatus = async (orderId, nextStatus) => {
        setUpdatingId(orderId);
        try {
            const res = await fetch(`${API_URL}/orders/admin/${orderId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`
                },
                body: JSON.stringify({ status: nextStatus })
            });
            if (res.ok) {
                fetchOrders(); // Refresh to get updated assignment info too
            } else {
                const data = await res.json().catch(() => null);
                alert(data?.message || `Cannot update status`);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUpdatingId(null);
        }
    };

    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const getOrderItems = (o) => o.items || o.orderItems || [];

    const getStatusLabel = (status) => STATUS_LABELS[status] || status;

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
                    {FILTER_STATUSES.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="text-center p-10 animate-pulse text-gray-500">Loading orders...</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan="9" className="px-6 py-10 text-center text-gray-500">No orders found.</td>
                                </tr>
                            )}
                            {orders.map(o => {
                                const items = getOrderItems(o);
                                const isExpanded = expandedId === o.id;
                                const nextStatus = NEXT_STATUS[o.status];
                                return (
                                    <React.Fragment key={o.id}>
                                        <tr
                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                            onClick={() => setExpandedId(isExpanded ? null : o.id)}
                                        >
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                <div className="flex items-center gap-1.5">
                                                    <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                    {(o.orderNumber || o.id?.substring(0, 8))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {formatDate(o.createdAt)}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {o.user?.name || o.user?.phone || '—'}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {items.length}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                                                ₹{o.totalAmount || o.total || 0}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${o.paymentStatus === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {o.paymentStatus || '—'}
                                                </span>
                                                {o.paymentMethod && (
                                                    <span className="ml-1 text-xs text-gray-400">{o.paymentMethod}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-800'}`}>
                                                    {getStatusLabel(o.status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm">
                                                {o.assignment ? (
                                                    <span className="text-xs text-green-700 font-medium">
                                                        {o.assignment.deliveryPerson?.name || 'Assigned'}
                                                    </span>
                                                ) : o.status === 'ORDER_PICKED' || o.status === 'SHIPPED' ? (
                                                    <span className="text-xs text-orange-600 animate-pulse">Searching...</span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm" onClick={e => e.stopPropagation()}>
                                                {nextStatus ? (
                                                    <RippleButton
                                                        onClick={() => advanceStatus(o.id, nextStatus)}
                                                        disabled={updatingId === o.id}
                                                        className="px-3 py-1.5 text-xs bg-ud-primary text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-medium"
                                                    >
                                                        {updatingId === o.id ? '...' : getStatusLabel(nextStatus)}
                                                    </RippleButton>
                                                ) : o.status === 'SHIPPED' ? (
                                                    <span className="text-xs text-gray-400 italic">Awaiting delivery</span>
                                                ) : o.status === 'DELIVERED' ? (
                                                    <span className="text-xs text-green-600 font-medium">Complete</span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                        </tr>
                                        {isExpanded && items.length > 0 && (
                                            <tr>
                                                <td colSpan="9" className="px-0 py-0">
                                                    <div className="bg-gray-50 border-t border-b border-gray-200 px-10 py-3">
                                                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Order Items</p>
                                                        <div className="space-y-1.5">
                                                            {items.map((item, idx) => (
                                                                <div key={item.id || idx} className="flex items-center justify-between bg-white rounded-lg px-4 py-2 border border-gray-100">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                                                        <p className="text-xs text-gray-400">Qty: {item.quantity} × ₹{item.price}</p>
                                                                    </div>
                                                                    <span className="text-sm font-bold text-gray-800 ml-4">₹{item.total || (item.price * item.quantity)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-3 pt-2 border-t border-gray-200 flex justify-end gap-6 text-xs text-gray-500">
                                                            {o.subtotal != null && <span>Subtotal: <b className="text-gray-700">₹{o.subtotal}</b></span>}
                                                            {o.deliveryFee != null && <span>Delivery: <b className="text-gray-700">{o.deliveryFee === 0 ? 'FREE' : `₹${o.deliveryFee}`}</b></span>}
                                                            {o.tax != null && <span>Tax: <b className="text-gray-700">₹{o.tax}</b></span>}
                                                            <span>Total: <b className="text-emerald-700 text-sm">₹{o.totalAmount || o.total || 0}</b></span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>

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
