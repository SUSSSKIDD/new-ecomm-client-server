import { useState, useEffect } from 'react';
import { RippleButton } from '../../components/ui/ripple-button';
import { useCategory } from '../../context/CategoryContext';
import ImageCarousel from './ImageCarousel';
import { logEvent } from '../../lib/analytics';

const ProductDetailView = () => {
    const { selectedProduct, setSelectedProduct, addToCart, setBuyNowProduct, setIsCartOpen } = useCategory();

    const [selectedVariant, setSelectedVariant] = useState(null);

    useEffect(() => {
        if (selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0) {
            setSelectedVariant(selectedProduct.variants[0]);
        } else {
            setSelectedVariant(null);
        }
    }, [selectedProduct]);

    useEffect(() => {
        if (selectedProduct) {
            logEvent('view_item', { item_id: selectedProduct.id, item_name: selectedProduct.name, price: selectedProduct.price }).catch(() => {});
        }
    }, [selectedProduct]);

    if (!selectedProduct) return null;

    const basePrice = selectedVariant ? selectedVariant.price : selectedProduct.price;
    const baseMrp = selectedVariant ? (selectedVariant.mrp || null) : (selectedProduct.mrp || null);
    
    const price = typeof basePrice === 'number' ? basePrice : parseFloat(String(basePrice).replace('₹', ''));
    const mrp = baseMrp ? (typeof baseMrp === 'number' ? baseMrp : parseFloat(String(baseMrp).replace('₹', ''))) : null;
    const discount = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
    
    const stock = selectedVariant ? selectedVariant.stock : selectedProduct.stock;

    const handleBuyNow = () => {
        const payload = { ...selectedProduct, quantity: 1, price, mrp };
        if (selectedVariant) {
            payload.variantId = selectedVariant.id;
            payload.variantLabel = selectedVariant.label;
        }
        setBuyNowProduct(payload);
        setIsCartOpen(true);
        setSelectedProduct(null);
    };

    const handleAddToCart = () => {
        const customFields = selectedVariant ? { variantId: selectedVariant.id, variantLabel: selectedVariant.label } : {};
        addToCart({ ...selectedProduct, price, mrp }, undefined, customFields);
    };

    return (
        <div className="bg-white dark:bg-slate-900 h-full min-h-0 flex flex-col">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0 pb-6">
                {/* Top Navigation */}
                <div className="p-4 flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40">
                    <RippleButton
                        onClick={() => setSelectedProduct(null)}
                        className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:text-ud-primary dark:hover:text-ud-primary"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </RippleButton>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate flex-1">{selectedProduct.name}</h2>
                </div>

                {/* Hero Image Carousel */}
                <ImageCarousel
                    images={(selectedVariant?.images?.length ? selectedVariant.images : selectedProduct.images) || []}
                    altText={selectedProduct.name}
                    className="h-52 md:h-80"
                />

                {/* Product Details */}
                <div className="p-4 md:p-6 space-y-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">{selectedProduct.name}</h1>
                        {selectedProduct.subCategory && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedProduct.subCategory}</p>
                        )}
                    </div>

                    <div className="flex items-baseline gap-4">
                        <span className="text-2xl md:text-3xl font-bold text-ud-primary dark:text-emerald-400">₹{price}</span>
                        {mrp && mrp > price && (
                            <span className="text-lg text-gray-400 dark:text-gray-600 line-through">₹{mrp}</span>
                        )}
                        {discount > 0 && (
                            <span className="text-sm font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">{discount}% OFF</span>
                        )}
                    </div>

                    {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Select Variant</h3>
                            <div className="flex flex-wrap gap-2">
                                {selectedProduct.variants.map((v) => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        onClick={() => setSelectedVariant(v)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                            selectedVariant?.id === v.id
                                                ? 'bg-ud-primary text-white border-ud-primary'
                                                : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:border-ud-primary dark:hover:border-ud-primary'
                                        }`}
                                    >
                                        {v.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {selectedProduct.description && (
                        <div className="border-t border-gray-100 dark:border-slate-800 pt-4">
                            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Product Details</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                                {selectedProduct.description}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Always-visible CTA bar */}
            <div className="border-t border-gray-100 dark:border-slate-800 p-3 flex gap-3 bg-white dark:bg-slate-900 shrink-0">
                <RippleButton
                    onClick={handleAddToCart}
                    disabled={stock <= 0}
                    className="flex-1 py-2.5 bg-yellow-400 text-black font-bold text-sm rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                </RippleButton>
                <RippleButton
                    onClick={handleBuyNow}
                    disabled={stock <= 0}
                    className="flex-1 py-2.5 bg-ud-primary text-white font-bold text-sm rounded-lg hover:bg-opacity-90 transition-colors shadow-lg shadow-blue-500/30 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Buy Now
                </RippleButton>
            </div>
        </div>
    );
};

export default ProductDetailView;
