import { RippleButton } from '../ui/ripple-button';
import { useState, memo } from 'react';
import { PARCEL_CATEGORIES } from '../../constants';

const getCategoryLabel = (val) => {
    const cat = PARCEL_CATEGORIES.find(c => c.value === val);
    return cat?.label || val;
};

const AvailableOrderCard = memo(({ order, onAccept, onReject }) => {
    const [actionLoading, setActionLoading] = useState(null);
    const [animateOut, setAnimateOut] = useState(false);
    const isParcel = order.isParcel;

    const handleAccept = async () => {
        setActionLoading('accept');
        setAnimateOut(true);
        try {
            await onAccept(order.orderId, isParcel);
        } catch {
            setAnimateOut(false);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        setActionLoading('reject');
        setAnimateOut(true);
        try {
            await onReject(order.orderId, isParcel);
        } catch {
            setAnimateOut(false);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div
            className={`bg-white rounded-2xl shadow-lg overflow-hidden border transition-all duration-300 ${
                animateOut ? 'opacity-0 scale-95 -translate-y-2' : 'opacity-100 scale-100'
            } ${isParcel ? 'shadow-purple-100/50 border-purple-100' : 'shadow-blue-100/50 border-blue-100'}`}
        >
            {/* Header */}
            <div className={`px-4 py-3 flex items-center justify-between ${isParcel
                ? 'bg-gradient-to-r from-purple-500 to-violet-600'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600'
            }`}>
                <div>
                    <p className="text-white/70 text-xs font-medium">
                        {isParcel ? 'Parcel' : 'New Order'}
                    </p>
                    <p className="text-white font-bold text-sm">{order.orderNumber}</p>
                </div>
                <div className="text-right">
                    <p className="text-white/70 text-xs">{order.paymentMethod}</p>
                    <p className="text-white font-bold">&#8377;{order.total}</p>
                </div>
            </div>

            {/* Waiting badge */}
            <div className="px-4 pt-3">
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span className="text-xs font-medium text-amber-700">Accept or reject this delivery</span>
                </div>
            </div>

            {isParcel ? (
                <>
                    {/* Parcel details */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Parcel Details</p>
                        <div className="flex gap-2">
                            <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded-lg text-xs font-medium">
                                {getCategoryLabel(order.category)}
                            </span>
                            <span className="bg-gray-50 text-gray-700 px-2 py-1 rounded-lg text-xs font-medium">
                                {order.weight} kg
                            </span>
                        </div>
                    </div>

                    {/* Pickup Address */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Pickup</p>
                        <p className="text-sm text-gray-700">
                            {order.storeName || 'Pickup location'}
                        </p>
                    </div>

                    {/* Drop Address */}
                    {order.deliveryAddress && (
                        <div className="px-4 py-3 border-b border-gray-100">
                            <p className="text-xs font-bold text-red-500 uppercase mb-1">Drop</p>
                            <p className="text-sm text-gray-700">
                                {order.deliveryAddress.houseNo && `${order.deliveryAddress.houseNo}, `}
                                {order.deliveryAddress.street}, {order.deliveryAddress.city}{' '}
                                {order.deliveryAddress.zipCode || order.deliveryAddress.pincode}
                            </p>
                        </div>
                    )}
                </>
            ) : (
                <>
                    {/* Items summary */}
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                            {order.itemCount || order.items?.length || 0} Items
                        </p>
                        {order.items && (
                            <div className="space-y-1">
                                {order.items.slice(0, 5).map((item, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-gray-700 truncate flex-1 mr-2">
                                            {item.name} &times; {item.quantity}
                                        </span>
                                        <span className="text-gray-900 font-medium">
                                            &#8377;{item.total}
                                        </span>
                                    </div>
                                ))}
                                {order.items.length > 5 && (
                                    <p className="text-xs text-gray-400">+{order.items.length - 5} more items</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Delivery Address */}
                    {order.deliveryAddress && (
                        <div className="px-4 py-3 border-b border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Delivery To</p>
                            <p className="text-sm text-gray-700">
                                {order.deliveryAddress.houseNo && `${order.deliveryAddress.houseNo}, `}
                                {order.deliveryAddress.street}, {order.deliveryAddress.city}{' '}
                                {order.deliveryAddress.zipCode || order.deliveryAddress.pincode}
                            </p>
                            {order.deliveryAddress.landmark && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Near: {order.deliveryAddress.landmark}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Store info */}
                    {order.storeName && (
                        <div className="px-4 py-2 border-b border-gray-100">
                            <p className="text-xs text-gray-500">
                                Pickup: <span className="font-medium text-gray-700">{order.storeName}</span>
                            </p>
                        </div>
                    )}
                </>
            )}

            {/* Accept / Reject Buttons */}
            <div className="px-4 py-3">
                <div className="flex gap-2">
                    <RippleButton
                        onClick={handleReject}
                        disabled={!!actionLoading}
                        className="flex-1 py-3 border-2 border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                        {actionLoading === 'reject' ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></span>
                                Rejecting...
                            </span>
                        ) : 'Reject'}
                    </RippleButton>
                    <RippleButton
                        onClick={handleAccept}
                        disabled={!!actionLoading}
                        className={`flex-1 py-3 text-white rounded-xl font-bold text-sm shadow-lg transition-all disabled:opacity-50 ${
                            isParcel
                                ? 'bg-gradient-to-r from-purple-500 to-violet-600 shadow-purple-500/20 hover:shadow-purple-500/30'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-blue-500/20 hover:shadow-blue-500/30'
                        }`}
                    >
                        {actionLoading === 'accept' ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Accepting...
                            </span>
                        ) : 'Accept'}
                    </RippleButton>
                </div>
            </div>
        </div>
    );
});

export default AvailableOrderCard;
