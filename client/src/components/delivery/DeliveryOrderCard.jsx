import { RippleButton } from '../ui/ripple-button';
import { useState, memo } from 'react';

const DeliveryOrderCard = memo(({ assignment, onAccept, onReject, onComplete }) => {
    const { order } = assignment;
    const isAccepted = !!assignment.acceptedAt;
    const [actionLoading, setActionLoading] = useState(null);

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

    return (
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

            {/* Address */}
            <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Delivery Address</p>
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
                    className="mt-2 text-xs text-emerald-600 font-bold flex items-center gap-1 hover:text-emerald-700"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Open in Maps
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
                            onClick={() => handleAction('not_delivered', () => onComplete(order.id, 'NOT_DELIVERED'))}
                            disabled={!!actionLoading}
                            className="flex-1 py-2.5 border-2 border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                            {actionLoading === 'not_delivered' ? 'Updating...' : 'Not Delivered'}
                        </RippleButton>
                        <RippleButton
                            onClick={() => handleAction('delivered', () => onComplete(order.id, 'DELIVERED'))}
                            disabled={!!actionLoading}
                            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all disabled:opacity-50"
                        >
                            {actionLoading === 'delivered' ? 'Updating...' : '✓ Delivered'}
                        </RippleButton>
                    </div>
                )}
            </div>
        </div>
    );
});

export default DeliveryOrderCard;
