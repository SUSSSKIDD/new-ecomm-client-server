import { useCategory } from '../../context/CategoryContext';
import { useState, useEffect } from 'react';
import ProductGrid from './ProductGrid';
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
    const { selectedCategory, setActiveSubCategory, activeSubCategory } = useCategory();
    const [categories, setCategories] = useState(HOME_CATEGORIES);
    const [photoUrls, setPhotoUrls] = useState({});

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
            {filteredData.map((section, idx) => (
                <div key={idx} className="container mx-auto px-4 md:px-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg md:text-xl font-bold text-gray-900">{section.title}</h3>
                        {section.items.length > 0 && (
                            <span className="text-ud-primary text-xs font-bold cursor-pointer hover:underline">View All</span>
                        )}
                    </div>

                    {section.items.length > 0 && (
                        <>
                            <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar snap-x">
                                {section.items.map((item, i) => (
                                    <div
                                        key={i}
                                        className="snap-start flex-shrink-0 w-28 md:w-40 flex flex-col items-center gap-2 group cursor-pointer"
                                        onClick={() => setActiveSubCategory(item)}
                                    >
                                        <div className={`w-28 h-28 md:w-40 md:h-40 rounded-xl shadow-sm border flex items-center justify-center overflow-hidden transition-all ${activeSubCategory === item ? 'border-2 border-ud-primary ring-2 ring-ud-primary/20 bg-ud-primary/5' : 'border-gray-100 group-hover:shadow-md bg-white'}`}>
                                            {photoUrls[section.storeType]?.[item] ? (
                                                <img src={photoUrls[section.storeType][item]} alt={item} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className={`text-4xl font-black select-none ${activeSubCategory === item ? 'text-ud-primary' : 'text-gray-200'}`}>{item.charAt(0)}</span>
                                            )}
                                        </div>
                                        <span className={`text-xs md:text-sm font-medium text-center leading-tight transition-colors ${activeSubCategory === item ? 'text-ud-primary font-bold' : 'text-gray-700 group-hover:text-ud-primary'}`}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Inline Product Grid Expansion */}
                            {section.items.includes(activeSubCategory) && (
                                <div className="mt-4 border-t border-gray-100 pt-4 animate-slide-up">
                                    <ProductGrid mainCategory={section.title} />
                                </div>
                            )}
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};

export default HomeCategoryList;
