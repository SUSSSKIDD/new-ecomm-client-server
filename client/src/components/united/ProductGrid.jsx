import { RippleButton } from '../../components/ui/ripple-button';
import PropTypes from 'prop-types';
import { useCategory } from '../../context/CategoryContext';
import { useProductList } from '../../hooks/useProductList';

const ProductGrid = ({ mainCategory, subCategory, onProductSelect }) => {
    const { activeSubCategory, addToCart, setSelectedProduct } = useCategory();
    const effectiveSubCategory = subCategory || activeSubCategory;

    // Fetch products from API based on category/subcategory
    const { products, loading, error, hasMore, loadMore } = useProductList({
        category: mainCategory,
        subCategory: effectiveSubCategory,
        limit: 8 // Load 8 at a time for better grid layout (2 rows of 4)
    });

    const handleSelect = (product) => {
        const productWithCat = { ...product, category: mainCategory };
        if (onProductSelect) {
            onProductSelect(productWithCat);
        } else {
            setSelectedProduct(productWithCat);
        }
    };

    if (!effectiveSubCategory) return null;

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
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">{effectiveSubCategory}</h2>

            {products.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 italic mt-4 text-center">No products found in this category.</p>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {products.map((product) => {
                            const hasVariants = product.variants && product.variants.length > 0;
                            const defaultVariant = hasVariants ? product.variants[0] : null;
                            const displayPrice = defaultVariant ? defaultVariant.price : product.price;
                            const displayMrp = defaultVariant ? (defaultVariant.mrp || product.mrp) : product.mrp;
                            const stock = defaultVariant ? defaultVariant.stock : product.stock;

                            return (
                            <div
                                key={product.id}
                                className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 p-4 flex gap-4 hover:shadow-md transition-all cursor-pointer relative"
                                onClick={() => handleSelect(product)}
                            >
                                <div className="h-24 w-24 shrink-0 flex items-center justify-center bg-gray-50 dark:bg-slate-900 rounded-md overflow-hidden relative">
                                    {product.images?.[0] ? (
                                        <img src={product.images[0]} alt={product.name} className="h-full object-contain mix-blend-multiply dark:mix-blend-normal" loading="lazy" />
                                    ) : (
                                        <span className="text-gray-300 dark:text-gray-600 text-[10px]">No Image</span>
                                    )}
                                    {/* Badge for stock */}
                                    {stock <= 0 && !hasVariants && (
                                        <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded">OUT OF STOCK</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1 mb-1">{product.name}</h3>
                                        {hasVariants ? (
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold leading-tight">{product.variants.length} Variants Available</p>
                                        ) : (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-tight">Authentic {product.name} from {mainCategory}</p>
                                        )}
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-auto">
                                        <div className="flex flex-col">
                                            <span className="text-base font-black text-gray-900 dark:text-gray-100">₹{displayPrice}</span>
                                            {displayMrp && displayMrp > displayPrice && (
                                                <span className="text-xs text-gray-400 dark:text-gray-500 line-through">₹{displayMrp}</span>
                                            )}
                                        </div>
                                        <RippleButton
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (hasVariants) {
                                                    handleSelect(product);
                                                } else if (stock > 0) {
                                                    addToCart(product, mainCategory);
                                                }
                                            }}
                                            disabled={!hasVariants && stock <= 0}
                                            className={`px-5 py-2 text-xs font-bold rounded-lg transition-colors ${(hasVariants || stock > 0)
                                                    ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500 shadow-sm'
                                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                }`}
                                        >
                                            {hasVariants ? 'OPTIONS' : 'ADD'}
                                        </RippleButton>
                                    </div>
                                </div>
                            </div>
                            );
                        })}
                    </div>

                    {/* Load More Button */}
                    {hasMore && (
                        <div className="mt-6 flex justify-center">
                            <RippleButton
                                onClick={loadMore}
                                disabled={loading}
                                className="px-6 py-2 bg-yellow-400 text-gray-900 font-bold rounded-full hover:bg-yellow-500 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>}
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
    subCategory: PropTypes.string,
};

export default ProductGrid;
