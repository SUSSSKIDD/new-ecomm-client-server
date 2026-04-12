import { RippleButton } from '../../components/ui/ripple-button';
import { InteractiveHoverButton } from '../../components/ui/interactive-hover-button';
import { useCategory } from '../../context/CategoryContext';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../../lib/api';
import AddressForm from './profile/AddressForm';
import { useAddresses } from '../../hooks/useAddresses';
import { loadRazorpayScript } from '../../lib/utils';
const DELIVERY_FEE = 30; // Updated from 40
const FREE_DELIVERY_THRESHOLD = 199;

const parsePrice = (price) => {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') return parseFloat(price.replace(/[₹,]/g, '')) || 0;
    return 0;
};

const CartSidebar = () => {
    const { isCartOpen, setIsCartOpen, cart, updateQuantity, removeFromCart, clearCart, buyNowProduct, setBuyNowProduct } = useCategory();
    const { isAuthenticated, token, user, openLoginModal } = useAuth();
    const { addAddress, loading: addressLoading } = useAddresses();

    // Flow: 'cart' | 'checkout' | 'success'
    const [step, setStep] = useState('cart');
    const [addresses, setAddresses] = useState([]);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [preview, setPreview] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [placing, setPlacing] = useState(false);
    const [orderResult, setOrderResult] = useState(null);
    const [error, setError] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('COD');

    // Auto-resume checkout after login
    const [pendingCheckout, setPendingCheckout] = useState(false);

    const loadAddressesAndCheckout = useCallback(async () => {
        try {
            const res = await api(token).get('/users/addresses');
            setAddresses(res.data);
            setStep('checkout');
            const defaultAddr = res.data.find((a) => a.lat) || res.data[0] || null;
            if (defaultAddr) {
                setSelectedAddress(defaultAddr);
                setPreviewLoading(true);
                try {
                    const body = { addressId: defaultAddr.id };
                    if (buyNowProduct) {
                        body.items = [{ productId: buyNowProduct.id, quantity: buyNowProduct.quantity || 1, variantId: buyNowProduct.variantId }];
                    } else if (cart.length > 0) {
                        body.items = cart.map((item) => ({ productId: item.id, quantity: item.quantity, variantId: item.variantId }));
                    }
                    const pRes = await api(token).post('/orders/preview', body);
                    setPreview(pRes.data);
                } catch (err) {
                    setError(err.response?.data?.message || 'Failed to load preview');
                } finally {
                    setPreviewLoading(false);
                }
            }
        } catch {
            setError('Failed to load addresses.');
        }
    }, [token, buyNowProduct]);

    const loadGeneralPreview = useCallback(async () => {
        if (!isAuthenticated || !token) return;
        setPreviewLoading(true);
        try {
            const body = {};
            if (buyNowProduct) {
                body.items = [{ productId: buyNowProduct.id, quantity: buyNowProduct.quantity || 1, variantId: buyNowProduct.variantId }];
            } else if (cart.length > 0) {
                body.items = cart.map((item) => ({ productId: item.id, quantity: item.quantity, variantId: item.variantId }));
            }
            const pRes = await api(token).post('/orders/preview', body);
            setPreview(pRes.data);
            setError('');
        } catch (err) {
            console.error('Failed to load cart preview', err);
        } finally {
            setPreviewLoading(false);
        }
    }, [token, isAuthenticated, buyNowProduct, cart]);

    useEffect(() => {
        if (isCartOpen && step === 'cart' && (cart.length > 0 || buyNowProduct)) {
            loadGeneralPreview();
        }
    }, [cart, isCartOpen, step, loadGeneralPreview, buyNowProduct]);

    useEffect(() => {
        if (isCartOpen) {
            setError('');
            setOrderResult(null);
            setSelectedAddress(null);
            setPreview(null);
            setPendingCheckout(false);

            if (buyNowProduct) {
                if (!isAuthenticated) {
                    openLoginModal();
                    setStep('cart');
                    return;
                }
                setStep('checkout');
                loadAddressesAndCheckout();
            } else {
                setStep('cart');
                loadGeneralPreview();
            }
        }
    }, [isCartOpen, buyNowProduct, isAuthenticated, openLoginModal, loadAddressesAndCheckout]);

    // Check if we need to resume checkout after authentication
    useEffect(() => {
        if (isAuthenticated && pendingCheckout && isCartOpen) {
            setPendingCheckout(false);
            setStep('checkout');
            loadAddressesAndCheckout();
        }
    }, [isAuthenticated, pendingCheckout, isCartOpen, loadAddressesAndCheckout]);

    const subTotal = buyNowProduct 
        ? parsePrice(buyNowProduct.price) * (buyNowProduct.quantity || 1)
        : cart.reduce((total, item) => total + parsePrice(item.price) * item.quantity, 0);

    const isFreeDelivery = subTotal >= FREE_DELIVERY_THRESHOLD;
    const deliveryFee = isFreeDelivery ? 0 : DELIVERY_FEE;
    
    // Per-item tax estimate: price × qty × (taxRate / 100)
    const tax = buyNowProduct
        ? Math.round(parsePrice(buyNowProduct.price) * (buyNowProduct.quantity || 1) * ((buyNowProduct.taxRate || 0) / 100) * 100) / 100
        : cart.reduce((totalTax, item) => {
            const rate = item.taxRate ?? 0;
            const itemTax = Math.round(parsePrice(item.price) * item.quantity * (rate / 100) * 100) / 100;
            return totalTax + itemTax;
        }, 0);

    const grandTotal = Math.round((subTotal + deliveryFee + tax) * 100) / 100;

    // Use server preview values if available to avoid checkout jumps
    const displaySubtotal = preview ? preview.subtotal : subTotal;
    const displayDelivery = preview ? preview.deliveryFee : deliveryFee;
    const displayTax = preview ? preview.tax : tax;
    const displayTotal = preview ? preview.total : grandTotal;

    const http = api(token);

    // Go to checkout: load addresses
    const handleProceedToCheckout = async () => {
        if (!isAuthenticated) {
            setPendingCheckout(true);
            openLoginModal();
            return;
        }
        await loadAddressesAndCheckout();
    };

    // Select address and fetch preview
    const handleSelectAddress = async (address, overrideItems = null) => {
        setSelectedAddress(address);
        setPreviewLoading(true);
        setError('');
        try {
            const body = { addressId: address.id };
            if (overrideItems) {
                body.items = overrideItems;
            } else if (buyNowProduct) {
                body.items = [{ productId: buyNowProduct.id, quantity: buyNowProduct.quantity || 1, variantId: buyNowProduct.variantId }];
            } else if (cart.length > 0) {
                body.items = cart.map((item) => ({ productId: item.id, quantity: item.quantity, variantId: item.variantId }));
            }
            const res = await http.post('/orders/preview', body);
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
            // 1. Create the internal order
            const body = {
                addressId: selectedAddress.id,
                paymentMethod,
                lat: selectedAddress.lat,
                lng: selectedAddress.lng,
            };

            if (buyNowProduct) {
                body.items = [{ productId: buyNowProduct.id, quantity: buyNowProduct.quantity || 1, variantId: buyNowProduct.variantId }];
            } else if (preview?.fulfillment?.unavailableItems?.length > 0) {
                body.confirmedItems = preview.fulfillment.availableItems.map((item) => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    variantId: item.variantId,
                }));
            }

            const orderRes = await http.post('/orders', body, {
                headers: { 'idempotency-key': idempotencyKey },
            });

            const order = orderRes.data;

            // 2. If Razorpay, initiate payment flow
            if (paymentMethod === 'RAZORPAY') {
                const isLoaded = await loadRazorpayScript();
                if (!isLoaded) {
                    setError('Razorpay SDK failed to load. Please check your internet connection.');
                    setPlacing(false);
                    return;
                }

                // Create Razorpay order on server
                const rzpOrderRes = await http.post(`/payments/create/${order.id}`);
                const rzpOrder = rzpOrderRes.data;

                // 3. Handle Mock Mode vs Live Mode
                if (rzpOrder.mockMode) {
                    // In mock mode, we auto-trigger the mock payment for development
                    try {
                        const mockRes = await http.post(`/payments/mock/${order.id}`);
                        setOrderResult(mockRes.data.order);
                        setStep('success');
                        if (buyNowProduct) {
                            setBuyNowProduct(null);
                        } else {
                            clearCart();
                        }
                    } catch (err) {
                        setError(err.response?.data?.message || 'Mock payment failed');
                    } finally {
                        setPlacing(false);
                    }
                    return;
                }

                const options = {
                    key: rzpOrder.key,
                    amount: rzpOrder.amount,
                    currency: rzpOrder.currency,
                    name: 'New Grocery',
                    description: `Order #${order.orderNumber}`,
                    order_id: rzpOrder.razorpayOrderId,
                    config: {
                        display: {
                            blocks: {
                                utupi: {
                                    name: 'UPI',
                                    instruments: [{ method: 'upi' }]
                                },
                                utcard: {
                                    name: 'Cards',
                                    instruments: [{ method: 'card' }]
                                },
                                utnb: {
                                    name: 'Netbanking',
                                    instruments: [{ method: 'netbanking' }]
                                },
                                utwallet: {
                                    name: 'Wallets',
                                    instruments: [{ method: 'wallet' }]
                                }
                            },
                            sequence: ['block.utupi', 'block.utcard', 'block.utnb', 'block.utwallet'],
                            preferences: {
                                show_default_blocks: false
                            }
                        }
                    },
                    handler: async (response) => {
                        setPlacing(true);
                        try {
                            // Verify payment on server
                            const verifyRes = await http.post('/payments/verify', {
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                            });

                            setOrderResult(verifyRes.data.order);
                            setStep('success');
                            if (buyNowProduct) {
                                setBuyNowProduct(null);
                            } else {
                                clearCart();
                            }
                        } catch (err) {
                            setError(err.response?.data?.message || 'Payment verification failed');
                        } finally {
                            setPlacing(false);
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            setPlacing(false);
                        },
                    },
                    prefill: {
                        name: user?.name || '',
                        contact: user?.phone || '',
                    },
                    theme: {
                        color: '#10b981', // emerald-500
                    },
                };

                const rzp = new window.Razorpay(options);
                rzp.open();
                // We don't setPlacing(false) here because the flow continues in the handler or ondismiss
            } else {
                // COD Flow
                setOrderResult(order);
                setStep('success');
                if (buyNowProduct) {
                    setBuyNowProduct(null);
                } else {
                    clearCart();
                }
                setPlacing(false);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Order failed. Please try again.');
            setPlacing(false);
        }
    };

    // ── Grace period state ──
    const [graceSeconds, setGraceSeconds] = useState(0);
    const [cancelling, setCancelling] = useState(false);
    const [modifying, setModifying] = useState(false);
    const [modifyItems, setModifyItems] = useState([]);
    const [showModify, setShowModify] = useState(false);
    const graceTimer = useRef(null);

    // Start grace countdown when order succeeds
    useEffect(() => {
        if (step === 'success' && orderResult?.graceExpiresAt) {
            const tick = () => {
                const remaining = Math.max(0, Math.ceil((new Date(orderResult.graceExpiresAt).getTime() - Date.now()) / 1000));
                setGraceSeconds(remaining);
                if (remaining <= 0 && graceTimer.current) {
                    clearInterval(graceTimer.current);
                    graceTimer.current = null;
                }
            };
            tick();
            graceTimer.current = setInterval(tick, 1000);
            setModifyItems(orderResult.items?.map((i) => ({ ...i })) || []);
            return () => { if (graceTimer.current) clearInterval(graceTimer.current); };
        }
    }, [step, orderResult]);

    const handleCancelOrder = useCallback(async () => {
        if (!orderResult) return;
        setCancelling(true);
        setError('');
        try {
            await http.post(`/orders/${orderResult.id}/cancel`);
            setOrderResult((prev) => ({ ...prev, status: 'CANCELLED', canCancel: false, canModify: false }));
            if (graceTimer.current) { clearInterval(graceTimer.current); graceTimer.current = null; }
            setGraceSeconds(0);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to cancel order');
        } finally {
            setCancelling(false);
        }
    }, [orderResult, token]);

    const handleModifyOrder = useCallback(async () => {
        if (!orderResult) return;
        setModifying(true);
        setError('');
        try {
            const items = modifyItems
                .map((i) => ({ productId: i.productId, quantity: i.quantity }))
                .filter((i) => {
                    const orig = orderResult.items.find((o) => o.productId === i.productId);
                    return !orig || orig.quantity !== i.quantity;
                });
            if (items.length === 0) { setShowModify(false); setModifying(false); return; }
            const res = await http.patch(`/orders/${orderResult.id}/modify`, { items });
            setOrderResult((prev) => ({ ...prev, ...res.data }));
            setShowModify(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to modify order');
        } finally {
            setModifying(false);
        }
    }, [orderResult, modifyItems, token]);

    // ── Group cart items by storeType ──
    const groupedCart = useMemo(() => {
        return cart.reduce((acc, item) => {
            const storeName = item.storeTypeName || 'Store';
            if (!acc[storeName]) acc[storeName] = [];
            acc[storeName].push(item);
            return acc;
        }, {});
    }, [cart]);

    // ── RENDER ──

    const renderContent = () => {
        // ── SUCCESS ──
        if (step === 'success' && orderResult) {
            const isCancelled = orderResult.status === 'CANCELLED';
            const graceActive = graceSeconds > 0 && !isCancelled;

            return (
                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col items-center justify-center p-6 text-center">
                    {isCancelled ? (
                        <>
                            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Order Cancelled</h3>
                            <p className="text-sm text-gray-500 mb-6">Order #{orderResult.orderNumber} has been cancelled</p>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-1">Order Placed!</h3>
                            <p className="text-sm text-gray-500 mb-1">Order #{orderResult.orderNumber}</p>
                            <p className="text-2xl font-bold text-emerald-600 mb-3">₹{orderResult.total}</p>
                        </>
                    )}

                    {/* Grace period countdown */}
                    {graceActive && (
                        <div className="w-full mb-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
                                <p className="text-xs font-semibold text-amber-700 mb-1">You can cancel or modify this order</p>
                                <div className="flex items-center justify-center gap-1">
                                    <span className="text-2xl font-mono font-bold text-amber-600">{graceSeconds}</span>
                                    <span className="text-xs text-amber-500">seconds remaining</span>
                                </div>
                                {/* Progress bar */}
                                <div className="w-full bg-amber-200 rounded-full h-1.5 mt-2">
                                    <div
                                        className="bg-amber-500 h-1.5 rounded-full transition-all duration-1000"
                                        style={{ width: `${(graceSeconds / 90) * 100}%` }}
                                    />
                                </div>
                            </div>

                            {/* Cancel / Modify buttons */}
                            {!showModify && (
                                <div className="flex gap-2">
                                    <RippleButton
                                        onClick={handleCancelOrder}
                                        disabled={cancelling}
                                        className="flex-1 py-2.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
                                    >
                                        {cancelling ? 'Cancelling...' : 'Cancel Order'}
                                    </RippleButton>
                                    <RippleButton
                                        onClick={() => setShowModify(true)}
                                        className="flex-1 py-2.5 bg-blue-500 text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors"
                                    >
                                        Modify Order
                                    </RippleButton>
                                </div>
                            )}

                            {/* Modify inline editor */}
                            {showModify && (
                                <div className="bg-white border border-gray-200 rounded-xl p-3 text-left">
                                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Edit Quantities</p>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {modifyItems.map((item, idx) => (
                                            <div key={item.productId} className="flex items-center justify-between text-sm">
                                                <span className="text-gray-700 truncate flex-1 mr-2">{item.name}</span>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setModifyItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(0, it.quantity - 1) } : it))}
                                                        className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold hover:bg-gray-200"
                                                    >-</button>
                                                    <span className={`w-6 text-center font-bold ${item.quantity === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setModifyItems((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it))}
                                                        className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 font-bold hover:bg-gray-200"
                                                    >+</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {modifyItems.every((i) => i.quantity === 0) && (
                                        <p className="text-xs text-red-500 mt-2">Cannot remove all items. Use cancel instead.</p>
                                    )}
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            type="button"
                                            onClick={() => { setShowModify(false); setModifyItems(orderResult.items?.map((i) => ({ ...i })) || []); }}
                                            className="flex-1 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                                        >Back</button>
                                        <RippleButton
                                            onClick={handleModifyOrder}
                                            disabled={modifying || modifyItems.every((i) => i.quantity === 0)}
                                            className="flex-1 py-2 bg-blue-500 text-white text-sm font-bold rounded-lg hover:bg-blue-600 disabled:opacity-50"
                                        >
                                            {modifying ? 'Saving...' : 'Save Changes'}
                                        </RippleButton>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!graceActive && !isCancelled && (
                        <p className="text-xs text-gray-400 mb-4">Your order will be delivered shortly</p>
                    )}

                    {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

                    <RippleButton
                        onClick={handleClose}
                        className="px-8 py-3 bg-ud-primary text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors"
                    >
                        Continue Shopping
                    </RippleButton>
                </div>
            );
        }

        // ── ADD ADDRESS ──
        if (step === 'add_address') {
            return (
                <div className="flex-1 overflow-y-auto min-h-0 p-4 bg-gray-50">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-full">
                        <AddressForm
                            onSubmit={async (formData) => {
                                const res = await addAddress(formData);
                                if (res.success) {
                                    setStep('checkout');
                                    loadAddressesAndCheckout();
                                } else {
                                    alert(res.error || 'Failed to add address');
                                }
                            }}
                            onCancel={() => setStep('checkout')}
                            loading={addressLoading}
                        />
                    </div>
                </div>
            );
        }

        // ── CHECKOUT (address + summary + payment — all in one) ──
        if (step === 'checkout') {
            const unavailable = preview?.fulfillment?.unavailableItems || [];

            return (
                <>
                    <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
                        {/* ─ Address Selection ─ */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-xs font-bold text-gray-500 uppercase">Delivery Address</p>
                                {addresses.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setStep('add_address')}
                                        className="text-xs font-bold text-ud-primary hover:underline"
                                    >
                                        + Add New
                                    </button>
                                )}
                            </div>
                            {addresses.length === 0 ? (
                                <div className="text-center py-6 px-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-3">
                                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900">No addresses saved</p>
                                    <p className="text-xs text-gray-500 mt-1 mb-4">Please add a delivery address to continue.</p>
                                    <RippleButton
                                        onClick={() => setStep('add_address')}
                                        className="py-2.5 px-6 bg-ud-primary text-white text-sm font-bold rounded-lg hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-500/20"
                                    >
                                        Add Address
                                    </RippleButton>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {addresses.map((addr) => (
                                        <button
                                            key={addr.id}
                                            type="button"
                                            onClick={() => handleSelectAddress(addr)}
                                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selectedAddress?.id === addr.id
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
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                                {buyNowProduct ? 'Buy Now Item' : `Order Summary (${cart.length} items)`}
                            </p>
                            <div className="space-y-2">
                                {buyNowProduct ? (
                                    <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                                        <div className="w-12 h-12 bg-gray-50 rounded flex items-center justify-center flex-shrink-0">
                                            <img src={buyNowProduct.image || buyNowProduct.images?.[0]} alt={buyNowProduct.name} className="w-10 h-10 object-contain" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-900 truncate">{buyNowProduct.name}</p>
                                            <p className="text-[10px] text-gray-500 mt-0.5">₹{parsePrice(buyNowProduct.price)}</p>
                                            
                                            {/* Buy Now Quantity Selector */}
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <button
                                                    onClick={() => {
                                                        const newQty = Math.max(1, (buyNowProduct.quantity || 1) - 1);
                                                        setBuyNowProduct({ ...buyNowProduct, quantity: newQty });
                                                        handleSelectAddress(selectedAddress, [{ productId: buyNowProduct.id, quantity: newQty }]);
                                                    }}
                                                    className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-emerald-500"
                                                >-</button>
                                                <span className="text-xs font-bold w-4 text-center">{buyNowProduct.quantity || 1}</span>
                                                <button
                                                    onClick={() => {
                                                        const newQty = (buyNowProduct.quantity || 1) + 1;
                                                        setBuyNowProduct({ ...buyNowProduct, quantity: newQty });
                                                        handleSelectAddress(selectedAddress, [{ productId: buyNowProduct.id, quantity: newQty }]);
                                                    }}
                                                    className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-emerald-500"
                                                >+</button>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-emerald-600">
                                                ₹{(parsePrice(buyNowProduct.price) * (buyNowProduct.quantity || 1)).toFixed(0)}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    (preview?.items || cart).map((item, idx) => {
                                        const isUnavailable = preview?.fulfillment?.unavailableItems?.some(
                                            u => u.productId === item.productId && (!u.variantId || u.variantId === item.variantId)
                                        );
                                        return (
                                            <div key={item.id || idx} className={`flex items-center gap-3 bg-gray-50 rounded-lg p-2 ${isUnavailable ? 'opacity-50 grayscale' : ''}`}>
                                                <div className="w-10 h-10 bg-white rounded flex items-center justify-center flex-shrink-0 relative">
                                                    <img src={item.image || item.images?.[0]} alt={item.name} className="w-8 h-8 object-contain" />
                                                    {isUnavailable && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <div className="bg-red-500 w-1.5 h-1.5 rounded-full" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                                                    {item.variantLabel && (
                                                        <p className="text-[10px] text-emerald-600 font-medium">{item.variantLabel}</p>
                                                    )}
                                                    <p className="text-[10px] text-gray-500">
                                                        {item.quantity} × ₹{parsePrice(item.price)}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-xs font-bold ${isUnavailable ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                        ₹{(parsePrice(item.price) * item.quantity).toFixed(0)}
                                                    </span>
                                                    {isUnavailable && <p className="text-[9px] text-red-500 font-bold uppercase">Out of Stock</p>}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* ─ Unavailable Warning ─ */}
                        {unavailable.length > 0 && (
                            <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
                                {unavailable.some(i => i.reason === 'out_of_range') ? (
                                    <p className="text-sm font-bold text-orange-700 uppercase text-center py-1">
                                        We are not delivering to this area
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-xs font-bold text-orange-700 uppercase mb-1">
                                            {unavailable.length} {unavailable.length === 1 ? 'item' : 'items'} unavailable
                                        </p>
                                        {unavailable.map((item) => (
                                            <div key={item.productId} className="flex justify-between text-xs text-orange-800 py-0.5">
                                                <span>{item.name}</span>
                                                <span className="text-orange-500 font-medium">
                                                    {item.reason.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}



                        {/* ─ Price Breakdown (always use server preview when available) ─ */}
                        <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                            {preview ? (
                                <>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span>₹{preview.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Delivery</span>
                                        <span className={preview.deliveryFee === 0 ? 'text-emerald-600 font-bold' : ''}>
                                            {preview.deliveryFee === 0 ? 'FREE' : `₹${preview.deliveryFee}`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Tax</span>
                                        <span>₹{preview.tax.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-gray-200">
                                        <span>Total</span>
                                        <span className="text-emerald-600">₹{preview.total.toFixed(2)}</span>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-500">Subtotal</span>
                                        <span>₹{subTotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400 italic">
                                        <span>Select an address for exact totals</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* ─ Payment Method ─ */}
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Payment Method</p>
                            <div className="space-y-2">
                                {/* COD Option */}
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('COD')}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${paymentMethod === 'COD'
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-gray-100 bg-white hover:border-emerald-200'
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'COD' ? 'border-emerald-500' : 'border-gray-300'}`}>
                                        {paymentMethod === 'COD' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-medium text-gray-900">Cash on Delivery</p>
                                        <p className="text-[10px] text-gray-500">Pay when your order arrives</p>
                                    </div>
                                    <span className="text-lg">💵</span>
                                </button>

                                {/* Razorpay Option */}
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod('RAZORPAY')}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${paymentMethod === 'RAZORPAY'
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-gray-100 bg-white hover:border-emerald-200'
                                        }`}
                                >
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'RAZORPAY' ? 'border-emerald-500' : 'border-gray-300'}`}>
                                        {paymentMethod === 'RAZORPAY' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-medium text-gray-900">Online Payment</p>
                                        <p className="text-[10px] text-gray-500">Razorpay, UPI, Cards, Netbanking</p>
                                    </div>
                                    <span className="text-lg">💳</span>
                                </button>
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
                                            : preview ? `Pay ₹${preview.total.toFixed(2)} · ${paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}` : 'Loading...'
                                }
                            />
                        </div>
                    )}
                </>
            );
        }

        // ── CART VIEW ──
        return (
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
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
                    Object.entries(groupedCart).map(([storeName, items]) => (
                        <div key={storeName} className="mb-4">
                            <h4 className="text-xs font-bold uppercase text-gray-500 mb-2 px-1">{storeName}</h4>
                            <div className="space-y-2">
                                {items.map((item) => (
                                    <div key={item.id} className="flex gap-3 bg-white border border-gray-100 rounded-lg p-2 shadow-sm">
                                        <div className="w-16 h-16 bg-gray-50 rounded-md flex items-center justify-center flex-shrink-0">
                                            <img src={item.image || item.images?.[0]} alt={item.name} className="w-12 h-12 object-contain" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-gray-900 truncate">{item.name}</h4>
                                            <p className="text-xs text-gray-500 mt-1">₹{parsePrice(item.price)}</p>
                                            {/* Custom fields badges */}
                                            {(item.selectedSize || item.variantLabel || item.userUploadUrls?.length > 0) && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {item.selectedSize && (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                                                            Size: {item.selectedSize}
                                                        </span>
                                                    )}
                                                    {item.variantLabel && (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">
                                                            Variant: {item.variantLabel}
                                                        </span>
                                                    )}
                                                    {item.userUploadUrls?.length > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                                                            {item.userUploadUrls.length} upload{item.userUploadUrls.length > 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex items-center border border-gray-200 rounded">
                                                    <RippleButton
                                                        className="px-2 py-0.5 text-gray-500 hover:bg-gray-100"
                                                        onClick={() => updateQuantity(item.id, -1, item.variantId)}
                                                    >-</RippleButton>
                                                    <span className="px-2 text-xs font-medium">{item.quantity}</span>
                                                    <RippleButton
                                                        className="px-2 py-0.5 text-gray-500 hover:bg-gray-100"
                                                        onClick={() => updateQuantity(item.id, 1, item.variantId)}
                                                    >+</RippleButton>
                                                </div>
                                                <RippleButton
                                                    className="text-xs text-red-500 font-medium hover:underline"
                                                    onClick={() => removeFromCart(item.id, item.variantId)}
                                                >Remove</RippleButton>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        );
    };

    const handleClose = () => {
        setIsCartOpen(false);
        setBuyNowProduct(null);
        setStep('cart');
    };

    if (!isCartOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden">
            <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={handleClose} />

            <div className="absolute inset-y-0 right-0 w-full md:max-w-sm bg-white shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        {step === 'checkout' && (
                            <RippleButton
                                onClick={() => { 
                                    if (buyNowProduct) {
                                        handleClose();
                                    } else {
                                        setStep('cart'); setSelectedAddress(null); setPreview(null); 
                                    }
                                }}
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
                        onClick={handleClose}
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
                            <span className="font-medium text-gray-900">₹{displaySubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div>
                                <span className="text-gray-600">Delivery Fee</span>
                                <p className="text-[10px] text-emerald-600 font-medium">Free for new users!</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {displayDelivery === 0 ? (
                                    <>
                                        <span className="text-gray-400 line-through text-xs">₹{DELIVERY_FEE}</span>
                                        <span className="text-green-600 font-bold">FREE</span>
                                    </>
                                ) : (
                                    <span className="font-medium text-gray-900">₹{displayDelivery}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">Est. Tax</span>
                            <span className="font-medium text-gray-900">₹{displayTax.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-gray-200 my-2 pt-2 flex justify-between items-center">
                            <div>
                                <span className="text-base font-bold text-gray-900">Est. Total</span>
                                <p className="text-[10px] text-gray-400">Exact amount confirmed at checkout</p>
                            </div>
                            <span className="text-xl font-bold text-ud-primary">₹{displayTotal.toFixed(2)}</span>
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
