import { RippleButton } from '../../components/ui/ripple-button';
import { InteractiveHoverButton } from '../../components/ui/interactive-hover-button';
import { useCategory } from '../../context/CategoryContext';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const DELIVERY_FEE = 40;
const FREE_DELIVERY_THRESHOLD = 500;
const TAX_RATE = 0.05;

const parsePrice = (price) => {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') return parseFloat(price.replace(/[₹,]/g, '')) || 0;
    return 0;
};

const CartSidebar = () => {
    const { isCartOpen, setIsCartOpen, cart, updateQuantity, removeFromCart, clearCart } = useCategory();
    const { isAuthenticated, token, openLoginModal } = useAuth();

    // Flow: 'cart' | 'checkout' | 'success'
    const [step, setStep] = useState('cart');
    const [addresses, setAddresses] = useState([]);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [placing, setPlacing] = useState(false);
    const [orderResult, setOrderResult] = useState(null);
    const [error, setError] = useState('');
    const paymentMethod = 'COD';

    useEffect(() => {
        if (isCartOpen) {
            setStep('cart');
            setError('');
            setOrderResult(null);
            setSelectedAddress(null);
            setPreview(null);
        }
    }, [isCartOpen]);

    if (!isCartOpen) return null;

    const subTotal = cart.reduce(
        (total, item) => total + parsePrice(item.price) * item.quantity, 0,
    );
    const isFreeDelivery = subTotal >= FREE_DELIVERY_THRESHOLD;
    const deliveryFee = isFreeDelivery ? 0 : DELIVERY_FEE;
    const tax = Math.round(subTotal * TAX_RATE * 100) / 100;
    const grandTotal = Math.round((subTotal + deliveryFee + tax) * 100) / 100;

    const api = (method, path, data) =>
        axios({ method, url: `${API_URL}${path}`, data, headers: { Authorization: `Bearer ${token}` } });

    // Go to checkout: load addresses
    const handleProceedToCheckout = async () => {
        if (!isAuthenticated) { openLoginModal(); return; }
        try {
            const res = await api('get', '/users/addresses');
            setAddresses(res.data);
            // Auto-select first address with GPS or first address
            const defaultAddr = res.data.find((a) => a.lat) || res.data[0] || null;
            setStep('checkout');
            if (defaultAddr) handleSelectAddress(defaultAddr);
        } catch {
            setError('Failed to load addresses. Please try again.');
        }
    };

    // Select address and fetch preview
    const handleSelectAddress = async (address) => {
        setSelectedAddress(address);
        setPreviewLoading(true);
        setError('');
        try {
            const res = await api('post', '/orders/preview', { addressId: address.id });
            setPreview(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load preview');
            setPreview(null);
        } finally {
            setPreviewLoading(false);
        }
    };

    // Place order
    const handlePlaceOrder = async () => {
        setPlacing(true);
        setError('');
        const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        try {
            const body = {
                addressId: selectedAddress.id,
                paymentMethod,
                lat: selectedAddress.lat,
                lng: selectedAddress.lng,
            };

            if (preview?.fulfillment?.unavailableItems?.length > 0) {
                body.confirmedItems = preview.fulfillment.availableItems.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                }));
            }

            const orderRes = await axios.post(`${API_URL}/orders`, body, {
                headers: { Authorization: `Bearer ${token}`, 'idempotency-key': idempotencyKey },
            });

            const order = orderRes.data;
            setOrderResult(order);
            setStep('success');
            clearCart();
        } catch (err) {
            setError(err.response?.data?.message || 'Order failed. Please try again.');
        } finally {
            setPlacing(false);
        }
    };

    // ── RENDER ──

    const renderContent = () => {
        // ── SUCCESS ──
        if (step === 'success' && orderResult) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Order Placed!</h3>
                    <p className="text-sm text-gray-500 mb-1">Order #{orderResult.orderNumber}</p>
                    <p className="text-2xl font-bold text-emerald-600 mb-6">₹{orderResult.total}</p>
                    <p className="text-xs text-gray-400 mb-6">Your order will be delivered shortly</p>
                    <RippleButton
                        onClick={() => { setIsCartOpen(false); setStep('cart'); }}
                        className="px-8 py-3 bg-ud-primary text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors"
                    >
                        Continue Shopping
                    </RippleButton>
                </div>
            );
        }

        // ── CHECKOUT (address + summary + payment — all in one) ──
        if (step === 'checkout') {
            const displayTotal = preview?.total ?? grandTotal;
            const unavailable = preview?.fulfillment?.unavailableItems || [];

            return (
                <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* ─ Address Selection ─ */}
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Delivery Address</p>
                            {addresses.length === 0 ? (
                                <div className="text-center py-4 text-gray-400 bg-gray-50 rounded-xl">
                                    <p className="text-sm">No addresses saved</p>
                                    <p className="text-xs mt-1">Add one from your profile</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {addresses.map((addr) => (
                                        <button
                                            key={addr.id}
                                            type="button"
                                            onClick={() => handleSelectAddress(addr)}
                                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                                selectedAddress?.id === addr.id
                                                    ? 'border-emerald-500 bg-emerald-50'
                                                    : 'border-gray-100 bg-white hover:border-emerald-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                    {addr.type}
                                                </span>
                                                {addr.lat && <span className="text-[10px] text-emerald-500">GPS</span>}
                                                {selectedAddress?.id === addr.id && (
                                                    <svg className="w-4 h-4 text-emerald-600 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-900 font-medium">
                                                {addr.houseNo && `${addr.houseNo}, `}{addr.street}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {addr.city}, {addr.state} - {addr.zipCode}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ─ Order Items ─ */}
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Order Summary ({cart.length} items)</p>
                            <div className="space-y-2">
                                {cart.map((item) => (
                                    <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2">
                                        <div className="w-10 h-10 bg-white rounded flex items-center justify-center flex-shrink-0">
                                            <img src={item.image || item.images?.[0]} alt={item.name} className="w-8 h-8 object-contain" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                                            <p className="text-[10px] text-gray-500">
                                                {item.quantity} × ₹{parsePrice(item.price)}
                                            </p>
                                        </div>
                                        <span className="text-xs font-bold text-gray-900">
                                            ₹{(parsePrice(item.price) * item.quantity).toFixed(0)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ─ Unavailable Warning ─ */}
                        {unavailable.length > 0 && (
                            <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                                <p className="text-xs font-bold text-orange-700 uppercase mb-1">
                                    {unavailable.length} items unavailable
                                </p>
                                {unavailable.map((item) => (
                                    <div key={item.productId} className="flex justify-between text-xs text-orange-800 py-0.5">
                                        <span>{item.name}</span>
                                        <span className="text-orange-500">{item.reason}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ─ Price Breakdown ─ */}
                        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Subtotal</span>
                                <span>₹{(preview?.subtotal ?? subTotal).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Delivery</span>
                                <span className={(preview?.deliveryFee ?? deliveryFee) === 0 ? 'text-emerald-600 font-bold' : ''}>
                                    {(preview?.deliveryFee ?? deliveryFee) === 0 ? 'FREE' : `₹${preview?.deliveryFee ?? deliveryFee}`}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-500">Tax (5%)</span>
                                <span>₹{(preview?.tax ?? tax).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-gray-200">
                                <span>Total</span>
                                <span className="text-emerald-600">₹{displayTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* ─ Payment Method ─ */}
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Payment Method</p>
                            <div className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50">
                                <div className="w-5 h-5 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-medium text-gray-900">Cash on Delivery</p>
                                    <p className="text-[10px] text-gray-500">Pay when your order arrives</p>
                                </div>
                                <span className="text-lg">💵</span>
                            </div>
                        </div>
                    </div>

                    {/* ─ Place Order Button (sticky footer) ─ */}
                    {selectedAddress && (
                        <div className="border-t border-gray-100 p-4 bg-white">
                            <InteractiveHoverButton
                                onClick={handlePlaceOrder}
                                disabled={placing || previewLoading || !preview}
                                className={`text-white ${placing || previewLoading || !preview ? 'opacity-50 pointer-events-none' : 'bg-ud-primary'}`}
                                text={
                                    placing
                                        ? 'Placing Order...'
                                        : previewLoading
                                            ? 'Loading...'
                                            : `Pay ₹${(preview?.total ?? grandTotal).toFixed(2)} · Cash on Delivery`
                                }
                            />
                        </div>
                    )}
                </>
            );
        }

        // ── CART VIEW ──
        return (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <p>Your cart is empty.</p>
                        <RippleButton
                            onClick={() => setIsCartOpen(false)}
                            className="mt-4 px-6 py-2 bg-ud-primary text-white text-sm font-bold rounded-full hover:bg-opacity-90"
                        >
                            Start Shopping
                        </RippleButton>
                    </div>
                ) : (
                    cart.map((item) => (
                        <div key={item.id} className="flex gap-3 bg-white border border-gray-100 rounded-lg p-2 shadow-sm">
                            <div className="w-16 h-16 bg-gray-50 rounded-md flex items-center justify-center flex-shrink-0">
                                <img src={item.image || item.images?.[0]} alt={item.name} className="w-12 h-12 object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-medium text-gray-900 truncate">{item.name}</h4>
                                <p className="text-xs text-gray-500 mt-1">₹{parsePrice(item.price)}</p>
                                <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center border border-gray-200 rounded">
                                        <RippleButton
                                            className="px-2 py-0.5 text-gray-500 hover:bg-gray-100"
                                            onClick={() => updateQuantity(item.id, -1)}
                                        >-</RippleButton>
                                        <span className="px-2 text-xs font-medium">{item.quantity}</span>
                                        <RippleButton
                                            className="px-2 py-0.5 text-gray-500 hover:bg-gray-100"
                                            onClick={() => updateQuantity(item.id, 1)}
                                        >+</RippleButton>
                                    </div>
                                    <RippleButton
                                        className="text-xs text-red-500 font-medium hover:underline"
                                        onClick={() => removeFromCart(item.id)}
                                    >Remove</RippleButton>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setIsCartOpen(false)} />

            <div className="absolute inset-y-0 right-0 w-full md:max-w-sm bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        {step === 'checkout' && (
                            <RippleButton
                                onClick={() => { setStep('cart'); setSelectedAddress(null); setPreview(null); }}
                                className="p-1 hover:bg-gray-100 rounded-full"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </RippleButton>
                        )}
                        <h2 className="text-lg font-bold text-gray-900">
                            {step === 'cart' && `Your Cart (${cart.length})`}
                            {step === 'checkout' && 'Checkout'}
                            {step === 'success' && 'Order Confirmed'}
                        </h2>
                    </div>
                    <RippleButton
                        onClick={() => setIsCartOpen(false)}
                        className="p-2 -mr-2 text-gray-400 hover:text-gray-500"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </RippleButton>
                </div>

                {error && (
                    <div className="mx-4 mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                        {error}
                    </div>
                )}

                {renderContent()}

                {/* Cart footer */}
                {step === 'cart' && cart.length > 0 && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Subtotal</span>
                            <span className="font-medium text-gray-900">₹{subTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Delivery Fee</span>
                            <div className="flex items-center gap-2">
                                {isFreeDelivery ? (
                                    <>
                                        <span className="text-gray-400 line-through text-xs">₹{DELIVERY_FEE}</span>
                                        <span className="text-green-600 font-bold">FREE</span>
                                    </>
                                ) : (
                                    <span className="font-medium text-gray-900">₹{DELIVERY_FEE}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Tax (5%)</span>
                            <span className="font-medium text-gray-900">₹{tax.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-gray-200 my-2 pt-2 flex justify-between items-center">
                            <span className="text-base font-bold text-gray-900">Total</span>
                            <span className="text-xl font-bold text-ud-primary">₹{grandTotal.toFixed(2)}</span>
                        </div>
                        <InteractiveHoverButton
                            onClick={handleProceedToCheckout}
                            className="mt-2 text-white bg-ud-primary"
                            text="Proceed to Checkout"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CartSidebar;
