/* eslint-disable react/prop-types */
import React from 'react';
import { RippleButton } from '../ui/ripple-button';
import { useState, useCallback } from 'react';
import { adminApi } from '../../lib/api';
import { getParcelStatusLabel, getParcelStatusColor } from '../../lib/status';
import { PARCEL_CATEGORIES } from '../../constants';
import { usePolling } from '../../hooks/usePolling';

const FILTER_STATUSES = [
    'PENDING', 'APPROVED', 'READY_FOR_PICKUP', 'ASSIGNED',
    'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED',
];

const getCategoryLabel = (val) => {
    const cat = PARCEL_CATEGORIES.find(c => c.value === val);
    return cat?.label || val;
};

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
const fmtAddr = (addr) => {
    if (!addr) return 'N/A';
    return [addr.houseNo, addr.street, addr.city].filter(Boolean).join(', ') || 'N/A';
};

const AdminParcelOrders = () => {
    const [parcels, setParcels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [approveModal, setApproveModal] = useState(null); // { id, parcelNumber }
    const [codAmount, setCodAmount] = useState('');
    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');
    const limit = 10;

    const fetchParcels = useCallback(async () => {
        try {
            const res = await adminApi().get('/admin/parcels', {
                params: { page, limit, ...(statusFilter && { status: statusFilter }) },
            });
            const data = res.data;
            const list = Array.isArray(data) ? data : (data.data || []);
            setParcels(list);
            if (data.meta?.totalPages) setTotalPages(data.meta.totalPages);
            else if (data.totalPages) setTotalPages(data.totalPages);
            else if (data.total) setTotalPages(Math.ceil(data.total / limit));
            setLoading(false);
            return list.some(p =>
                ['PENDING', 'APPROVED', 'READY_FOR_PICKUP', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(p.status)
            );
        } catch (err) {
            console.error(err);
            setLoading(false);
            return true;
        }
    }, [page, statusFilter]);

    usePolling(fetchParcels, 30000, true);

    const approveParcel = async () => {
        if (!approveModal) return;
        const amount = parseFloat(codAmount);
        if (isNaN(amount) || amount < 0) {
            setActionError('Please enter a valid COD amount');
            return;
        }
        setUpdatingId(approveModal.id);
        setActionError('');
        try {
            await adminApi().post(`/admin/parcels/${approveModal.id}/approve`, { codAmount: amount });
            setApproveModal(null);
            setCodAmount('');
            fetchParcels();
        } catch (err) {
            setActionError(err.response?.data?.message || 'Cannot approve parcel');
        } finally {
            setUpdatingId(null);
        }
    };

    const setReady = async (id) => {
        setUpdatingId(id);
        setActionError('');
        try {
            await adminApi().post(`/admin/parcels/${id}/ready`);
            fetchParcels();
        } catch (err) {
            setActionError(err.response?.data?.message || 'Cannot set ready');
        } finally {
            setUpdatingId(null);
        }
    };

    const triggerAssign = async (id) => {
        setUpdatingId(id);
        setActionError('');
        try {
            const res = await adminApi().post(`/admin/parcels/${id}/assign-delivery`);
            setActionSuccess(res.data?.message || 'Assignment triggered');
            fetchParcels();
        } catch (err) {
            setActionError(err.response?.data?.message || 'Cannot trigger assignment');
        } finally {
            setUpdatingId(null);
        }
    };

    const cancelParcel = async (id) => {
        if (!confirm('Are you sure you want to cancel this parcel?')) return;
        setUpdatingId(id);
        setActionError('');
        try {
            await adminApi().patch(`/admin/parcels/${id}/status`, { status: 'CANCELLED' });
            fetchParcels();
        } catch (err) {
            setActionError(err.response?.data?.message || 'Cannot cancel parcel');
        } finally {
            setUpdatingId(null);
        }
    };

    const renderActions = (p) => {
        const busy = updatingId === p.id;
        switch (p.status) {
            case 'PENDING':
                return (
                    <div className="flex items-center gap-1.5">
                        <RippleButton
                            onClick={() => { setApproveModal({ id: p.id, parcelNumber: p.parcelNumber }); setCodAmount(''); }}
                            disabled={busy}
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                        >
                            Approve
                        </RippleButton>
                        <button onClick={() => cancelParcel(p.id)} disabled={busy}
                            className="px-2 py-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 font-medium">
                            Cancel
                        </button>
                    </div>
                );
            case 'APPROVED':
                return (
                    <div className="flex items-center gap-1.5">
                        <RippleButton
                            onClick={() => setReady(p.id)}
                            disabled={busy}
                            className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                        >
                            {busy ? '...' : 'Ready for Pickup'}
                        </RippleButton>
                        <button onClick={() => cancelParcel(p.id)} disabled={busy}
                            className="px-2 py-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 font-medium">
                            Cancel
                        </button>
                    </div>
                );
            case 'READY_FOR_PICKUP':
                return (
                    <div className="flex items-center gap-1.5">
                        <RippleButton
                            onClick={() => triggerAssign(p.id)}
                            disabled={busy}
                            className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                        >
                            {busy ? '...' : 'Find Rider'}
                        </RippleButton>
                        <button onClick={() => cancelParcel(p.id)} disabled={busy}
                            className="px-2 py-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 font-medium">
                            Cancel
                        </button>
                    </div>
                );
            case 'ASSIGNED':
            case 'PICKED_UP':
            case 'IN_TRANSIT':
                return (
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-400 italic">In progress</span>
                        <button onClick={() => cancelParcel(p.id)} disabled={busy}
                            className="px-2 py-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 font-medium">
                            Cancel
                        </button>
                    </div>
                );
            case 'DELIVERED':
                return <span className="text-xs text-green-600 font-medium">Complete</span>;
            case 'CANCELLED':
                return <span className="text-xs text-red-500 font-medium">Cancelled</span>;
            default:
                return <span className="text-xs text-gray-400">—</span>;
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Parcel Orders</h1>
                <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-ud-primary"
                >
                    <option value="">All Statuses</option>
                    {FILTER_STATUSES.map(s => <option key={s} value={s}>{getParcelStatusLabel(s)}</option>)}
                </select>
            </div>

            {actionError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between items-center">
                    <span>{actionError}</span>
                    <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
                </div>
            )}
            {actionSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex justify-between items-center">
                    <span>{actionSuccess}</span>
                    <button onClick={() => setActionSuccess('')} className="text-green-400 hover:text-green-600 ml-2">&times;</button>
                </div>
            )}

            {loading ? (
                <div className="text-center p-10 animate-pulse text-gray-500">Loading parcels...</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parcel #</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date / Time</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">COD</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rider</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {parcels.length === 0 && (
                                    <tr>
                                        <td colSpan="10" className="px-6 py-10 text-center text-gray-500">No parcel orders found.</td>
                                    </tr>
                                )}
                                {parcels.map(p => {
                                    const isExpanded = expandedId === p.id;
                                    const pickup = p.pickupAddress || {};
                                    const drop = p.dropAddress || {};
                                    return (
                                        <React.Fragment key={p.id}>
                                            <tr
                                                className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                onClick={() => setExpandedId(isExpanded ? null : p.id)}
                                            >
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    <div className="flex items-center gap-1.5">
                                                        <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                        {p.parcelNumber || p.id?.substring(0, 8)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    <div className="font-medium text-gray-700">{formatDate(p.createdAt)}</div>
                                                    <div className="text-[11px] text-gray-400">{formatTime(p.createdAt)}</div>
                                                    {p.deliveredAt && (
                                                        <div className="mt-2 pt-1.5 border-t border-gray-100">
                                                            <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter mb-0.5">Delivered At</p>
                                                            <p className="text-[11px] font-semibold text-emerald-700 leading-none">{formatDate(p.deliveredAt)}</p>
                                                            <p className="text-[10px] text-emerald-500/80 mt-1">{formatTime(p.deliveredAt)}</p>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {p.user?.name || p.user?.phone || '—'}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {getCategoryLabel(p.category)}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {p.weight} kg
                                                </td>
                                                <td className="px-4 py-4 text-sm text-gray-500 max-w-[200px]">
                                                    <div className="truncate" title={fmtAddr(pickup)}>
                                                        <span className="text-emerald-600 font-medium">P:</span> {fmtAddr(pickup)}
                                                    </div>
                                                    <div className="truncate" title={fmtAddr(drop)}>
                                                        <span className="text-red-500 font-medium">D:</span> {fmtAddr(drop)}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                                                    {p.codAmount != null ? `₹${p.codAmount}` : '—'}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getParcelStatusColor(p.status)}`}>
                                                        {getParcelStatusLabel(p.status)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                                    {p.assignment?.deliveryPerson ? (
                                                        <span className="text-xs text-green-700 font-medium">
                                                            {p.assignment.deliveryPerson.name}
                                                        </span>
                                                    ) : p.notDeliveredReason ? (
                                                        <span className="text-xs text-red-600 font-medium" title={p.notDeliveredReason}>
                                                            Delivery failed
                                                        </span>
                                                    ) : p.status === 'ASSIGNED' ? (
                                                        <span className="text-xs text-orange-600 animate-pulse">Searching...</span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm" onClick={e => e.stopPropagation()}>
                                                    {renderActions(p)}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan="10" className="px-0 py-0">
                                                        <div className="bg-gray-50 border-t border-b border-gray-200 px-10 py-4 space-y-3">
                                                            {/* Addresses */}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Pickup Address</p>
                                                                    <div className="bg-white rounded-lg p-3 border border-gray-100 text-sm text-gray-700">
                                                                        <p>{pickup.houseNo && `${pickup.houseNo}, `}{pickup.street}</p>
                                                                        <p>{[pickup.city, pickup.state, pickup.pincode].filter(Boolean).join(', ')}</p>
                                                                        {pickup.landmark && <p className="text-xs text-gray-400">Landmark: {pickup.landmark}</p>}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Drop Address</p>
                                                                    <div className="bg-white rounded-lg p-3 border border-gray-100 text-sm text-gray-700">
                                                                        <p>{drop.houseNo && `${drop.houseNo}, `}{drop.street}</p>
                                                                        <p>{[drop.city, drop.state, drop.pincode].filter(Boolean).join(', ')}</p>
                                                                        {drop.landmark && <p className="text-xs text-gray-400">Landmark: {drop.landmark}</p>}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Details */}
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Parcel Details</p>
                                                                <div className="grid grid-cols-4 gap-2">
                                                                    <div className="bg-white rounded-lg p-2 border border-gray-100 text-xs">
                                                                        <p className="text-gray-400">Category</p>
                                                                        <p className="font-medium text-gray-700">{getCategoryLabel(p.category)}</p>
                                                                        {p.categoryOther && <p className="text-gray-400 mt-0.5">{p.categoryOther}</p>}
                                                                    </div>
                                                                    <div className="bg-white rounded-lg p-2 border border-gray-100 text-xs">
                                                                        <p className="text-gray-400">Weight</p>
                                                                        <p className="font-medium text-gray-700">{p.weight} kg</p>
                                                                    </div>
                                                                    <div className="bg-white rounded-lg p-2 border border-gray-100 text-xs">
                                                                        <p className="text-gray-400">Dimensions</p>
                                                                        <p className="font-medium text-gray-700">
                                                                            {p.length && p.width && p.height
                                                                                ? `${p.length}×${p.width}×${p.height} cm`
                                                                                : 'N/A'}
                                                                        </p>
                                                                    </div>
                                                                    <div className="bg-white rounded-lg p-2 border border-gray-100 text-xs">
                                                                        <p className="text-gray-400">COD Amount</p>
                                                                        <p className="font-medium text-gray-700">
                                                                            {p.codAmount != null ? `₹${p.codAmount}` : 'Not set'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Schedule */}
                                                            <div>
                                                                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Schedule</p>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div className="bg-blue-50 rounded-lg p-2 text-xs">
                                                                        <p className="text-blue-400">Pickup</p>
                                                                        <p className="font-medium text-blue-700">{formatDate(p.pickupTime)} {formatTime(p.pickupTime)}</p>
                                                                    </div>
                                                                    <div className="bg-orange-50 rounded-lg p-2 text-xs">
                                                                        <p className="text-orange-400">Drop</p>
                                                                        <p className="font-medium text-orange-700">{formatDate(p.dropTime)} {formatTime(p.dropTime)}</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* NOT_DELIVERED warning */}
                                                            {p.notDeliveredReason && (
                                                                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                                                                    <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                                                    </svg>
                                                                    <div>
                                                                        <p className="text-xs font-bold text-red-700">Delivery attempt failed</p>
                                                                        <p className="text-xs text-red-600 mt-0.5">{p.notDeliveredReason}</p>
                                                                        {p.notDeliveredAt && (
                                                                            <p className="text-xs text-red-400 mt-0.5">{new Date(p.notDeliveredAt).toLocaleString('en-IN')}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Rider info */}
                                                            {p.assignment?.deliveryPerson && (
                                                                <div>
                                                                    <p className="text-xs font-bold text-gray-500 uppercase mb-1">Assigned Rider</p>
                                                                    <div className="bg-purple-50 rounded-lg p-2 text-xs">
                                                                        <span className="font-medium text-purple-700">
                                                                            {p.assignment.deliveryPerson.name} ({p.assignment.deliveryPerson.phone})
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

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

            {/* Approve Modal */}
            {approveModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setApproveModal(null)}>
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Approve Parcel</h3>
                        <p className="text-sm text-gray-500 mb-4">{approveModal.parcelNumber}</p>
                        <label className="block text-sm font-medium text-gray-700 mb-1">COD Amount (₹)</label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={codAmount}
                            onChange={e => setCodAmount(e.target.value)}
                            placeholder="Enter COD amount"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setApproveModal(null)}
                                className="flex-1 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <RippleButton
                                onClick={approveParcel}
                                disabled={updatingId === approveModal.id}
                                className="flex-1 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {updatingId === approveModal.id ? 'Approving...' : 'Approve'}
                            </RippleButton>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminParcelOrders;
