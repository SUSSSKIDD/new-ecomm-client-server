const DeliveryOrderCard = ({ assignment, onComplete }) => {
    const { order } = assignment;

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

    return (
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 overflow-hidden border border-gray-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 flex items-center justify-between">
                <div>
                    <p className="text-white/70 text-xs font-medium">Order</p>
                    <p className="text-white font-bold text-sm">{order.orderNumber}</p>
                </div>
                <div className="text-right">
                    <p className="text-white/70 text-xs">{order.paymentMethod}</p>
                    <p className="text-white font-bold">₹{order.total}</p>
                </div>
            </div>

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
                    {order.deliveryAddress?.houseNo && `${order.deliveryAddress.houseNo}, `}
                    {order.deliveryAddress?.street}, {order.deliveryAddress?.city}{' '}
                    {order.deliveryAddress?.zipCode}
                </p>
                {order.deliveryAddress?.landmark && (
                    <p className="text-xs text-gray-500 mt-1">
                        Near: {order.deliveryAddress.landmark}
                    </p>
                )}
                <button
                    onClick={openInMaps}
                    className="mt-2 text-xs text-emerald-600 font-bold flex items-center gap-1 hover:text-emerald-700"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Open in Maps
                </button>
            </div>

            {/* Actions */}
            <div className="px-4 py-3 flex gap-2">
                <button
                    onClick={() => onComplete(order.id, 'NOT_DELIVERED')}
                    className="flex-1 py-2.5 border-2 border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors"
                >
                    Not Delivered
                </button>
                <button
                    onClick={() => onComplete(order.id, 'DELIVERED')}
                    className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all"
                >
                    ✓ Delivered
                </button>
            </div>
        </div>
    );
};

export default DeliveryOrderCard;
