/* eslint-disable react/prop-types */
import React from 'react';
import { RippleButton } from '../ui/ripple-button';
import { useState, useCallback } from 'react';
import { adminApi } from '../../lib/api';
import { getStatusLabel, getStatusColor } from '../../lib/status';
import { usePolling } from '../../hooks/usePolling';

// What the admin can transition TO from each status (one-way)
// DELIVERED is not here — only delivery person can set it
const NEXT_STATUS = {
    CONFIRMED: 'PROCESSING',
    PROCESSING: 'ORDER_PICKED',
    ORDER_PICKED: 'SHIPPED',
};

const FILTER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'ORDER_PICKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const AdminOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [actionError, setActionError] = useState('');
    const limit = 10;

    const fetchOrders = useCallback(async () => {
        try {
            const res = await adminApi().get('/orders/admin/store', {
                params: { page, limit, ...(statusFilter && { status: statusFilter }) },
            });
            const data = res.data;
            const list = Array.isArray(data) ? data : (data.data || []);
            setOrders(list);
            if (data.meta?.totalPages) setTotalPages(data.meta.totalPages);
            else if (data.totalPages) setTotalPages(data.totalPages);
            else if (data.total) setTotalPages(Math.ceil(data.total / limit));
            setLoading(false);
            return list.some(o =>
                ['PENDING', 'CONFIRMED', 'ORDER_PICKED', 'SHIPPED'].includes(o.status)
            );
        } catch (err) {
            console.error(err);
            setLoading(false);
            return true;
        }
    }, [page, statusFilter]);

    usePolling(fetchOrders, 30000, true);

    const advanceStatus = async (orderId, nextStatus) => {
        setUpdatingId(orderId);
        setActionError('');
        try {
            await adminApi().patch(`/orders/admin/${orderId}/status`, { status: nextStatus });
            fetchOrders();
        } catch (err) {
            setActionError(err.response?.data?.message || 'Cannot update status');
        } finally {
            setUpdatingId(null);
        }
    };

    const cancelOrder = async (orderId) => {
        if (!confirm('Are you sure you want to cancel this order?')) return;
        setUpdatingId(orderId);
        setActionError('');
        try {
            await adminApi().patch(`/orders/admin/${orderId}/status`, { status: 'CANCELLED' });
            fetchOrders();
        } catch (err) {
            setActionError(err.response?.data?.message || 'Cannot cancel order');
        } finally {
            setUpdatingId(null);
        }
    };

    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    const getOrderItems = (o) => o.items || o.orderItems || [];


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

            {actionError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between items-center">
                    <span>{actionError}</span>
                    <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
                </div>
            )}

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
                                                    {o.isParent && (
                                                        <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-bold">
                                                            {o.childOrders?.length || 0} stores
                                                        </span>
                                                    )}
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
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(o.status)}`}>
                                                    {getStatusLabel(o.status)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm">
                                                {o.assignment ? (
                                                    <span className="text-xs text-green-700 font-medium">
                                                        {o.assignment.deliveryPerson?.name || 'Assigned'}
                                                    </span>
                                                ) : o.notDeliveredReason ? (
                                                    <span className="text-xs text-red-600 font-medium" title={o.notDeliveredReason}>
                                                        Delivery failed
                                                    </span>
                                                ) : o.status === 'ORDER_PICKED' || o.status === 'SHIPPED' ? (
                                                    <span className="text-xs text-orange-600 animate-pulse">Searching...</span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1.5">
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
                                                    ) : o.status === 'CANCELLED' ? (
                                                        <span className="text-xs text-red-500 font-medium">Cancelled</span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    )}
                                                    {!['DELIVERED', 'CANCELLED'].includes(o.status) && (
                                                        <button
                                                            onClick={() => cancelOrder(o.id)}
                                                            disabled={updatingId === o.id}
                                                            className="px-2 py-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 font-medium"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="9" className="px-0 py-0">
                                                    <div className="bg-gray-50 border-t border-b border-gray-200 px-10 py-3">
                                                        {/* NOT_DELIVERED warning */}
                                                        {o.notDeliveredReason && (
                                                            <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                                                                <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                                </svg>
                                                                <div>
                                                                    <p className="text-xs font-bold text-red-700">Delivery attempt failed</p>
                                                                    <p className="text-xs text-red-600 mt-0.5">{o.notDeliveredReason}</p>
                                                                    {o.notDeliveredAt && (
                                                                        <p className="text-xs text-red-400 mt-0.5">{new Date(o.notDeliveredAt).toLocaleString('en-IN')}</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {o.isParent && (!o.childOrders || o.childOrders.length === 0) ? (
                                                            <p className="text-xs text-gray-400 py-2">Sub-orders loading...</p>
                                                        ) : o.isParent && o.childOrders?.length > 0 ? (
                                                            <>
                                                                <p className="text-xs font-bold text-blue-600 uppercase mb-2">Sub-orders ({o.childOrders?.length || 0} stores)</p>
                                                                <div className="space-y-3">
                                                                    {o.childOrders?.map((child) => {
                                                                        const childItems = child.items || [];
                                                                        const childNext = NEXT_STATUS[child.status];
                                                                        return (
                                                                            <div key={child.id} className="bg-white rounded-lg border border-gray-200 p-3">
                                                                                <div className="flex justify-between items-center mb-2">
                                                                                    <span className="text-xs font-bold text-gray-700">#{child.orderNumber}</span>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${getStatusColor(child.status)}`}>
                                                                                            {getStatusLabel(child.status)}
                                                                                        </span>
                                                                                        {childNext && (
                                                                                            <RippleButton
                                                                                                onClick={(e) => { e.stopPropagation(); advanceStatus(child.id, childNext); }}
                                                                                                disabled={updatingId === child.id}
                                                                                                className="px-2 py-1 text-[10px] bg-ud-primary text-white rounded hover:bg-emerald-600 disabled:opacity-50 font-medium"
                                                                                            >
                                                                                                {updatingId === child.id ? '...' : getStatusLabel(childNext)}
                                                                                            </RippleButton>
                                                                                        )}
                                                                                        {!['DELIVERED', 'CANCELLED'].includes(child.status) && (
                                                                                            <button
                                                                                                onClick={(e) => { e.stopPropagation(); cancelOrder(child.id); }}
                                                                                                disabled={updatingId === child.id}
                                                                                                className="px-2 py-1 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 font-medium"
                                                                                            >
                                                                                                Cancel
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                {child.assignment?.deliveryPerson && (
                                                                                    <p className="text-[11px] text-green-700 mb-1.5">Delivery: {child.assignment.deliveryPerson.name}</p>
                                                                                )}
                                                                                <div className="space-y-1">
                                                                                    {childItems.map((item, idx) => (
                                                                                        <div key={item.id || idx} className="text-xs">
                                                                                            <div className="flex justify-between">
                                                                                                <span className="text-gray-700">{item.name} <span className="text-gray-400">×{item.quantity}</span></span>
                                                                                                <span className="font-medium text-gray-800">₹{item.total || (item.price * item.quantity)}</span>
                                                                                            </div>
                                                                                            {(item.selectedSize || item.userUploadUrls?.length > 0) && (
                                                                                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                                                                    {item.printProductId && (
                                                                                                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-medium">Custom Print</span>
                                                                                                    )}
                                                                                                    {item.selectedSize && (
                                                                                                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">Size: {item.selectedSize}</span>
                                                                                                    )}
                                                                                                    {item.userUploadUrls?.map((url, ui) => (
                                                                                                        <a key={ui} href={url} target="_blank" rel="noopener noreferrer" className="inline-block w-8 h-8 rounded border border-gray-200 overflow-hidden hover:ring-2 hover:ring-blue-400">
                                                                                                            <img src={url} alt={`Upload ${ui + 1}`} className="w-full h-full object-cover" />
                                                                                                        </a>
                                                                                                    ))}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                                <div className="mt-1.5 pt-1 border-t border-gray-100 text-right text-xs font-bold text-gray-700">
                                                                                    ₹{child.subtotal || 0}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">Order Items</p>
                                                                <div className="space-y-1.5">
                                                                    {items.map((item, idx) => (
                                                                        <div key={item.id || idx} className="bg-white rounded-lg px-4 py-2 border border-gray-100">
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                                                                    <p className="text-xs text-gray-400">Qty: {item.quantity} × ₹{item.price}</p>
                                                                                </div>
                                                                                <span className="text-sm font-bold text-gray-800 ml-4">₹{item.total || (item.price * item.quantity)}</span>
                                                                            </div>
                                                                            {(item.selectedSize || item.userUploadUrls?.length > 0 || item.printProductId) && (
                                                                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                                                    {item.printProductId && (
                                                                                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium">Custom Print</span>
                                                                                    )}
                                                                                    {item.selectedSize && (
                                                                                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">Size: {item.selectedSize}</span>
                                                                                    )}
                                                                                    {item.userUploadUrls?.map((url, ui) => (
                                                                                        <a key={ui} href={url} target="_blank" rel="noopener noreferrer" className="inline-block w-10 h-10 rounded border border-gray-200 overflow-hidden hover:ring-2 hover:ring-blue-400 transition-all">
                                                                                            <img src={url} alt={`Upload ${ui + 1}`} className="w-full h-full object-cover" />
                                                                                        </a>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
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
