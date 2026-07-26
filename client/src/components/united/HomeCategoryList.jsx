import { useCategory } from '../../context/CategoryContext';
import { useCategories } from '../../context/CategoriesContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HOME_CATEGORIES } from '../../constants';

// Map HOME_CATEGORIES titles to store types for merging custom subcategories
const TITLE_TO_STORE_TYPE = {
    'Grocery': 'GROCERY',
    'Pizza Town & Food Zone': 'PIZZA_TOWN',
    'Fashion': 'FASHION',
    'Auto Service & Parts': 'AUTO_SERVICE',
    'Home Service': 'HOME_SERVICE',
    'Print Factory': 'DROP_IN_FACTORY',
    'Auto Parts Shop': 'AUTO_PARTS_SHOP',
};

const HomeCategoryList = () => {
    const { selectedCategory, setActiveSubCategory } = useCategory();
    const { subcategories: apiSubcategories, bannerImages, loading } = useCategories();
    
    const [categories, setCategories] = useState(HOME_CATEGORIES);
    const [expandedSections, setExpandedSections] = useState(new Set());
    const [loadedImages, setLoadedImages] = useState(new Set());
    const observerRef = useRef(null);
    const navigate = useNavigate();

    // Merge API data with static categories when available
    useEffect(() => {
        if (!loading && apiSubcategories && Object.keys(apiSubcategories).length > 0) {
            const merged = HOME_CATEGORIES.map(section => {
                const storeType = TITLE_TO_STORE_TYPE[section.title];
                if (!storeType || !apiSubcategories[storeType]) return section;
                return { ...section, storeType, items: apiSubcategories[storeType] };
            });
            setCategories(merged);
        }
    }, [apiSubcategories, loading]);

    // Setup intersection observer for lazy loading images
    useEffect(() => {
        observerRef.current = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setLoadedImages(prev => new Set([...prev, entry.target.dataset.index]));
                }
            });
        }, { rootMargin: '100px', threshold: 0.1 });
        
        return () => {
            if (observerRef.current) observerRef.current.disconnect();
        };
    }, []);

    const toggleExpand = (title) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    };

    const handleSubCategoryClick = (section, item) => {
        setActiveSubCategory(item);
        const mainCat = encodeURIComponent(section.title);
        const subCat = encodeURIComponent(item);
        navigate(`/category/${mainCat}/${subCat}`);
    };

    const filteredData = selectedCategory === 'All'
        ? categories
        : categories.filter(cat =>
            cat.title.toLowerCase() === selectedCategory.toLowerCase() ||
            (selectedCategory === "Pizza town and food zone" && cat.title === "Pizza Town & Food Zone") ||
            (selectedCategory === "Home service" && cat.title === "Home Service") ||
            (selectedCategory === "Pickup and drop" && cat.title === "Pickup & Drop") ||
            (selectedCategory === "Health Service" && cat.title === "Health Service") ||
            (selectedCategory === "Print factory" && cat.title === "Print Factory")
        );

    return (
        <div className="py-6 space-y-8 bg-gray-50 dark:bg-slate-900">
            {filteredData.map((section, idx) => {
                const isExpanded = expandedSections.has(section.title);
                const items = isExpanded ? section.items : section.items.slice(0, 8);
                return (
                    <div key={idx} className="container mx-auto px-4 md:px-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100">{section.title}</h3>
                            {section.items.length > 0 && (
                                <button 
                                    onClick={() => toggleExpand(section.title)}
                                    className="text-ud-primary text-xs font-bold cursor-pointer hover:underline uppercase tracking-wider"
                                >
                                    {isExpanded ? 'Show Less' : 'View All'}
                                </button>
                            )}
                        </div>

                        {section.items.length > 0 && (
                            <div className={isExpanded 
                                ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 animate-fade-in" 
                                : "flex overflow-x-auto pb-4 gap-4 no-scrollbar snap-x"
                            }>
                                {items.map((item, i) => {
                                    const imageKey = `${section.storeType}:${item}`;
                                    const imageSrc = bannerImages[section.storeType]?.[item];
                                    const isLoaded = loadedImages.has(imageKey);
                                    const observerRef = useRef(null);
                                    
                                    return (
                                        <div
                                            key={i}
                                            className={`${isExpanded ? 'w-full' : 'flex-shrink-0 w-28 md:w-40'} flex flex-col items-center gap-2 group cursor-pointer`}
                                            onClick={() => handleSubCategoryClick(section, item)}
                                        >
                                            <div className={`${isExpanded ? 'w-full aspect-square' : 'w-28 h-28 md:w-40 md:h-40'} rounded-xl shadow-sm border flex items-center justify-center overflow-hidden transition-all border-gray-100 dark:border-slate-800 group-hover:shadow-md bg-white dark:bg-slate-800`}>
                                                {imageSrc && !isLoaded ? (
                                                    <img
                                                        ref={(el) => { observerRef.current = el; }}
                                                        data-src={imageSrc}
                                                        data-index={imageKey}
                                                        alt={item}
                                                        className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                                                        loading="lazy"
                                                    />
                                                ) : imageSrc && isLoaded ? (
                                                    <img
                                                        src={imageSrc}
                                                        alt={item}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="text-4xl font-black select-none text-gray-200 dark:text-gray-700">{item.charAt(0)}</span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] md:text-sm font-medium text-center leading-tight transition-colors text-gray-700 dark:text-gray-400 group-hover:text-ud-primary ${isExpanded ? 'truncate w-full px-1' : ''}`}>
                                                {item}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default HomeCategoryList;