import { useCategory } from '../context/CategoryContext';
import { useLocation } from '../context/LocationContext';
import { useEffect, useRef, useState, useCallback } from 'react';

import Header from '../components/united/Header';
import HeroSection from '../components/united/HeroSection';
import HomeCategoryList from '../components/united/HomeCategoryList';
import CartSidebar from '../components/united/CartSidebar';
import ProductDetailView from '../components/united/ProductDetailView';
import ProfileSidebar from '../components/united/ProfilePage';
import ParcelBooking from './ParcelBooking';
import Footer from '../components/united/Footer';

const SCROLL_THRESHOLD = 10;
const HIDE_AFTER_PX = 60;

const UnitedDealsHome = () => {
    const { toastMessage, selectedProduct, selectedCategory } = useCategory();
    const { requestLocation, locationStatus } = useLocation();
    const [isSearchVisible, setIsSearchVisible] = useState(true);
    const lastScrollY = useRef(0);
    const rafId = useRef(null);
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        if (locationStatus === 'idle') {
            requestLocation();
        }
    }, [requestLocation, locationStatus]);

    // Always show search bar when product/category changes
    useEffect(() => {
        setIsSearchVisible(true);
        lastScrollY.current = 0;
    }, [selectedProduct, selectedCategory]);

    const handleScroll = useCallback(() => {
        if (rafId.current) return;
        rafId.current = requestAnimationFrame(() => {
            rafId.current = null;
            const el = scrollContainerRef.current;
            if (!el) return;
            const currentY = el.scrollTop;
            const delta = currentY - lastScrollY.current;
            if (Math.abs(delta) < SCROLL_THRESHOLD) return;
            if (delta > 0 && currentY > HIDE_AFTER_PX) {
                setIsSearchVisible(false);
            } else if (delta < 0) {
                setIsSearchVisible(true);
            }
            lastScrollY.current = currentY;
        });
    }, []);

    return (
        <div className="h-[100dvh] overflow-hidden bg-white font-sans text-gray-900 relative flex flex-col">
            {toastMessage && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-6 py-3 rounded-lg text-sm font-medium shadow-xl z-50 animate-fade-in-up">
                    {toastMessage}
                </div>
            )}
            <Header isSearchVisible={isSearchVisible} />
            <CartSidebar />
            <ProfileSidebar />

            <div className="flex-1 min-h-0 bg-gray-50 uppercase tracking-tight">
                {selectedProduct ? (
                    <div className="h-full flex flex-col overflow-hidden">
                        <ProductDetailView />
                    </div>
                ) : selectedCategory === 'Pickup and drop' ? (
                    <div ref={scrollContainerRef} onScroll={handleScroll} className="h-full w-full overflow-y-auto flex flex-col">
                        <ParcelBooking />
                        <Footer />
                    </div>
                ) : (
                    <div ref={scrollContainerRef} onScroll={handleScroll} className="h-full w-full overflow-y-auto flex flex-col">
                        <div className="shrink-0">
                            <HeroSection />
                        </div>
                        <div className="flex-1">
                            <HomeCategoryList />
                        </div>
                        <Footer />
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnitedDealsHome;
