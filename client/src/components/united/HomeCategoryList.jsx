import { useCategory } from '../../context/CategoryContext';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HOME_CATEGORIES } from '../../constants';
import { API_URL } from '../../lib/api';

// Map HOME_CATEGORIES titles to store types for merging custom subcategories
const TITLE_TO_STORE_TYPE = {
    'Grocery': 'GROCERY',
    'Pizza Town & Food Zone': 'PIZZA_TOWN',
    'Auto Service & Parts': 'AUTO_SERVICE',
    'Print Factory': 'DROP_IN_FACTORY',
    'Auto Parts Shop': 'AUTO_PARTS_SHOP',
};

const HomeCategoryList = () => {
    const { selectedCategory, setActiveSubCategory } = useCategory();
    const [categories, setCategories] = useState(HOME_CATEGORIES);
    const [photoUrls, setPhotoUrls] = useState({});
    const [expandedSections, setExpandedSections] = useState(new Set());
    const navigate = useNavigate();

    useEffect(() => {
        let cancelled = false;
        fetch(`${API_URL}/stores/categories`)
            .then(r => r.json())
            .then(data => {
                if (cancelled || !data?.subcategories) return;
                const merged = HOME_CATEGORIES.map(section => {
                    const storeType = TITLE_TO_STORE_TYPE[section.title];
                    if (!storeType || !data.subcategories[storeType]) return section;
                    return { ...section, storeType, items: data.subcategories[storeType] };
                });
                setCategories(merged);
                if (data.photoUrls) setPhotoUrls(data.photoUrls);
            })
            .catch(() => {});
        return () => { cancelled = true; };
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
        // Encode parameters for URL safety
        const mainCat = encodeURIComponent(section.title);
        const subCat = encodeURIComponent(item);
        navigate(`/category/${mainCat}/${subCat}`);
    };

    const filteredData = selectedCategory === 'All'
        ? categories
        : categories.filter(cat =>
            cat.title.toLowerCase() === selectedCategory.toLowerCase() ||
            (selectedCategory === "Pizza town and food zone" && cat.title === "Pizza Town & Food Zone") ||
            (selectedCategory === "Auto service and parts" && cat.title === "Auto Service & Parts") ||
            (selectedCategory === "Pickup and drop" && cat.title === "Pickup & Drop") ||
            (selectedCategory === "Health Service" && cat.title === "Health Service") ||
            (selectedCategory === "Print factory" && cat.title === "Print Factory")
        );

    return (
        <div className="py-6 space-y-8 bg-gray-50">
            {filteredData.map((section, idx) => {
                const isExpanded = expandedSections.has(section.title);
                return (
                    <div key={idx} className="container mx-auto px-4 md:px-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg md:text-xl font-bold text-gray-900">{section.title}</h3>
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
                                {section.items.map((item, i) => (
                                    <div
                                        key={i}
                                        className={`${isExpanded ? 'w-full' : 'flex-shrink-0 w-28 md:w-40'} flex flex-col items-center gap-2 group cursor-pointer`}
                                        onClick={() => handleSubCategoryClick(section, item)}
                                    >
                                        <div className={`${isExpanded ? 'w-full aspect-square' : 'w-28 h-28 md:w-40 md:h-40'} rounded-xl shadow-sm border flex items-center justify-center overflow-hidden transition-all border-gray-100 group-hover:shadow-md bg-white`}>
                                            {photoUrls[section.storeType]?.[item] ? (
                                                <img src={photoUrls[section.storeType][item]} alt={item} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-4xl font-black select-none text-gray-200">{item.charAt(0)}</span>
                                            )}
                                        </div>
                                        <span className={`text-[10px] md:text-sm font-medium text-center leading-tight transition-colors text-gray-700 group-hover:text-ud-primary ${isExpanded ? 'truncate w-full px-1' : ''}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default HomeCategoryList;
