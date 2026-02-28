import { RippleButton } from '../../components/ui/ripple-button';
import { useCategory } from '../../context/CategoryContext';
import ImageCarousel from './ImageCarousel';

const ProductDetailView = () => {
    const { selectedProduct, setSelectedProduct, addToCart, setIsCartOpen, setBuyNowMode } = useCategory();

    if (!selectedProduct) return null;

    const price = typeof selectedProduct.price === 'number' ? selectedProduct.price : parseFloat(String(selectedProduct.price).replace('₹', ''));
    const mrp = selectedProduct.mrp ? (typeof selectedProduct.mrp === 'number' ? selectedProduct.mrp : parseFloat(String(selectedProduct.mrp).replace('₹', ''))) : null;
    const discount = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

    const handleBuyNow = () => {
        addToCart(selectedProduct);
        setBuyNowMode(true);
        setIsCartOpen(true);
    };

    return (
        <div className="bg-white h-full flex flex-col">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto min-h-0 pb-6">
                {/* Top Navigation */}
                <div className="p-4 flex items-center gap-2 border-b border-gray-100 bg-white sticky top-0 z-40">
                    <RippleButton
                        onClick={() => setSelectedProduct(null)}
                        className="p-2 -ml-2 text-gray-600 hover:text-ud-primary"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </RippleButton>
                    <h2 className="text-lg font-bold text-gray-900 truncate flex-1">{selectedProduct.name}</h2>
                </div>

                {/* Hero Image Carousel */}
                <ImageCarousel
                    images={selectedProduct.images || []}
                    altText={selectedProduct.name}
                    className="h-52 md:h-80"
                />

                {/* Product Details */}
                <div className="p-4 md:p-6 space-y-4">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">{selectedProduct.name}</h1>
                        {selectedProduct.subCategory && (
                            <p className="text-sm text-gray-500 mt-1">{selectedProduct.subCategory}</p>
                        )}
                    </div>

                    <div className="flex items-baseline gap-4">
                        <span className="text-2xl md:text-3xl font-bold text-ud-primary">₹{price}</span>
                        {mrp && mrp > price && (
                            <span className="text-lg text-gray-400 line-through">₹{mrp}</span>
                        )}
                        {discount > 0 && (
                            <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded">{discount}% OFF</span>
                        )}
                    </div>

                    {selectedProduct.description && (
                        <div className="border-t border-gray-100 pt-4">
                            <h3 className="font-bold text-gray-900 mb-2">Product Details</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                {selectedProduct.description}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Always-visible CTA bar */}
            <div className="border-t border-gray-100 p-4 flex gap-4 bg-white shrink-0">
                <RippleButton
                    onClick={() => addToCart(selectedProduct)}
                    disabled={selectedProduct.stock <= 0}
                    className="flex-1 py-3 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {selectedProduct.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                </RippleButton>
                <RippleButton
                    onClick={handleBuyNow}
                    disabled={selectedProduct.stock <= 0}
                    className="flex-1 py-3 bg-ud-primary text-white font-bold rounded-lg hover:bg-opacity-90 transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Buy Now
                </RippleButton>
            </div>
        </div>
    );
};

export default ProductDetailView;
