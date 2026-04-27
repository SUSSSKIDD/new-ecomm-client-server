import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { api, API_URL } from '../../../lib/api';
import { getParcelStatusLabel, getParcelStatusColor } from '../../../lib/status';
import { PARCEL_CATEGORIES } from '../../../constants';
import { usePolling } from '../../../hooks/usePolling';
import { Capacitor } from '@capacitor/core';

const ParcelOrderList = () => {
    const { token } = useAuth();
    const [parcels, setParcels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cancellingId, setCancellingId] = useState(null);
    const [cancelError, setCancelError] = useState('');

    const fetchParcels = useCallback(async () => {
        try {
            const res = await api(token).get('/parcels?limit=20');
            setParcels(res.data.data || []);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { fetchParcels(); }, [fetchParcels]);

    usePolling(fetchParcels, 8000, !!token && Capacitor.isNativePlatform());

    // Real-time SSE updates for parcels (Web only)
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
                    if (type === 'PARCEL_STATUS_UPDATED') {
                        setParcels((prev) => prev.map((p) => 
                            p.id === data.parcelId ? { ...p, status: data.status } : p
                        ));
                    }
                } catch (err) {
                    console.error('SSE parse error:', err);
                }
            };

            eventSource.onerror = () => {
                eventSource.close();
                reconnectTimeout.current = setTimeout(connect, 5000);
            };
        };

        connect();

        return () => {
            if (eventSource) eventSource.close();
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
        };
    }, [token]);

    const handleCancel = async (id) => {
        if (!confirm('Cancel this parcel booking?')) return;
        setCancellingId(id);
        setCancelError('');
        try {
            await api(token).post(`/parcels/${id}/cancel`);
            fetchParcels();
        } catch (err) {
            setCancelError(err.response?.data?.message || 'Failed to cancel');
        } finally {
            setCancellingId(null);
        }
    };

    const getCategoryLabel = (val) => {
        const cat = PARCEL_CATEGORIES.find(c => c.value === val);
        return cat?.label || val;
    };

    const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ud-primary" />
            </div>
        );
    }

    if (parcels.length === 0) {
        return (
            <div className="text-center py-12 px-4">
                <span className="text-4xl">📦</span>
                <p className="text-gray-500 mt-2 text-sm">No parcel bookings yet</p>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto px-4 pb-8 space-y-3">
            {cancelError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between items-center">
                    <span>{cancelError}</span>
                    <button onClick={() => setCancelError('')} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
                </div>
            )}
            {parcels.map(parcel => {
                const pickupAddr = parcel.pickupAddress || {};
                const dropAddr = parcel.dropAddress || {};
                const canCancel = parcel.status === 'PENDING' || parcel.status === 'APPROVED';

                return (
                    <div key={parcel.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-900">{parcel.parcelNumber}</span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getParcelStatusColor(parcel.status)}`}>
                                {getParcelStatusLabel(parcel.status)}
                            </span>
                        </div>

                        {/* Delivery PIN — visible only for active parcels */}
                        {parcel.deliveryPin && parcel.status !== 'DELIVERED' && parcel.status !== 'CANCELLED' && (
                            <div className="bg-purple-50 border border-purple-100 rounded-lg p-2.5 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest leading-none">Security PIN</p>
                                    <p className="text-[10px] text-purple-500 mt-1">Share with the delivery agent only at drop-off</p>
                                </div>
                                <div className="flex gap-1">
                                    {parcel.deliveryPin.split('').map((digit, i) => (
                                        <span key={i} className="w-7 h-8 bg-white border border-purple-200 rounded flex items-center justify-center text-base font-black text-purple-700 shadow-sm">
                                            {digit}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Route summary */}
                        <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center pt-1">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <div className="w-0.5 h-8 bg-gray-200" />
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <div>
                                    <p className="text-xs text-gray-400">PICKUP</p>
                                    <p className="text-sm text-gray-700">{[pickupAddr.houseNo, pickupAddr.street, pickupAddr.city].filter(Boolean).join(', ') || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">DROP</p>
                                    <p className="text-sm text-gray-700">{[dropAddr.houseNo, dropAddr.street, dropAddr.city].filter(Boolean).join(', ') || 'N/A'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Details */}
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-gray-50 rounded-lg p-2">
                                <p className="text-gray-400">Category</p>
                                <p className="font-medium text-gray-700">{getCategoryLabel(parcel.category)}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2">
                                <p className="text-gray-400">Weight</p>
                                <p className="font-medium text-gray-700">{parcel.weight} kg</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2">
                                <p className="text-gray-400">COD</p>
                                <p className="font-medium text-gray-700">{parcel.codAmount != null ? `₹${parcel.codAmount}` : 'TBD'}</p>
                            </div>
                        </div>

                        {/* Schedule */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-blue-50 rounded-lg p-2">
                                <p className="text-blue-400">Pickup</p>
                                <p className="font-medium text-blue-700">{formatDate(parcel.pickupTime)} {formatTime(parcel.pickupTime)}</p>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-2">
                                <p className="text-orange-400">Drop</p>
                                <p className="font-medium text-orange-700">{formatDate(parcel.dropTime)} {formatTime(parcel.dropTime)}</p>
                            </div>
                        </div>

                        {/* Rider info */}
                        {parcel.assignment?.deliveryPerson && (
                            <div className="bg-purple-50 rounded-lg p-2 text-xs flex items-center gap-2">
                                <span className="text-purple-400">Rider:</span>
                                <span className="font-medium text-purple-700">{parcel.assignment.deliveryPerson.name} ({parcel.assignment.deliveryPerson.phone})</span>
                            </div>
                        )}

                        {/* Cancel button */}
                        {canCancel && (
                            <button
                                onClick={() => handleCancel(parcel.id)}
                                disabled={cancellingId === parcel.id}
                                className="w-full py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                {cancellingId === parcel.id ? 'Cancelling...' : 'Cancel Booking'}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ParcelOrderList;
