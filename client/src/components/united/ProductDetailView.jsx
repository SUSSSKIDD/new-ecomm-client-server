import { useCategory } from '../../context/CategoryContext';
import ImageCarousel from './ImageCarousel';

const ProductDetailView = () => {
    const { selectedProduct, setSelectedProduct, addToCart, setIsCartOpen } = useCategory();

    if (!selectedProduct) return null;

    const price = typeof selectedProduct.price === 'number' ? selectedProduct.price : parseFloat(String(selectedProduct.price).replace('₹', ''));
    const mrp = selectedProduct.mrp ? (typeof selectedProduct.mrp === 'number' ? selectedProduct.mrp : parseFloat(String(selectedProduct.mrp).replace('₹', ''))) : null;
    const discount = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

    const handleBuyNow = () => {
        addToCart(selectedProduct);
        setIsCartOpen(true);
    };

    return (
        <div className="bg-white min-h-screen pb-20">
            {/* Top Navigation */}
            <div className="p-4 flex items-center gap-2 border-b border-gray-100 bg-white sticky top-0 z-40">
                <button
                    onClick={() => setSelectedProduct(null)}
                    className="p-2 -ml-2 text-gray-600 hover:text-ud-primary"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-lg font-bold text-gray-900 truncate flex-1">{selectedProduct.name}</h2>
            </div>

            {/* Hero Image Carousel */}
            <ImageCarousel
                images={selectedProduct.images || []}
                altText={selectedProduct.name}
                className="h-80"
            />

            {/* Product Details */}
            <div className="p-6 space-y-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 leading-tight">{selectedProduct.name}</h1>
                    {selectedProduct.subCategory && (
                        <p className="text-sm text-gray-500 mt-1">{selectedProduct.subCategory}</p>
                    )}
                </div>

                <div className="flex items-baseline gap-4">
                    <span className="text-3xl font-bold text-ud-primary">₹{price}</span>
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

                {/* Additional Info */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <span className="block text-xs text-gray-500 uppercase tracking-wide">Category</span>
                        <span className="font-medium text-gray-900">{selectedProduct.category}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg text-center">
                        <span className="block text-xs text-gray-500 uppercase tracking-wide">Stock</span>
                        <span className={`font-medium ${selectedProduct.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {selectedProduct.stock > 0 ? 'In Stock' : 'Out of Stock'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom Sticky CTAs */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg flex gap-4 z-50">
                <button
                    onClick={() => addToCart(selectedProduct)}
                    disabled={selectedProduct.stock <= 0}
                    className="flex-1 py-3 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Add to Cart
                </button>
                <button
                    onClick={handleBuyNow}
                    disabled={selectedProduct.stock <= 0}
                    className="flex-1 py-3 bg-ud-primary text-white font-bold rounded-lg hover:bg-opacity-90 transition-colors shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Buy Now
                </button>
            </div>
        </div>
    );
};

export default ProductDetailView;
