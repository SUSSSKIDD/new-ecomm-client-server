import { RippleButton } from '../ui/ripple-button';
import { useState, memo } from 'react';

const DeliveryOrderCard = memo(({ assignment, onAccept, onReject, onComplete }) => {
    const { order } = assignment;
    const isAccepted = !!assignment.acceptedAt;
    const [actionLoading, setActionLoading] = useState(null);
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [reason, setReason] = useState('');
    const [reasonError, setReasonError] = useState('');
    const [pin, setPin] = useState('');
    const [pinError, setPinError] = useState('');

    const openInMaps = () => {
        const addr = order.deliveryAddress;
        if (addr?.lat && addr?.lng) {
            window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${addr.lat},${addr.lng}`,
                '_blank',
            );
        } else if (addr?.mapsLink) {
            window.open(addr.mapsLink, '_blank');
        } else {
            const query = encodeURIComponent(
                `${addr?.street || ''}, ${addr?.city || ''}, ${addr?.zipCode || ''}`,
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
        await handleAction('not_delivered', () => onComplete(order.id, 'NOT_DELIVERED', undefined, trimmed));
    };

    const handleDeliveredClick = () => {
        console.log(`[TRACE] Delivered button clicked for Order ${order.id}. Opening PIN modal...`);
        setPin('');
        setPinError('');
        setShowPinModal(true);
        // Fallback safety prompt if the modal gets suppressed by any hidden CSS layout logic
        setTimeout(() => {
            const el = document.getElementById(`pin-modal-overlay-${order.id}`);
            if(!el) {
                 console.log(`[WARN] PIN Modal DOM element not found for ${order.id}. Firing browser fallback prompt...`);
                 const fallbackPin = prompt("Enter 4-digit Delivery PIN:");
                 if(fallbackPin && fallbackPin.length === 4) {
                     setPin(fallbackPin);
                     handleSubmitDeliveredWithPin(fallbackPin);
                 }
            }
        }, 300);
    };

    const handleSubmitDeliveredWithPin = async (overridePin) => {
        const finalPin = overridePin || pin;
        if (finalPin.length !== 4) {
            setPinError('Please enter the complete 4-digit PIN');
            return;
        }
        setPinError('');
        setActionLoading('delivered');
        try {
            await onComplete(order.id, 'DELIVERED', finalPin);
            setShowPinModal(false);
        } catch (err) {
            const msg = err?.response?.data?.message || 'Invalid PIN. Please try again.';
            setPinError(msg);
            alert(msg);
        } finally {
            setActionLoading(null);
        }
    };

    const handleSubmitDelivered = () => handleSubmitDeliveredWithPin();

    return (
        <>
            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 overflow-hidden border border-gray-100">
                {/* Header */}
                <div className={`px-4 py-3 flex items-center justify-between ${isAccepted
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500'
                    }`}>
                    <div>
                        <p className="text-white/70 text-xs font-medium">
                            {isAccepted ? 'Order' : 'New Order'}
                        </p>
                        <p className="text-white font-bold text-sm">{order.orderNumber}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-white/70 text-xs">{order.paymentMethod}</p>
                        <p className="text-white font-bold">₹{order.total}</p>
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

                {/* Items */}
                <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                        {order.items?.length || 0} Items
                    </p>
                    <div className="space-y-1">
                        {order.items?.map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                                <span className="text-gray-700 truncate flex-1 mr-2">
                                    {item.name} × {item.quantity}
                                </span>
                                <span className="text-gray-900 font-medium">
                                    ₹{item.total}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pickup Store */}
                {assignment.primaryStore && (
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-emerald-600 uppercase mb-1">📦 Pickup From</p>
                        <p className="text-sm font-medium text-gray-800">{assignment.primaryStore.name}</p>
                        {assignment.primaryStore.address && (
                            <p className="text-xs text-gray-500 mt-0.5">{assignment.primaryStore.address}</p>
                        )}
                        {assignment.primaryStore.lat && assignment.primaryStore.lng && (
                            <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${assignment.primaryStore.lat},${assignment.primaryStore.lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1.5 text-xs text-emerald-600 font-bold flex items-center gap-1 hover:text-emerald-700"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Navigate to Store
                            </a>
                        )}
                    </div>
                )}

                {/* Delivery Address */}
                <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-bold text-red-500 uppercase mb-1">🏠 Deliver To</p>
                    <p className="text-sm text-gray-700">
                        {order.deliveryAddress?.recipientName && (
                            <span className="font-medium text-gray-900">{order.deliveryAddress.recipientName}<br /></span>
                        )}
                        {order.deliveryAddress?.houseNo && `${order.deliveryAddress.houseNo}, `}
                        {order.deliveryAddress?.flatBuilding && `${order.deliveryAddress.flatBuilding}, `}
                        {order.deliveryAddress?.street}, {order.deliveryAddress?.city}{' '}
                        {order.deliveryAddress?.zipCode}
                    </p>
                    {order.deliveryAddress?.landmark && (
                        <p className="text-xs text-gray-500 mt-1">
                            Near: {order.deliveryAddress.landmark}
                        </p>
                    )}
                    {order.deliveryAddress?.recipientPhone && (
                        <p className="text-xs text-gray-500 mt-1">
                            Phone: {order.deliveryAddress.recipientPhone}
                        </p>
                    )}
                    <RippleButton
                        onClick={openInMaps}
                        className="mt-2 text-xs text-red-500 font-bold flex items-center gap-1 hover:text-red-700"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Navigate to Customer
                    </RippleButton>
                </div>

                {/* Actions */}
                <div className="px-4 py-3">
                    {!isAccepted ? (
                        <div className="flex gap-2">
                            <RippleButton
                                onClick={() => handleAction('reject', () => onReject(order.id))}
                                disabled={!!actionLoading}
                                className="flex-1 py-2.5 border-2 border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                                {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}
                            </RippleButton>
                            <RippleButton
                                onClick={() => handleAction('accept', () => onAccept(order.id))}
                                disabled={!!actionLoading}
                                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
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
                                onClick={handleDeliveredClick}
                                disabled={!!actionLoading}
                                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
                            >
                                {actionLoading === 'delivered' ? 'Updating...' : 'Delivered'}
                            </RippleButton>
                        </div>
                    )}
                </div>
            </div>

            {/* PIN Verification Modal */}
            {showPinModal && (
                <div id={`pin-modal-overlay-${order.id}`} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Verify Delivery PIN</h3>
                            <p className="text-sm text-gray-500 text-center mb-6">Ask the customer for the 4-digit PIN displayed on their order screen.</p>
                            
                            <div className="flex justify-center gap-3 mb-6">
                                {[0, 1, 2, 3].map((i) => (
                                    <input
                                        key={i}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={pin[i] || ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val) {
                                                const newPin = pin.split('');
                                                newPin[i] = val;
                                                const pinStr = newPin.join('');
                                                setPin(pinStr);
                                                if (pinStr.length === 4) setPinError('');
                                                // Auto focus next
                                                if (i < 3) {
                                                    const next = e.target.nextElementSibling;
                                                    if (next) next.focus();
                                                }
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Backspace' && !pin[i] && i > 0) {
                                                const newPin = pin.split('');
                                                newPin[i - 1] = '';
                                                setPin(newPin.join(''));
                                                const prev = e.target.previousElementSibling;
                                                if (prev) prev.focus();
                                            }
                                        }}
                                        className={`w-12 h-14 text-center text-2xl font-bold bg-gray-50 border-2 rounded-xl focus:ring-2 focus:outline-none transition-all ${
                                            pinError ? 'border-red-300 focus:ring-red-400' : 'border-gray-200 focus:ring-emerald-400 focus:border-emerald-400'
                                        }`}
                                    />
                                ))}
                            </div>

                            {pinError && (
                                <p className="text-red-500 text-xs text-center mb-4">{pinError}</p>
                            )}

                            <div className="flex gap-2">
                                <RippleButton
                                    onClick={() => setShowPinModal(false)}
                                    className="flex-1 py-3 border-2 border-gray-100 text-gray-500 rounded-xl font-bold text-sm hover:bg-gray-50"
                                >
                                    Cancel
                                </RippleButton>
                                <RippleButton
                                    onClick={handleSubmitDelivered}
                                    disabled={pin.length !== 4 || !!actionLoading}
                                    className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-50"
                                >
                                    {actionLoading === 'delivered' ? 'Verifying...' : 'Verify & Deliver'}
                                </RippleButton>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

export default DeliveryOrderCard;
