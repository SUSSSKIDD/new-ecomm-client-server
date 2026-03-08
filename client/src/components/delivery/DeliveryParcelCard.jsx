import { RippleButton } from '../ui/ripple-button';
import { useState, memo } from 'react';
import { PARCEL_CATEGORIES } from '../../constants';

const getCategoryLabel = (val) => {
    const cat = PARCEL_CATEGORIES.find(c => c.value === val);
    return cat?.label || val;
};

const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const DeliveryParcelCard = memo(({ assignment, onAccept, onReject, onComplete }) => {
    const { parcelOrder } = assignment;
    const isAccepted = !!assignment.acceptedAt;
    const [actionLoading, setActionLoading] = useState(null);
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState('');

    const openInMaps = (addr) => {
        if (addr?.lat && addr?.lng) {
            window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${addr.lat},${addr.lng}`,
                '_blank',
            );
        } else {
            const query = encodeURIComponent(
                `${addr?.street || ''}, ${addr?.city || ''}, ${addr?.pincode || ''}`,
            );
            window.open(`https://www.google.com/maps/search/${query}`, '_blank');
        }
    };

    const handleAction = async (action, callback) => {
        setActionLoading(action);
        try {
            await callback();
        } finally {
            setActionLoading(null);
        }
    };

    const handleNotDelivered = () => {
        setReason('');
        setReasonError('');
        setShowReasonModal(true);
    };

    const handleSubmitNotDelivered = async () => {
        const trimmed = reason.trim();
        if (trimmed.length < 5) {
            setReasonError('Please provide a reason (at least 5 characters)');
            return;
        }
        setShowReasonModal(false);
        await handleAction('not_delivered', () => onComplete(parcelOrder.id, 'NOT_DELIVERED', trimmed));
    };

    const pickup = parcelOrder.pickupAddress || {};
    const drop = parcelOrder.dropAddress || {};

    return (
        <>
            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 overflow-hidden border border-gray-100">
                {/* Header */}
                <div className={`px-4 py-3 flex items-center justify-between ${isAccepted
                    ? 'bg-gradient-to-r from-purple-500 to-violet-600'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500'
                    }`}>
                    <div>
                        <p className="text-white/70 text-xs font-medium">
                            {isAccepted ? 'Parcel' : 'New Parcel'}
                        </p>
                        <p className="text-white font-bold text-sm">{parcelOrder.parcelNumber}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-white/70 text-xs">COD</p>
                        <p className="text-white font-bold">
                            {parcelOrder.codAmount != null ? `₹${parcelOrder.codAmount}` : 'TBD'}
                        </p>
                    </div>
                </div>

                {/* Pending badge */}
                {!isAccepted && (
                    <div className="px-4 pt-3">
                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                            <span className="text-xs font-medium text-amber-700">Waiting for your response</span>
                        </div>
                    </div>
                )}

                {/* Parcel details */}
                <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Parcel Details</p>
                    <div className="flex gap-3 text-sm">
                        <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-lg text-xs font-medium">
                            {getCategoryLabel(parcelOrder.category)}
                        </span>
                        <span className="bg-gray-50 text-gray-700 px-2 py-1 rounded-lg text-xs font-medium">
                            {parcelOrder.weight} kg
                        </span>
                    </div>
                    {parcelOrder.pickupTime && (
                        <div className="mt-2 flex gap-4 text-xs text-gray-500">
                            <span>Pickup: <b className="text-gray-700">{formatDate(parcelOrder.pickupTime)} {formatTime(parcelOrder.pickupTime)}</b></span>
                            <span>Drop: <b className="text-gray-700">{formatDate(parcelOrder.dropTime)} {formatTime(parcelOrder.dropTime)}</b></span>
                        </div>
                    )}
                </div>

                {/* Pickup Address */}
                <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Pickup Address</p>
                    <p className="text-sm text-gray-700">
                        {pickup.houseNo && `${pickup.houseNo}, `}
                        {pickup.street}, {pickup.city} {pickup.pincode}
                    </p>
                    {pickup.landmark && (
                        <p className="text-xs text-gray-500 mt-0.5">Near: {pickup.landmark}</p>
                    )}
                    <RippleButton
                        onClick={() => openInMaps(pickup)}
                        className="mt-1.5 text-xs text-emerald-600 font-bold flex items-center gap-1 hover:text-emerald-700"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Navigate to Pickup
                    </RippleButton>
                </div>

                {/* Drop Address */}
                <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-bold text-red-500 uppercase mb-1">Drop Address</p>
                    <p className="text-sm text-gray-700">
                        {drop.houseNo && `${drop.houseNo}, `}
                        {drop.street}, {drop.city} {drop.pincode}
                    </p>
                    {drop.landmark && (
                        <p className="text-xs text-gray-500 mt-0.5">Near: {drop.landmark}</p>
                    )}
                    <RippleButton
                        onClick={() => openInMaps(drop)}
                        className="mt-1.5 text-xs text-red-500 font-bold flex items-center gap-1 hover:text-red-600"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Navigate to Drop
                    </RippleButton>
                </div>

                {/* Actions */}
                <div className="px-4 py-3">
                    {!isAccepted ? (
                        <div className="flex gap-2">
                            <RippleButton
                                onClick={() => handleAction('reject', () => onReject(parcelOrder.id))}
                                disabled={!!actionLoading}
                                className="flex-1 py-2.5 border-2 border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}
                            </RippleButton>
                            <RippleButton
                                onClick={() => handleAction('accept', () => onAccept(parcelOrder.id))}
                                disabled={!!actionLoading}
                                className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all disabled:opacity-50"
                            >
                                {actionLoading === 'accept' ? 'Accepting...' : 'Accept'}
                            </RippleButton>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <RippleButton
                                onClick={handleNotDelivered}
                                disabled={!!actionLoading}
                                className="flex-1 py-2.5 border-2 border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                {actionLoading === 'not_delivered' ? 'Updating...' : 'Not Delivered'}
                            </RippleButton>
                            <RippleButton
                                onClick={() => handleAction('delivered', () => onComplete(parcelOrder.id, 'DELIVERED'))}
                                disabled={!!actionLoading}
                                className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-violet-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all disabled:opacity-50"
                            >
                                {actionLoading === 'delivered' ? 'Updating...' : 'Delivered'}
                            </RippleButton>
                        </div>
                    )}
                </div>
            </div>

            {/* NOT_DELIVERED Reason Modal */}
            {showReasonModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
                        <div className="p-5">
                            <h3 className="text-lg font-bold text-gray-900 mb-1">Why wasn't this delivered?</h3>
                            <p className="text-sm text-gray-500 mb-4">Please provide a reason. This will be visible to the admin.</p>
                            <textarea
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-400 focus:border-red-400 outline-none transition-all text-sm resize-none"
                                rows={3}
                                placeholder="e.g. Customer not available, wrong address, refused to accept..."
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value);
                                    if (reasonError) setReasonError('');
                                }}
                                maxLength={500}
                                autoFocus
                            />
                            {reasonError && (
                                <p className="text-red-500 text-xs mt-1">{reasonError}</p>
                            )}
                            <div className="flex gap-2 mt-4">
                                <RippleButton
                                    onClick={() => setShowReasonModal(false)}
                                    className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </RippleButton>
                                <RippleButton
                                    onClick={handleSubmitNotDelivered}
                                    disabled={reason.trim().length < 5}
                                    className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Submit
                                </RippleButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
});

export default DeliveryParcelCard;
