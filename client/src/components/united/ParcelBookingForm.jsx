import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { RippleButton } from '../ui/ripple-button';
import { PARCEL_CATEGORIES } from '../../constants';
import { INDIAN_STATES } from '../../utils/constants';
import { getParcelStatusLabel, getParcelStatusColor } from '../../lib/status';

const EMPTY_ADDRESS = {
    type: 'OTHER',
    houseNo: '',
    street: '',
    city: '',
    zipCode: '',
    state: 'Delhi',
    landmark: '',
    recipientName: '',
    recipientPhone: '',
    mapsLink: '',
    lat: null,
    lng: null,
};

const AddressSection = ({ title, address, setAddress, gpsLoading, onUseLocation }) => {
    const handleChange = (e) => {
        setAddress(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{title}</h4>

            {/* Use Current Location */}
            <button
                type="button"
                onClick={onUseLocation}
                disabled={gpsLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50 text-sm"
            >
                {gpsLoading ? (
                    <>
                        <span className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                        Detecting location...
                    </>
                ) : address.lat ? (
                    <span className="font-medium text-emerald-600">Location set</span>
                ) : (
                    <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-medium">Set your current location</span>
                    </>
                )}
            </button>

            <input name="houseNo" placeholder="House / Flat / Block No." value={address.houseNo} onChange={handleChange}
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
            <input name="street" placeholder="Street / Area *" value={address.street} onChange={handleChange} required
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
            <div className="grid grid-cols-2 gap-3">
                <input name="city" placeholder="City *" value={address.city} onChange={handleChange} required
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
                <input name="zipCode" placeholder="Pincode *" value={address.zipCode} onChange={handleChange} required
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
            </div>
            <select name="state" value={address.state} onChange={handleChange} required
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary bg-white">
                <option value="">Select State</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <input name="landmark" placeholder="Landmark (Optional)" value={address.landmark} onChange={handleChange}
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
            <input name="mapsLink" placeholder="Google Maps Link (Optional)" value={address.mapsLink} onChange={handleChange}
                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
        </div>
    );
};

const ParcelBookingForm = () => {
    const { token } = useAuth();
    const [pickup, setPickup] = useState({ ...EMPTY_ADDRESS });
    const [drop, setDrop] = useState({ ...EMPTY_ADDRESS });
    const [pickupGpsLoading, setPickupGpsLoading] = useState(false);
    const [dropGpsLoading, setDropGpsLoading] = useState(false);

    const [category, setCategory] = useState('');
    const [categoryOther, setCategoryOther] = useState('');
    const [showOtherModal, setShowOtherModal] = useState(false);
    const [weight, setWeight] = useState('');
    const [length, setLength] = useState('');
    const [width, setWidth] = useState('');
    const [height, setHeight] = useState('');

    const [pickupDate, setPickupDate] = useState('');
    const [pickupTimeVal, setPickupTimeVal] = useState('');
    const [dropDate, setDropDate] = useState('');
    const [dropTimeVal, setDropTimeVal] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(null);

    const reverseGeocode = async (lat, lng) => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
                { headers: { 'Accept-Language': 'en' } },
            );
            const data = await res.json();
            const addr = data.address || {};
            const updates = {
                lat, lng,
                houseNo: addr.house_number || '',
                street: [addr.road, addr.neighbourhood, addr.suburb].filter(Boolean).join(', ') || '',
                city: addr.city || addr.town || addr.village || addr.county || '',
                zipCode: addr.postcode || '',
                landmark: addr.neighbourhood || addr.suburb || '',
                mapsLink: `https://www.google.com/maps?q=${lat},${lng}`,
            };
            const rawState = addr.state || '';
            const matched = INDIAN_STATES.find(
                s => s.toLowerCase() === rawState.toLowerCase() || rawState.toLowerCase().includes(s.toLowerCase()),
            );
            if (matched) updates.state = matched;
            return updates;
        } catch {
            return { lat, lng, mapsLink: `https://www.google.com/maps?q=${lat},${lng}` };
        }
    };

    const handleUseLocation = (setAddr, setGpsLoading) => {
        if (!navigator.geolocation) return;
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const updates = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
                setAddr(prev => ({ ...prev, ...updates }));
                setGpsLoading(false);
            },
            () => setGpsLoading(false),
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    const handleCategoryChange = (val) => {
        setCategory(val);
        if (val === 'OTHERS') {
            setShowOtherModal(true);
        } else {
            setCategoryOther('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!pickup.lat || !pickup.lng) {
            setError('Please set pickup location using GPS');
            return;
        }
        if (!pickup.street || !pickup.city || !pickup.zipCode) {
            setError('Please fill in the pickup address details');
            return;
        }
        if (!drop.street || !drop.city || !drop.zipCode) {
            setError('Please fill in the drop address');
            return;
        }
        if (!category) {
            setError('Please select an item category');
            return;
        }
        if (category === 'OTHERS' && !categoryOther.trim()) {
            setError('Please specify the item category');
            return;
        }
        if (!weight || parseFloat(weight) <= 0) {
            setError('Please enter parcel weight');
            return;
        }
        if (!pickupDate || !pickupTimeVal) {
            setError('Please select pickup date and time');
            return;
        }
        if (!dropDate || !dropTimeVal) {
            setError('Please select drop date and time');
            return;
        }

        const pickupTime = new Date(`${pickupDate}T${pickupTimeVal}`);
        const dropTime = new Date(`${dropDate}T${dropTimeVal}`);

        if (pickupTime <= new Date()) {
            setError('Pickup time must be in the future');
            return;
        }
        if (dropTime <= pickupTime) {
            setError('Drop time must be after pickup time');
            return;
        }

        setLoading(true);
        try {
            const safePickup = { ...pickup, lat: pickup.lat || 0, lng: pickup.lng || 0 };
            const safeDrop = { ...drop, lat: drop.lat || 0, lng: drop.lng || 0 };
            const body = {
                pickupAddress: safePickup,
                dropAddress: safeDrop,
                category,
                ...(category === 'OTHERS' ? { categoryOther: categoryOther.trim() } : {}),
                weight: parseFloat(weight),
                ...(length ? { length: parseFloat(length) } : {}),
                ...(width ? { width: parseFloat(width) } : {}),
                ...(height ? { height: parseFloat(height) } : {}),
                pickupTime: pickupTime.toISOString(),
                dropTime: dropTime.toISOString(),
            };

            const res = await api(token).post('/parcels', body);
            setSuccess(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to book parcel');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="max-w-lg mx-auto p-6">
                <div className="bg-white rounded-2xl border border-green-200 p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Parcel Booked!</h3>
                    <p className="text-gray-500 text-sm">Your parcel booking has been submitted for admin approval.</p>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Parcel No.</span>
                            <span className="font-bold text-gray-900">{success.parcelNumber}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Status</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getParcelStatusColor(success.status)}`}>
                                {getParcelStatusLabel(success.status)}
                            </span>
                        </div>
                    </div>
                    <RippleButton
                        onClick={() => { setSuccess(null); setPickup({ ...EMPTY_ADDRESS }); setDrop({ ...EMPTY_ADDRESS }); setCategory(''); setWeight(''); setPickupDate(''); setPickupTimeVal(''); setDropDate(''); setDropTimeVal(''); }}
                        className="w-full py-3 bg-ud-primary text-white font-bold rounded-xl mt-4"
                    >
                        Book Another Parcel
                    </RippleButton>
                </div>
            </div>
        );
    }

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="max-w-lg mx-auto p-4 pb-8">
            <div className="mb-6 text-center">
                <h2 className="text-2xl font-black text-gray-900">Pickup & Drop</h2>
                <p className="text-sm text-gray-500 mt-1">Book a parcel delivery service</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Pickup Address */}
                <AddressSection
                    title="Pickup Address"
                    address={pickup}
                    setAddress={setPickup}
                    gpsLoading={pickupGpsLoading}
                    onUseLocation={() => handleUseLocation(setPickup, setPickupGpsLoading)}
                />

                {/* Drop Address */}
                <AddressSection
                    title="Drop Address"
                    address={drop}
                    setAddress={setDrop}
                    gpsLoading={dropGpsLoading}
                    onUseLocation={() => handleUseLocation(setDrop, setDropGpsLoading)}
                />

                {/* Item Category */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Parcel Details</h4>

                    <div className="relative">
                        <select
                            value={category}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            required
                            className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary bg-white appearance-none"
                        >
                            <option value="">Select Item Category *</option>
                            {PARCEL_CATEGORIES.map(c => (
                                <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>

                    {/* Others modal */}
                    {showOtherModal && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
                                <h4 className="font-bold text-gray-900">Describe your item</h4>
                                <textarea
                                    value={categoryOther}
                                    onChange={(e) => setCategoryOther(e.target.value)}
                                    placeholder="What are you sending?"
                                    rows={3}
                                    className="w-full p-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary"
                                />
                                <RippleButton
                                    type="button"
                                    onClick={() => setShowOtherModal(false)}
                                    className="w-full py-2.5 bg-ud-primary text-white font-bold rounded-lg"
                                >
                                    Done
                                </RippleButton>
                            </div>
                        </div>
                    )}

                    {category === 'OTHERS' && categoryOther && (
                        <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">Item: {categoryOther}</p>
                    )}

                    {/* Weight */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Weight (kg) *</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0.01"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            placeholder="e.g. 2.5"
                            required
                            className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary"
                        />
                    </div>

                    {/* Dimensions (optional) */}
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Dimensions in cm (Optional)</label>
                        <div className="grid grid-cols-3 gap-2">
                            <input type="number" step="0.1" min="0" value={length} onChange={(e) => setLength(e.target.value)}
                                placeholder="Length" className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
                            <input type="number" step="0.1" min="0" value={width} onChange={(e) => setWidth(e.target.value)}
                                placeholder="Width" className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
                            <input type="number" step="0.1" min="0" value={height} onChange={(e) => setHeight(e.target.value)}
                                placeholder="Height" className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
                        </div>
                    </div>
                </div>

                {/* Schedule */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Schedule</h4>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Pickup Date & Time *</label>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)}
                                min={today} required
                                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
                            <input type="time" value={pickupTimeVal} onChange={(e) => setPickupTimeVal(e.target.value)}
                                required
                                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Drop Date & Time *</label>
                        <div className="grid grid-cols-2 gap-2">
                            <input type="date" value={dropDate} onChange={(e) => setDropDate(e.target.value)}
                                min={pickupDate || today} required
                                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
                            <input type="time" value={dropTimeVal} onChange={(e) => setDropTimeVal(e.target.value)}
                                required
                                className="w-full p-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-ud-primary" />
                        </div>
                    </div>
                </div>

                {/* Payment Info */}
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">💵</span>
                        <div>
                            <p className="text-sm font-bold text-amber-800">Cash on Delivery (COD)</p>
                            <p className="text-xs text-amber-600">Pay amount once your parcel is delivered</p>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                <RippleButton
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-ud-primary text-white font-bold text-lg rounded-xl shadow-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                >
                    {loading ? 'Booking...' : 'Book your parcel now'}
                </RippleButton>
            </form>
        </div>
    );
};

export default ParcelBookingForm;
