export const STORE_CATEGORIES = [
    'GROCERY',
    'PIZZA_TOWN',
    'AUTO_SERVICE',
    'DROP_IN_FACTORY',
    'AUTO_PARTS_SHOP',
];

export const STORE_CATEGORY_LABELS = {
    GROCERY: 'Grocery',
    PIZZA_TOWN: 'Pizza Town & Food Zone',
    AUTO_SERVICE: 'Auto Service & Parts',
    DROP_IN_FACTORY: 'Drop In Factory',
    AUTO_PARTS_SHOP: 'Auto Parts Shop',
};

export const STORE_CATEGORY_SUBCATEGORIES = {
    GROCERY: [
        'Vegetables & Fruits',
        'Atta, Rice & Dal',
        'Oil, Ghee & Masala',
        'Dairy, Bread & Eggs',
        'Bakery & Biscuits',
        'Dry Fruits & Cereals',
        'Chicken, Meat & Fish',
        'Kitchenware & Appliances',
        'Chips & Namkeen',
        'Sweets & Chocolates',
        'Drinks & Juices',
        'Tea, Coffee & Milk Drinks',
        'Instant Food',
        'Sauces & Spreads',
        'Paan Corner',
        'Ice Creams & More',
        'Bath & Body',
        'Hair',
        'Skin & Face',
        'Beauty & Cosmetics',
        'Feminine Hygiene',
        'Baby Care',
        'Health & Pharma',
        'Sexual Wellness',
        'Home & Lifestyle',
        'Cleaners & Repellents',
        'Electronics',
        'Stationery & Games',
    ],
    PIZZA_TOWN: ['Pizza', 'Burger', 'Sandwich', 'French Fries', 'Cake'],
    AUTO_SERVICE: ['Car Wash', 'Bike Wash', 'Car Products', 'Bike Products'],
    DROP_IN_FACTORY: [
        'General',
        'Photo Frames',
        'Coffee Mugs',
        'Custom T-Shirts',
        'Personalized Gifts',
        'Stationery Printing',
    ],
    AUTO_PARTS_SHOP: ['Parts', 'Accessories', 'Tools'],
};

// Navigation
export const NAV_ITEMS = [
    'Grocery',
    'Pizza town and food zone',
    'Auto service and parts',
    'Pickup and drop',
    // 'Health Service',
    'Print factory'
];

// Home Categories
export const HOME_CATEGORIES = [
    {
        title: "Grocery",
        items: [
            "Vegetables & Fruits", "Atta, Rice & Dal", "Oil, Ghee & Masala", "Dairy, Bread & Eggs",
            "Bakery & Biscuits", "Dry Fruits & Cereals", "Chicken, Meat & Fish", "Kitchenware & Appliances",
            "Chips & Namkeen", "Sweets & Chocolates", "Drinks & Juices", "Tea, Coffee & Milk Drinks",
            "Instant Food", "Sauces & Spreads", "Paan Corner", "Ice Creams & More", "Bath & Body",
            "Hair", "Skin & Face", "Beauty & Cosmetics", "Feminine Hygiene", "Baby Care",
            "Health & Pharma", "Sexual Wellness", "Home & Lifestyle", "Cleaners & Repellents",
            "Electronics", "Stationery & Games"
        ]
    },
    {
        title: "Pizza Town & Food Zone",
        items: ["Pizza", "Burger", "Sandwich", "French Fries", "Cake"]
    },
    {
        title: "Auto Service & Parts",
        items: ["Car Wash", "Bike Wash", "Car Products", "Bike Products"]
    },
    {
        title: "Pickup & Drop",
        description: "Task-based service. Describe items to pick up and drop off.",
        items: []
    },
    /* {
        title: "Health Service",
        items: ["Call a Doctor", "BP Checking", "Take an Injection", "Blood Test", "Nursing Services", "Physiotherapy"]
    }, */
    {
        title: "Print Factory",
        items: ["General", "Photo Frames", "Coffee Mugs", "Custom T-Shirts", "Personalized Gifts", "Stationery Printing"]
    }
];

// Parcel Categories
export const PARCEL_CATEGORIES = [
    { value: 'DOCUMENTS', label: 'Documents' },
    { value: 'ELECTRONICS', label: 'Electronics' },
    { value: 'CLOTHING_ACCESSORIES', label: 'Clothing & Accessories' },
    { value: 'FOOD_BEVERAGES', label: 'Food & Beverages' },
    { value: 'MEDICINE_HEALTH', label: 'Medicine & Health' },
    { value: 'BOOKS_STATIONERY', label: 'Books & Stationery' },
    { value: 'HOME_KITCHEN', label: 'Home & Kitchen' },
    { value: 'TOYS_GAMES', label: 'Toys & Games' },
    { value: 'SPORTS_FITNESS', label: 'Sports & Fitness' },
    { value: 'PET_SUPPLIES', label: 'Pet Supplies' },
    { value: 'COSMETICS_PERSONAL_CARE', label: 'Cosmetics & Personal Care' },
    { value: 'JEWELRY_VALUABLES', label: 'Jewelry & Valuables' },
    { value: 'AUTO_PARTS', label: 'Auto Parts' },
    { value: 'AGRICULTURAL_PRODUCTS', label: 'Agricultural Products' },
    { value: 'INDUSTRIAL_SUPPLIES', label: 'Industrial Supplies' },
    { value: 'FRAGILE_ITEMS', label: 'Fragile Items' },
    { value: 'OTHERS', label: 'Others' },
];

