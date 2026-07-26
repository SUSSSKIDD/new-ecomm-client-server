import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import Header from '../components/united/Header';
import ProductGrid from '../components/united/ProductGrid';
import CartSidebar from '../components/united/CartSidebar';
import ProfileSidebar from '../components/united/ProfilePage';
import ProductDetailView from '../components/united/ProductDetailView';
import { useCategory } from '../context/CategoryContext';
import Footer from '../components/united/Footer';
import { HOME_CATEGORIES } from '../constants';
import { API_URL } from '../lib/api';
import { logEvent } from '../lib/analytics';

// Map HOME_CATEGORIES titles to store types for API filtering
const TITLE_TO_STORE_TYPE = {
    'Grocery': 'GROCERY',
    'Pizza Town & Food Zone': 'PIZZA_TOWN',
    'Home Service': 'HOME_SERVICE',
    'Print Factory': 'DROP_IN_FACTORY',
};

// Category descriptions for SEO
const CATEGORY_DESCRIPTIONS = {
    'Grocery': {
        'Vegetables & Fruits': 'Fresh, locally-sourced vegetables and fruits delivered from Varanasi\'s best farms. Farm-to-door freshness in 30 minutes.',
        'Atta, Rice & Dal': 'Premium quality atta, rice, and dal from trusted brands. Essential pantry staples for your daily cooking needs.',
        'Oil, Ghee & Masala': 'Pure cooking oils, desi ghee, and authentic masalas. Elevate your cooking with the finest ingredients.',
        'Dairy, Bread & Eggs': 'Fresh milk, curd, paneer, bread, and eggs delivered daily. Complete your breakfast essentials.',
        'Bakery & Biscuits': 'Freshly baked goods, cookies, biscuits, and cakes from local bakeries. Perfect for tea-time snacks.',
        'Dry Fruits & Cereals': 'Premium dry fruits, nuts, and healthy cereals. Nutritious snacking options for the whole family.',
        'Chicken, Meat & Fish': 'Fresh, hygienically processed chicken, mutton, and fish. Quality non-veg delivered to your doorstep.',
        'Kitchenware & Appliances': 'Essential kitchen tools, utensils, and small appliances. Make cooking easier and enjoyable.',
        'Chips & Namkeen': 'Crunchy chips, namkeen, and savory snacks. Perfect for munching and entertaining guests.',
        'Sweets & Chocolates': 'Traditional Indian sweets, chocolates, and confectioneries. Satisfy your sweet cravings.',
        'Drinks & Juices': 'Refreshing beverages, fruit juices, soft drinks, and energy drinks. Stay hydrated and refreshed.',
        'Tea, Coffee & Milk Drinks': 'Premium tea, coffee, and flavored milk drinks. Start your day right with the perfect brew.',
        'Instant Food': 'Quick meals, noodles, pasta, and ready-to-cook options. Delicious meals in minutes.',
        'Sauces & Spreads': 'Ketchup, sauces, jams, spreads, and condiments. Add flavor to every meal.',
        'Paan Corner': 'Fresh paan, supari, and mouth fresheners. Traditional after-meal delights.',
        'Ice Creams & More': 'Ice creams, frozen desserts, and cold treats. Perfect for beating the heat.',
        'Bath & Body': 'Soaps, body washes, lotions, and personal care essentials. Feel fresh and clean.',
        'Hair': 'Shampoos, conditioners, oils, and hair care products. Healthy hair starts here.',
        'Skin & Face': 'Face washes, creams, moisturizers, and skincare essentials. Glow naturally.',
        'Beauty & Cosmetics': 'Makeup, cosmetics, and beauty products. Look your best every day.',
        'Feminine Hygiene': 'Sanitary pads, tampons, and intimate care products. Comfort and protection.',
        'Baby Care': 'Diapers, wipes, baby food, and essentials. Care for your little one.',
        'Health & Pharma': 'OTC medicines, supplements, and health essentials. Your wellness partner.',
        'Sexual Wellness': 'Personal intimacy and wellness products. Discreet delivery.',
        'Home & Lifestyle': 'Home decor, furnishings, and lifestyle products. Beautify your space.',
        'Cleaners & Repellents': 'Home cleaning products, detergents, and mosquito repellents. Clean and protected home.',
        'Electronics': 'Mobile accessories, gadgets, and small electronics. Stay connected.',
        'Stationery & Games': 'Office supplies, school stationery, and fun games. Work and play essentials.',
    },
    'Pizza Town & Food Zone': {
        'Pizza': 'Freshly baked pizzas with premium toppings. From classic Margherita to loaded meat lovers.',
        'Burger': 'Juicy burgers with fresh patties and crisp vegetables. Fast food done right.',
        'Sandwich': 'Grilled and cold sandwiches with delicious fillings. Perfect for a quick meal.',
        'French Fries': 'Crispy golden fries, peri-peri, and loaded options. The ultimate side dish.',
        'Cake': 'Fresh cakes for every occasion. Birthday, anniversary, or just because.',
    },
    'Print Factory': {
        'General': 'Custom printing services for all your needs. High-quality prints on various materials.',
        'Photo Frames': 'Personalized photo frames with your favorite memories. Perfect gifts.',
        'Coffee Mugs': 'Custom printed coffee mugs with photos, quotes, or designs. Unique drinkware.',
        'Custom T-Shirts': 'Design your own t-shirts with custom prints. Express your style.',
        'Personalized Gifts': 'Unique personalized gifts for birthdays, anniversaries, and special occasions.',
        'Stationery Printing': 'Custom business cards, letterheads, and stationery. Professional printing.',
    },
};

