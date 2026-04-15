/* eslint-disable react/prop-types */
import React from 'react';
import { RippleButton } from '../ui/ripple-button';
import { useState, useCallback } from 'react';
import { adminApi } from '../../lib/api';
import { getStatusLabel, getStatusColor } from '../../lib/status';
import { usePolling } from '../../hooks/usePolling';
import { Store } from 'lucide-react';

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
    const [assigningOrder, setAssigningOrder] = useState(null);
    const [assignmentType, setAssignmentType] = useState(null);
    const [isAssigning, setIsAssigning] = useState(false);
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

    const manualAssign = async (orderId, riderId) => {
        setUpdatingId(orderId);
        setIsAssigning(true);
        setActionError('');
        try {
            await adminApi().post(`/orders/admin/${orderId}/manual-assign`, { deliveryPersonId: riderId });
            fetchOrders();
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to assign rider';
            setActionError(msg);
            throw err; // re-throw so modal can clear pendingRiderId
        } finally {
            setUpdatingId(null);
            setIsAssigning(false);
        }
    };

    const handleAutoAssign = async (orderId) => {
        try {
            setUpdatingId(orderId);
            const res = await adminApi().post(`/orders/admin/${orderId}/assign-delivery`, {});
            alert(res.data.message || 'Automatic assignment triggered successfully');
            fetchOrders();
        } catch (err) {
            console.error(err);
            setActionError(err.response?.data?.message || 'Failed to trigger automatic assignment');
        } finally {
            setUpdatingId(null);
        }
    };

    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    const getOrderItems = (o) => o.items || o.orderItems || [];


    const latestAssigningOrder = React.useMemo(() => {
        if (!assigningOrder) return null;
        for (const o of orders) {
            if (o.id === assigningOrder.id) return o;
            if (o.subOrders) {
                const child = o.subOrders.find(s => s.id === assigningOrder.id);
                if (child) return child;
            }
        }
        return assigningOrder;
    }, [orders, assigningOrder]);

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
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date / Time</th>
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
                                                <div className="font-medium text-gray-700">{formatDate(o.createdAt)}</div>
                                                <div className="text-[11px] text-gray-400">{formatTime(o.createdAt)}</div>
                                                {o.deliveredAt && (
                                                    <div className="mt-2 pt-1.5 border-t border-gray-100">
                                                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter mb-0.5">Delivered At</p>
                                                        <p className="text-[11px] font-semibold text-emerald-700 leading-none">{formatDate(o.deliveredAt)}</p>
                                                        <p className="text-[10px] text-emerald-500/80 mt-1">{formatTime(o.deliveredAt)}</p>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="font-medium text-gray-900">{o.user?.name || '—'}</div>
                                                <div className="text-[11px] text-blue-600 font-medium">{o.user?.phone}</div>
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
                                                ) : (
                                                     <div className="flex flex-col gap-1">
                                                         {o.notDeliveredReason && (
                                                            <span className="text-[10px] text-red-600 font-bold uppercase tracking-tighter leading-none mb-1">
                                                                Delivery failed
                                                            </span>
                                                         )}
                                                         {['CONFIRMED', 'PROCESSING', 'ORDER_PICKED', 'SHIPPED'].includes(o.status) ? (
                                                             <div className="flex items-center gap-3">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleAutoAssign(o.id); }}
                                                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline underline-offset-2"
                                                                >
                                                                    Auto
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); setAssigningOrder(o); setAssignmentType('MANUAL'); }}
                                                                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-800 underline underline-offset-2"
                                                                >
                                                                    Manual
                                                                </button>
                                                             </div>
                                                         ) : (
                                                             <span className="text-xs text-gray-400">—</span>
                                                         )}
                                                     </div>
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
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                                                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center text-xs text-gray-500 font-semibold bg-gray-50/50">
                                                                    <span>STORE</span>
                                                                    <span>RIDER ASSIGNMENT</span>
                                                                </div>
                                                                {o.childOrders.map(child => (
                                                                    <div key={child.id} className="border-b border-gray-50 last:border-none">
                                                                        {/* Store header + rider */}
                                                                        <div className="px-6 py-3 flex justify-between items-center hover:bg-gray-50/30 transition-colors">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                                                                                    <Store className="w-4 h-4 text-emerald-600" />
                                                                                </div>
                                                                                <div>
                                                                                    <div className="text-sm font-semibold text-gray-900">{child.storeTypeName || `Store ${child.id.substring(0, 4)}`}</div>
                                                                                    <div className="text-[11px] text-gray-500 flex items-center gap-2">
                                                                                        {child.items.length} item{child.items.length !== 1 ? 's' : ''}
                                                                                        {child.deliveredAt && (
                                                                                            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                                                                                Delivered: {formatTime(child.deliveredAt)}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                {child.assignment ? (
                                                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full border border-green-100">
                                                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                                                                        <span className="text-xs font-bold">{child.assignment.deliveryPerson?.name}</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="flex flex-col gap-2">
                                                                                        {['CONFIRMED', 'PROCESSING', 'ORDER_PICKED', 'SHIPPED'].includes(child.status) && (
                                                                                            <div className="flex items-center gap-3">
                                                                                                <button
                                                                                                    onClick={() => handleAutoAssign(child.id)}
                                                                                                    className="px-3 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-bold hover:bg-blue-100 transition-colors border border-blue-200"
                                                                                                >
                                                                                                    Auto
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() => { setAssigningOrder(child); setAssignmentType('MANUAL'); }}
                                                                                                    className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold hover:bg-emerald-100 transition-colors border border-emerald-200"
                                                                                                >
                                                                                                    Manual
                                                                                                </button>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {/* Items for this sub-order */}
                                                                        <div className="px-6 pb-3 space-y-1.5">
                                                                            {child.items.map((item, idx) => (
                                                                                <div key={item.id || idx} className="bg-white rounded-lg px-4 py-2 border border-gray-100">
                                                                                    <div className="flex items-center justify-between">
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                                                                                {item.variantLabel && (
                                                                                                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold uppercase ring-1 ring-emerald-100">
                                                                                                        {item.variantLabel}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
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
                                                                    </div>
                                                                ))}
                                                            </>
                                                        ) : (
                                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                                                <div className="lg:col-span-1">
                                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Customer & Delivery</p>
                                                                    <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                                                                        <div className="flex items-center gap-3 mb-4">
                                                                            <div className="w-10 h-10 rounded-full bg-ud-primary/10 flex items-center justify-center text-ud-primary font-bold text-sm">
                                                                                {(o.user?.name || 'U').charAt(0).toUpperCase()}
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-bold text-gray-800">{o.user?.name || 'Guest User'}</p>
                                                                                <p className="text-xs text-blue-600 font-medium">{o.user?.phone || 'No phone'}</p>
                                                                            </div>
                                                                        </div>

                                                                        {o.deliveryAddress && (
                                                                            <div className="pt-3 border-t border-gray-50">
                                                                                <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                    </svg>
                                                                                    Delivery Address
                                                                                </div>
                                                                                <div className="text-xs text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-100 italic">
                                                                                    {o.deliveryAddress.houseNo && <span className="font-bold text-gray-900 not-italic mr-1">{o.deliveryAddress.houseNo},</span>}
                                                                                    {o.deliveryAddress.street}
                                                                                    {o.deliveryAddress.landmark && (
                                                                                        <div className="mt-1 flex items-start gap-1 text-[11px] text-gray-500 italic">
                                                                                            <span className="font-bold text-orange-500 not-italic">Landmark:</span> {o.deliveryAddress.landmark}
                                                                                        </div>
                                                                                    )}
                                                                                    <div className="mt-1 font-medium text-gray-800 not-italic">
                                                                                        {o.deliveryAddress.city}, {o.deliveryAddress.state} {o.deliveryAddress.zipCode}
                                                                                    </div>
                                                                                </div>
                                                                                
                                                                                {(o.deliveryAddress.mapsLink || (o.deliveryAddress.lat && o.deliveryAddress.lng)) && (
                                                                                    <a 
                                                                                        href={o.deliveryAddress.mapsLink || `https://www.google.com/maps/search/?api=1&query=${o.deliveryAddress.lat},${o.deliveryAddress.lng}`}
                                                                                        target="_blank" 
                                                                                        rel="noopener noreferrer"
                                                                                        className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-all border border-blue-100"
                                                                                    >
                                                                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                                                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                                                                        </svg>
                                                                                        Open in Google Maps
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="lg:col-span-2">
                                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Order Items</p>
                                                                    <div className="space-y-1.5">
                                                                    {items.map((item, idx) => (
                                                                        <div key={item.id || idx} className="bg-white rounded-lg px-4 py-2 border border-gray-100">
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                                                                        {item.variantLabel && (
                                                                                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold uppercase ring-1 ring-emerald-100">
                                                                                                {item.variantLabel}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <p className="text-xs text-gray-400">Qty: {item.quantity} × ₹{item.price}</p>
                                                                                </div>
                                                                                <span className="text-sm font-bold text-gray-800 ml-4">₹{item.total || (item.price * item.quantity)}</span>
                                                                            </div>
                                                                            {(item.variantLabel || item.selectedSize || item.userUploadUrls?.length > 0 || item.printProductId) && (
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
                                                                </div>
                                                            </div>
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

            <RiderSelectionModal 
                isOpen={!!assigningOrder && assignmentType === 'MANUAL'}
                order={latestAssigningOrder}
                onClose={() => { setAssigningOrder(null); setAssignmentType(null); }}
                onAssign={(riderId) => manualAssign(latestAssigningOrder?.id, riderId)}
                isAssigning={isAssigning}
            />
        </div>
    );
};

// --- Modal Component ---
const RiderSelectionModal = ({ order, isOpen, onClose, onAssign, isAssigning }) => {
    const [riders, setRiders] = useState([]);
    const [loadingRiders, setLoadingRiders] = useState(true);
    const [pendingRiderId, setPendingRiderId] = useState(null); // which rider has a pending request

    const fetchRiders = useCallback(async () => {
        if (!isOpen || !order) return;
        setLoadingRiders(true);
        try {
            const res = await adminApi().get('/delivery/persons');
            setRiders(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch riders:', err);
        } finally {
            setLoadingRiders(false);
        }
    }, [isOpen, order]);

    React.useEffect(() => {
        if (isOpen) {
            fetchRiders();
            setPendingRiderId(null);
        }
    }, [isOpen, fetchRiders]);

    React.useEffect(() => {
        if (!order || !isOpen) return;

        // If an assignment exists and is accepted, assignment is complete
        if (order.assignment && order.assignment.acceptedAt) {
            onClose();
        } 
        // If pendingRiderId is set, but the assignment vanished (was rejected and deleted from DB)
        else if (pendingRiderId && !order.assignment) {
            setPendingRiderId(null);
        }
    }, [order, pendingRiderId, isOpen, onClose]);

    if (!isOpen) return null;

    const handleAssign = async (riderId) => {
        setPendingRiderId(riderId);
        try {
            await onAssign(riderId);
            // On success, parent closes the modal
        } catch {
            // On error, unlock all riders so admin can try another
            setPendingRiderId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="font-bold text-gray-900">Manual Delivery Assignment</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">Order #{order.orderNumber || order.id?.substring(0, 8)}</p>
                    </div>
                    <button onClick={onClose} disabled={isAssigning} className="text-gray-400 hover:text-gray-600 text-2xl transition-colors disabled:opacity-40">&times;</button>
                </div>

                {/* Pending notice */}
                {pendingRiderId && (
                    <div className="mx-4 mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5">
                        <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        <p className="text-xs font-semibold text-amber-700">
                            Request sent — waiting for rider to accept or reject. Other riders are locked until they respond.
                        </p>
                    </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {loadingRiders ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-8 h-8 border-2 border-ud-primary/20 border-t-ud-primary rounded-full animate-spin"></div>
                            <p className="text-sm text-gray-500 font-medium">Loading delivery partners...</p>
                        </div>
                    ) : riders.length === 0 ? (
                        <div className="py-16 text-center flex flex-col items-center gap-2">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <p className="text-sm text-gray-400 italic">No registered delivery partners found.</p>
                        </div>
                    ) : (
                        riders.map(rider => {
                            const isPending = pendingRiderId === rider.id;
                            const isLocked = !!pendingRiderId && !isPending;
                            return (
                                <div
                                    key={rider.id}
                                    className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                        isPending ? 'border-amber-300 bg-amber-50' :
                                        isLocked ? 'border-gray-100 bg-gray-50 opacity-50' :
                                        'border-gray-100 hover:border-gray-200 hover:bg-gray-50/80'
                                    }`}
                                >
                                    {/* Rider info */}
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 flex-shrink-0">
                                            {(rider.name || 'R').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                                                {rider.name}
                                                {!rider.isActive && (
                                                    <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">Inactive</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-blue-600 font-medium">{rider.phone}</p>
                                            <span className={`mt-0.5 inline-block text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                                                rider.status === 'FREE' ? 'bg-emerald-50 text-emerald-600' :
                                                rider.status === 'BUSY' ? 'bg-amber-50 text-amber-600' :
                                                'bg-gray-100 text-gray-400'
                                            }`}>
                                                {rider.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action */}
                                    <div className="flex-shrink-0">
                                        {isPending ? (
                                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                                                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                                                Waiting...
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleAssign(rider.id)}
                                                disabled={isLocked || isAssigning}
                                                className="px-4 py-2 bg-ud-primary text-white text-xs font-bold rounded-lg hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                            >
                                                Assign
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-start gap-2">
                    <svg className="w-4 h-4 mt-0.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[10px] leading-relaxed italic text-gray-500">
                        Click Assign to send a request to a rider. While a request is pending, all other riders are locked.
                        Once the rider rejects, you can assign another.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminOrders;

