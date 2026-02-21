import { RippleButton } from '../../components/ui/ripple-button';
import { useCategory } from '../../context/CategoryContext';
import ProductGrid from './ProductGrid';
import { HOME_CATEGORIES } from '../../constants';

const HomeCategoryList = () => {
    const { selectedCategory, setActiveSubCategory, activeSubCategory } = useCategory();

    const filteredData = selectedCategory === 'All'
        ? HOME_CATEGORIES
        : HOME_CATEGORIES.filter(cat =>
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

                    {section.items.length > 0 ? (
                        <>
                            <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar snap-x">
                                {section.items.map((item, i) => (
                                    <div
                                        key={i}
                                        className="snap-start flex-shrink-0 w-28 md:w-40 flex flex-col items-center gap-2 group cursor-pointer"
                                        onClick={() => setActiveSubCategory(item)}
                                    >
                                        <div className={`w-28 h-28 md:w-40 md:h-40 rounded-xl shadow-sm border flex items-center justify-center overflow-hidden transition-all ${activeSubCategory === item ? 'border-2 border-ud-primary ring-2 ring-ud-primary/20' : 'border-gray-100 group-hover:shadow-md'}`}>
                                            <div className="bg-white w-full h-full flex items-center justify-center">
                                                <span className={`text-4xl font-black select-none ${activeSubCategory === item ? 'text-ud-primary' : 'text-gray-200'}`}>{item.charAt(0)}</span>
                                            </div>
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
                    ) : (
                        // Special case for Pickup & Drop
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-gray-800 mb-1">Send Packages Anywhere</h4>
                                <p className="text-sm text-gray-500">{section.description}</p>
                            </div>
                            <RippleButton className="bg-ud-primary text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-800 transition-colors">
                                Book Now
                            </RippleButton>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default HomeCategoryList;
