import { useCategory } from '../context/CategoryContext';
import { useLocation } from '../context/LocationContext';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

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

                        {/* Footer */}
                        <div className="bg-ud-dark text-white py-8 px-6 mt-auto shrink-0">
                            <div className="max-w-xl mx-auto flex flex-col items-center gap-3">
                                <p className="text-xs font-semibold text-green-400 tracking-widest uppercase">NEYOKART</p>
                                <p className="text-xs text-gray-400 text-center">
                                    Your neighborhood delivery partner — Groceries, Prints &amp; Parcels.
                                </p>
                                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
                                    <Link to="/legal#terms" className="text-xs text-gray-400 hover:text-white transition-colors">Terms &amp; Conditions</Link>
                                    <span className="text-gray-600 text-xs">·</span>
                                    <Link to="/legal#privacy" className="text-xs text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
                                    <span className="text-gray-600 text-xs">·</span>
                                    <Link to="/legal#shipping" className="text-xs text-gray-400 hover:text-white transition-colors">Shipping Policy</Link>
                                    <span className="text-gray-600 text-xs">·</span>
                                    <Link to="/legal#refunds" className="text-xs text-gray-400 hover:text-white transition-colors">Cancellations &amp; Refunds</Link>
                                    <span className="text-gray-600 text-xs">·</span>
                                    <Link to="/legal#contact" className="text-xs text-gray-400 hover:text-white transition-colors">Contact Us</Link>
                                </div>
                                <p className="text-xs text-gray-600 mt-2">© 2026 NEYOKART. All rights reserved.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnitedDealsHome;
