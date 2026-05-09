import { TextMarquee } from '../../components/ui/text-marquee';
import { useCategory } from '../../context/CategoryContext';
import { useLocation as useDeviceLocation } from '../../context/LocationContext';
import { useLocation as useRouterLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { NAV_ITEMS } from '../../constants';

import LocationPickerModal from './LocationPickerModal';
import HeaderLogo from './header/HeaderLogo';
import HeaderActions from './header/HeaderActions';
import HeaderSearch from './header/HeaderSearch';
import HeaderNav from './header/HeaderNav';

const DELIVERY_SPEED_KMPH = 25;
const BUFFER_MINUTES = 5;

function getDeliveryTime(distanceKm) {
    return Math.ceil((distanceKm / DELIVERY_SPEED_KMPH) * 60 + BUFFER_MINUTES);
}

const isNonOperational = () => {
    try {
        const istTime = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const hours = istTime.getHours();
        const minutes = istTime.getMinutes();
        return hours >= 22 || hours < 5 || (hours === 5 && minutes < 30);
    } catch (e) {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        return hours >= 22 || hours < 5 || (hours === 5 && minutes < 30);
    }
};

const Header = ({ isSearchVisible = true }) => {
    const {
        selectedCategory,
        setSelectedCategory,
        cart,
        setIsCartOpen,
        setActivePage,
        setSelectedProduct,
        setActiveSubCategory
    } = useCategory();
    const { nearestStore, requestLocation } = useDeviceLocation();
    const routerLocation = useRouterLocation();
    const navigate = useNavigate();
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

    const deliveryMins = nearestStore ? getDeliveryTime(nearestStore.distance) : null;

    const handleCategorySelect = (cat) => {
        setSelectedCategory(cat);
        setSelectedProduct(null);
        // If we are not on the home page, navigate back to home to show the category
        if (routerLocation.pathname !== '/') {
            navigate('/');
        }
    };

    const handleLogoClick = () => {
        setSelectedCategory('All');
        setActiveSubCategory(null);
        setSelectedProduct(null);
        setActivePage('home');
        if (routerLocation.pathname !== '/') {
            navigate('/');
        }
    };

    return (
        <div className="bg-white dark:bg-[var(--color-bg-surface)] shadow-sm sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
            {/* Location Bar - Only show on home page */}
            {routerLocation.pathname === '/' && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-900 border-b border-emerald-100 dark:border-slate-700">
                    <div className="container mx-auto px-4 py-1 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 dark:text-emerald-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {nearestStore ? (
                                <div className="flex-1 min-w-0">
                                    <TextMarquee
                                        baseVelocity={-3}
                                        delay={300}
                                        className="text-[10px] font-bold tracking-tight text-emerald-700"
                                    >
                                        {isNonOperational() 
                                            ? `We are not accepting orders right now. Our operational hours are 6:00 AM to 10:00 PM. You can place your order for tomorrow, and it will be delivered.  ·  Free delivery above ₹199  ·  `
                                            : `Neyokart in ${deliveryMins} mins  ·  Free delivery above ₹199  ·  `
                                        }
                                    </TextMarquee>
                                </div>
                            ) : (
                                <span className="font-medium" onClick={requestLocation}>Set your delivery location</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 1. Main Header Row: Logo and Icons */}
            <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4">
                <HeaderLogo onReset={handleLogoClick} />
                <HeaderActions
                    cartCount={cart.length}
                    onOpenCart={() => setIsCartOpen(true)}
                    onOpenProfile={() => setActivePage('profile')}
                    onOpenLocation={() => setIsLocationModalOpen(true)}
                />
            </div>

            {/* 2. Search Bar Row (hide-on-scroll) */}
            <div
                className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
                style={{
                    maxHeight: isSearchVisible ? '120px' : '0px',
                    opacity: isSearchVisible ? 1 : 0,
                    willChange: 'max-height, opacity',
                    pointerEvents: isSearchVisible ? 'auto' : 'none',
                }}
            >
                <div className="pb-2">
                    <HeaderSearch />
                    <HeaderNav
                        navItems={NAV_ITEMS}
                        selectedCategory={selectedCategory}
                        onSelectCategory={handleCategorySelect}
                    />
                </div>
            </div>
            
            <LocationPickerModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} />
        </div>
    );
};

export default Header;
