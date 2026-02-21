import { RippleButton } from '../../components/ui/ripple-button';
import PropTypes from 'prop-types';
import { useCategory } from '../../context/CategoryContext';
import { useProductList } from '../../hooks/useProductList';

const ProductGrid = ({ mainCategory }) => {
    const { activeSubCategory, addToCart, setSelectedProduct } = useCategory();

    // Fetch products from API based on category/subcategory
    const { products, loading, error, hasMore, loadMore } = useProductList({
        category: mainCategory,
        subCategory: activeSubCategory,
        limit: 8 // Load 8 at a time for better grid layout (2 rows of 4)
    });

    if (!activeSubCategory) return null;

    if (loading && products.length === 0) {
        return (
            <div className="w-full py-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ud-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full py-8 text-center text-red-500">
                Failed to load products. Please try again.
            </div>
        );
    }

    return (
        <div className="w-full py-2">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{activeSubCategory}</h2>

            {products.length === 0 ? (
                <p className="text-gray-500 italic mt-4 text-center">No products found in this category.</p>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        {products.map((product) => (
                            <div
                                key={product.id}
                                className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 flex flex-col hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => setSelectedProduct({ ...product, category: mainCategory })} // Ensure category context is passed
                            >
                                <div className="h-28 w-full flex items-center justify-center mb-3 bg-gray-50 rounded-md overflow-hidden relative">
                                    {product.images?.[0] ? (
                                        <img src={product.images[0]} alt={product.name} className="h-full object-contain mix-blend-multiply" loading="lazy" />
                                    ) : (
                                        <span className="text-gray-300 text-xs">No Image</span>
                                    )}
                                    {/* Badge for stock */}
                                    {product.stock <= 0 && (
                                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded">OUT OF STOCK</span>
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-sm font-medium text-gray-900 line-clamp-2 mb-1 min-h-[40px]">{product.name}</h3>
                                <div className="flex items-center justify-between mt-auto">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-gray-900">₹{product.price}</span>
                                        {product.mrp && product.mrp > product.price && (
                                            <span className="text-[10px] text-gray-400 line-through">₹{product.mrp}</span>
                                        )}
                                    </div>
                                    <RippleButton
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (product.stock > 0) {
                                                addToCart(product, mainCategory);
                                            }
                                        }}
                                        disabled={product.stock <= 0}
                                        className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${product.stock > 0
                                                ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            }`}
                                    >
                                        ADD
                                    </RippleButton>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load More Button */}
                    {hasMore && (
                        <div className="mt-6 flex justify-center">
                            <RippleButton
                                onClick={loadMore}
                                disabled={loading}
                                className="px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-full hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>}
                                {loading ? 'Loading...' : 'Load More Products'}
                            </RippleButton>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

ProductGrid.propTypes = {
    mainCategory: PropTypes.string,
};

export default ProductGrid;
