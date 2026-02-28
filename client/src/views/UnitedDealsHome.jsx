import { useCategory } from '../context/CategoryContext';
import { useLocation } from '../context/LocationContext';
import { useEffect } from 'react';

import Header from '../components/united/Header';
import HeroSection from '../components/united/HeroSection';
import HomeCategoryList from '../components/united/HomeCategoryList';
import CartSidebar from '../components/united/CartSidebar';
import ProductDetailView from '../components/united/ProductDetailView';
import ProfileSidebar from '../components/united/ProfilePage';
import ParcelBooking from './ParcelBooking';

const UnitedDealsHome = () => {
    const { toastMessage, selectedProduct, selectedCategory } = useCategory();
    const { requestLocation } = useLocation();

    useEffect(() => {
        requestLocation();
    }, [requestLocation]);

    return (
        <div className="h-[100dvh] overflow-hidden bg-white font-sans text-gray-900 relative flex flex-col">
            {toastMessage && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-6 py-3 rounded-lg text-sm font-medium shadow-xl z-50 animate-fade-in-up">
                    {toastMessage}
                </div>
            )}
            <Header />
            <CartSidebar />
            <ProfileSidebar />

            <div className="flex-1 min-h-0 bg-gray-50">
                {selectedProduct ? (
                    <ProductDetailView />
                ) : selectedCategory === 'Pickup and drop' ? (
                    <div className="h-full w-full overflow-y-auto overscroll-none flex flex-col">
                        <ParcelBooking />
                    </div>
                ) : (
                    <div className="h-full w-full overflow-y-auto overscroll-none flex flex-col">
                        <div className="shrink-0">
                            <HeroSection />
                        </div>

                        <div className="flex-1">
                            <HomeCategoryList />
                        </div>

                        {/* Content Peek / Footer */}
                        <div className="bg-ud-dark text-white py-12 px-6 mt-auto text-center md:text-left shrink-0">
                            {/* Simplified footer for mobile */}
                            <p className="text-sm text-gray-400">© 2026 NEYOKART. All Freshness Guaranteed.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnitedDealsHome;
