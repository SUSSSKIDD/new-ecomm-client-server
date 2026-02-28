import { useAuth } from '../context/AuthContext';
import ParcelBookingForm from '../components/united/ParcelBookingForm';
import ParcelOrderList from '../components/united/profile/ParcelOrderList';
import { useState } from 'react';

const ParcelBooking = () => {
    const { isAuthenticated, openLoginModal } = useAuth();
    const [showMyParcels, setShowMyParcels] = useState(false);

    return (
        <div className="w-full bg-gray-50 flex flex-col pt-4">

            {!isAuthenticated ? (
                <div className="flex flex-col items-center justify-center py-20 px-4">
                    <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-ud-primary/10 rounded-full flex items-center justify-center mx-auto">
                            <span className="text-3xl">📦</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Login to Book a Parcel</h2>
                        <p className="text-sm text-gray-500">Sign in to access the pickup & drop service</p>
                        <button onClick={openLoginModal} className="mt-4 px-6 py-2 bg-ud-primary text-white font-bold rounded-lg shadow-md transition-colors hover:bg-emerald-600">
                            Login
                        </button>
                    </div>
                </div>
            ) : (
                <div className="pb-8">
                    {/* Tab Toggle */}
                    <div className="max-w-lg mx-auto px-4 mb-4">
                        <div className="flex bg-white rounded-xl border border-gray-200 p-1">
                            <button
                                onClick={() => setShowMyParcels(false)}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${!showMyParcels ? 'bg-ud-primary text-white' : 'text-gray-500'}`}
                            >
                                Book Parcel
                            </button>
                            <button
                                onClick={() => setShowMyParcels(true)}
                                className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-colors ${showMyParcels ? 'bg-ud-primary text-white' : 'text-gray-500'}`}
                            >
                                My Parcels
                            </button>
                        </div>
                    </div>

                    {showMyParcels ? <ParcelOrderList /> : <ParcelBookingForm />}
                </div>
            )}
        </div>
    );
};

export default ParcelBooking;