// Product Grid Data
export const CATEGORY_PRODUCTS_DATA = {
    "Vegetables & Fruits": [
        { id: 1, name: "Fresh Tomato", price: "₹40", image: "https://png.pngtree.com/png-clipart/20230113/ourmid/pngtree-fresh-tomatoes-png-image_6561491.png" },
        { id: 2, name: "Onions (1kg)", price: "₹30", image: "https://png.pngtree.com/png-clipart/20230113/ourmid/pngtree-red-onion-png-image_6561498.png" },
        { id: 3, name: "Potatoes (1kg)", price: "₹25", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT7vJ7E0l7lJ1l4D5v6X8Z4D7q9H3r0M5k3aQ&s" },
    ],
    "Atta, Rice & Dal": [
        { id: 4, name: "Aashirvaad Atta (5kg)", price: "₹220", image: "https://m.media-amazon.com/images/I/71rMg-bA+pL._AC_UF1000,1000_QL80_.jpg" },
        { id: 5, name: "Toor Dal (1kg)", price: "₹140", image: "https://m.media-amazon.com/images/I/71Y8+E1F+dL._AC_UL480_FMwebp_QL65_.jpg" },
    ],
    "Pizza": [
        { id: 6, name: "Margherita Pizza", price: "₹199", image: "https://w7.pngwing.com/pngs/339/55/png-transparent-pizza-margherita-italian-cuisine-hot-dog-pizza-cheese-pizza-thumbnail.png" },
        { id: 7, name: "Farmhouse Pizza", price: "₹299", image: "https://w7.pngwing.com/pngs/56/985/png-transparent-pizza-margherita-salami-calzone-pizza-food-cheese-recipe-thumbnail.png" },
    ],
    "default": [
        { id: 99, name: "Generic Item", price: "₹100", image: "https://via.placeholder.com/150" }
    ]
};

// Brands
export const BRAND_NAMES = ['Amul', 'Nestlé', 'Britannia', 'Tata', 'Dabur', 'Haldirams'];

// Features
export const FEATURE_ITEMS = [
    { icon: '📦', title: 'Free Delivery', sub: 'For all orders over ₹199' },
    { icon: '🥦', title: 'Fresh Guarantee', sub: '100% fresh vegetables' },
    { icon: '💬', title: '24/7 Support', sub: 'Dedicated support' },
    { icon: '↩️', title: 'Easy Return', sub: 'No questions asked' },
];

// Deals
export const DEAL_OF_DAY_ITEMS = [
    { name: 'Fresh Full Cream Milk', price: '₹62', original: '₹66', image: 'https://rukminim2.flixcart.com/image/416/416/xif0q/milk/2/4/j/-original-imagp84ghcf93y8w.jpeg' },
    { name: 'Aashirvaad Atta (5kg)', price: '₹220', original: '₹275', image: 'https://rukminim2.flixcart.com/image/416/416/xif0q/flour/z/t/u/-original-imagqztpzkgsx4my.jpeg' },
    { name: 'Fortune Sun Lite Oil', price: '₹145', original: '₹190', image: 'https://rukminim2.flixcart.com/image/416/416/klzhq4w0/edible-oil/2/p/z/1-sun-lite-sunflower-oil-pouch-fortune-original-imagyzjqy4zgs7gy.jpeg' },
    { name: 'Robusta Bananas (1kg)', price: '₹40', original: '₹60', image: 'https://rukminim2.flixcart.com/image/416/416/xif0q/fruit/e/c/p/-original-imagp84g2cazxx7g.jpeg' }
];

// Unavailble Items (Ghost)
export const UNAVAILABLE_ITEMS = [
    { name: 'Fresh Lobster', price: '₹1200' },
    { name: 'Imported Cheese', price: '₹850' },
    { name: 'Truffle Oil', price: '₹1500' },
];

// Category Grid Items
export const CATEGORY_GRID_ITEMS = [
    { id: 1, name: 'Grocery', color: 'bg-green-100', boldColor: 'bg-emerald-600', text: 'text-emerald-700', icon: '🥦' },
    { id: 2, name: 'Pizza', color: 'bg-red-100', boldColor: 'bg-red-500', text: 'text-red-700', icon: '🍕' },
    { id: 3, name: 'Print', color: 'bg-blue-100', boldColor: 'bg-blue-600', text: 'text-blue-700', icon: '🖨️' },
    { id: 4, name: 'Pharmacy', color: 'bg-pink-100', boldColor: 'bg-pink-500', text: 'text-pink-700', icon: '💊' },
    { id: 5, name: 'Paan', color: 'bg-purple-100', boldColor: 'bg-purple-600', text: 'text-purple-700', icon: '🍂' },
    { id: 6, name: 'Beauty', color: 'bg-orange-100', boldColor: 'bg-orange-500', text: 'text-orange-700', icon: '💄' },
];