const SubCategoryPage = () => {
    const { mainCat, subCat } = useParams();
    const navigate = useNavigate();
    const { selectedProduct, setSelectedProduct, setActiveSubCategory } = useCategory();
    const [allSubCategories, setAllSubCategories] = useState([]);
    const scrollContainerRef = useRef(null);

    // Derived values from URL
    const mainCategory = decodeURIComponent(mainCat || '');
    const subCategory = decodeURIComponent(subCat || '');
    const storeType = TITLE_TO_STORE_TYPE[mainCategory] || mainCategory;

    useEffect(() => {
        if (mainCategory && subCategory) {
            logEvent('view_item_list', { item_category: subCategory, item_main_category: mainCategory }).catch(() => {});
        }
    }, [mainCategory, subCategory]);

    // Scroll restoration logic
    useEffect(() => {
        if (!selectedProduct && scrollContainerRef.current) {
            const scrollKey = `scroll_${mainCategory}_${subCategory}`;
            const savedPosition = sessionStorage.getItem(scrollKey);
            if (savedPosition) {
                // Small timeout to allow ProductGrid content to render
                setTimeout(() => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop = parseInt(savedPosition, 10);
                    }
                }, 100);
            }
        }
    }, [selectedProduct, mainCategory, subCategory]);

    // Capture scroll position before selecting product
    const handleProductSelect = (product) => {
        if (scrollContainerRef.current) {
            const scrollKey = `scroll_${mainCategory}_${subCategory}`;
            sessionStorage.setItem(scrollKey, scrollContainerRef.current.scrollTop.toString());
        }
        setSelectedProduct(product);
    };

    useEffect(() => {
        // Initial load from constants
        const staticCat = HOME_CATEGORIES.find(c => c.title === mainCategory);
        if (staticCat) setAllSubCategories(staticCat.items || []);

        // Fetch merged categories from API to include custom subcategories
        fetch(`${API_URL}/stores/categories`)
            .then(r => r.json())
            .then(data => {
                if (!data?.subcategories) return;

                const resolvedStoreType = TITLE_TO_STORE_TYPE[mainCategory];
                if (resolvedStoreType && data.subcategories[resolvedStoreType]) {
                    setAllSubCategories(data.subcategories[resolvedStoreType]);
                }
            })
            .catch(() => { });
    }, [mainCategory]);

    const handleBack = () => {
        if (selectedProduct) {
            setSelectedProduct(null);
        } else {
            navigate('/');
        }
    };

    const handleSubSwitch = (newSub) => {
        setActiveSubCategory(newSub);
        navigate(`/category/${encodeURIComponent(mainCategory)}/${encodeURIComponent(newSub)}`);
    };

    // Get category description for SEO
    const categoryDescription = CATEGORY_DESCRIPTIONS[mainCategory]?.[subCategory] || 
        `Browse ${subCategory} from ${mainCategory} category. Fresh products from local Varanasi stores. Free delivery above ₹199. 30-min delivery.`;

    return (
        <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-gray-50 font-sans text-gray-900">
            <Header />
            <CartSidebar />
            <ProfileSidebar />

            <div 
                ref={scrollContainerRef}
                className={`flex-1 w-full overflow-y-auto scroll-smooth flex flex-col ${selectedProduct ? 'hidden' : ''}`}
            >
                <div className="w-full">
                            {/* Interactive Navigation Bar */}
                            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center px-4 md:px-6">
                                <div className="container mx-auto max-w-7xl flex items-center gap-4 py-3">
                                    {/* Back Button */}
                                    <button
                                        onClick={handleBack}
                                        className="flex-shrink-0 flex items-center gap-2 text-ud-primary font-bold hover:text-ud-dark transition-all group border-r border-gray-200 pr-4 mr-2"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-ud-primary/10 flex items-center justify-center group-hover:bg-ud-primary group-hover:text-white transition-all">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                            </svg>
                                        </div>
                                        <span className="text-[10px] uppercase tracking-widest font-black hidden sm:inline">Home</span>
                                    </button>

                                    {/* Horizontally Scrollable Switcher */}
                                    <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-3">
                                        {allSubCategories.map((sub, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSubSwitch(sub)}
                                                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${sub === subCategory
                                                        ? 'bg-ud-primary text-white shadow-md shadow-blue-500/20 scale-105'
                                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="container mx-auto px-4 py-8 max-w-7xl animate-fade-in min-h-[60vh]">
                                {/* Category Description for SEO */}
                                <section aria-labelledby="category-desc-heading" className="mb-6">
                                    <h2 id="category-desc-heading" className="sr-only">Category Description</h2>
                                    <p className="prose max-w-3xl mx-auto px-4 py-4 text-gray-600 text-sm">
                                        {categoryDescription}
                                    </p>
                                </section>

                                {/* Page Content Card */}
                                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                                    {/* Stylish Header */}
                                    <div className="bg-gradient-to-br from-ud-primary/10 via-white to-transparent p-8 md:p-12 border-b border-gray-50">
                                        <span className="inline-block px-3 py-1 bg-yellow-400 text-black text-[10px] font-black rounded-full uppercase tracking-[0.2em] mb-4 shadow-sm">
                                            {mainCategory}
                                        </span>
                                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                                            <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight uppercase">
                                                {subCategory}
                                            </h1>
                                            <p className="text-gray-500 font-medium max-w-xs text-sm italic">
                                                Curated essentials from our trusted local partners.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Product List Section */}
                                    <div className="p-6 md:p-10">
                                        <ProductGrid 
                                            mainCategory={mainCategory} 
                                            subCategory={subCategory} 
                                            onProductSelect={handleProductSelect}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                    <Footer />
                </div>
            {selectedProduct && <ProductDetailView />}
        </div>
    );
};

export default SubCategoryPage;
