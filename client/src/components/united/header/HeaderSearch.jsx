import { RippleButton } from '../../../components/ui/ripple-button';
import PropTypes from 'prop-types';
import { useProductSearch } from '../../../hooks/useProductSearch';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const HeaderSearch = () => {
    const { query, setQuery, results, loading, error } = useProductSearch();
    const [showResults, setShowResults] = useState(false);
    const navigate = useNavigate();

    const handleSearch = (e) => {
        setQuery(e.target.value);
        setShowResults(true);
    };

    const handleSelect = (product) => {
        setQuery(product.name);
        setShowResults(false);
        navigate(`/product/${product.id}`);
    };

    return (
        <div className="bg-white dark:bg-[var(--color-bg-surface)] pb-1.5 px-4 z-40 relative">
            <div className="container mx-auto">
                <div className="flex items-center border border-gray-300 dark:border-slate-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-slate-800 focus-within:ring-1 focus-within:ring-ud-primary transition-all relative">

                    <input
                        type="text"
                        placeholder="Search for products..."
                        className="flex-1 px-4 py-2 bg-transparent outline-none text-sm text-gray-700 dark:text-gray-200 placeholder-gray-500 w-full min-w-0"
                        value={query || ''}
                        onChange={handleSearch}
                        onBlur={() => setTimeout(() => setShowResults(false), 200)} // Delay to allow click
                        onFocus={() => setShowResults(true)}
                    />
                    <RippleButton className="px-4 py-2 bg-yellow-400 text-gray-900">
                        {loading ? (
                            <div className="animate-spin h-5 w-5 border-2 border-gray-900 border-t-transparent rounded-full"></div>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        )}
                    </RippleButton>
                </div>

                {/* Search Results Dropdown */}
                {showResults && results && results.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                        <ul>
                            {results.map((product) => (
                                <li
                                    key={product.id}
                                    onClick={() => handleSelect(product)}
                                    className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-3 border-b border-gray-50 dark:border-slate-700 last:border-none"
                                >
                                    {product.images?.[0] && (
                                        <img src={product.images[0]} alt={product.name} className="w-8 h-8 object-cover rounded" />
                                    )}
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{product.subCategory || product.category}</p>
                                    </div>
                                    <span className="ml-auto text-sm font-bold text-gray-900 dark:text-gray-100">₹{product.price}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {showResults && !loading && query && results.length === 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-50 p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No products found.
                    </div>
                )}

                {/* Free Delivery Text */}
                <div className="text-center mt-1">
                    <span className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wide bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full inline-block">
                        Free delivery for orders above ₹199
                    </span>
                </div>
            </div>
        </div>
    );
};



export default HeaderSearch;
