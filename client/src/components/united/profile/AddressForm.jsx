import { RippleButton } from '../../../components/ui/ripple-button';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { INDIAN_STATES } from '../../../utils/constants';

const AddressForm = ({ onSubmit, onCancel, loading, initialData }) => {
    const [formData, setFormData] = useState({
        type: initialData?.type || 'HOME',
        houseNo: initialData?.houseNo || '',
        street: initialData?.street || '',
        city: initialData?.city || '',
        zipCode: initialData?.zipCode || '',
        state: initialData?.state || 'Delhi',
        landmark: initialData?.landmark || '',
        recipientName: initialData?.recipientName || '',
        recipientPhone: initialData?.recipientPhone || '',
        mapsLink: initialData?.mapsLink || '',
        lat: initialData?.lat || null,
        lng: initialData?.lng || null,
    });
    const [gpsLoading, setGpsLoading] = useState(false);
    const [showRecipient, setShowRecipient] = useState(
        !!(initialData?.recipientName || initialData?.recipientPhone),
    );

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleUseLocation = () => {
        if (!navigator.geolocation) return;
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                const updates = { lat: latitude, lng: longitude };

                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
                        { headers: { 'Accept-Language': 'en' } },
                    );
                    const data = await res.json();
                    const addr = data.address || {};

                    updates.houseNo = addr.house_number || '';
                    updates.street = [addr.road, addr.neighbourhood, addr.suburb]
                        .filter(Boolean)
                        .join(', ') || '';
                    updates.city = addr.city || addr.town || addr.village || addr.county || '';
                    updates.zipCode = addr.postcode || '';
                    updates.landmark = addr.neighbourhood || addr.suburb || '';
                    updates.mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

                    // Match state to INDIAN_STATES list
                    const rawState = addr.state || '';
                    const matched = INDIAN_STATES.find(
                        (s) => s.toLowerCase() === rawState.toLowerCase()
                            || rawState.toLowerCase().includes(s.toLowerCase()),
                    );
                    if (matched) updates.state = matched;
                } catch {
                    // Reverse geocoding failed — still save lat/lng
                }

                setFormData((prev) => ({ ...prev, ...updates }));
                setGpsLoading(false);
            },
            () => setGpsLoading(false),
            { enableHighAccuracy: true, timeout: 10000 },
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
                <RippleButton onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full">
                    <svg className="w-5 h-5 text-gray-900 dark:text-gray-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </RippleButton>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{initialData ? 'Edit Address' : 'Add New Address'}</h3>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 px-1 pb-4">
                {/* Type Selection */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-400 mb-2 uppercase">Address Type</label>
                    <div className="flex gap-2">
                        {['HOME', 'WORK', 'OTHER'].map(type => (
                            <RippleButton
                                type="button"
                                key={type}
                                onClick={() => setFormData({ ...formData, type })}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg border ${formData.type === type
                                    ? 'bg-ud-primary text-white border-ud-primary'
                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:border-ud-primary dark:hover:border-ud-primary'
                                    }`}
                            >
                                {type}
                            </RippleButton>
                        ))}
                    </div>
                </div>

                {/* Ordering for someone else? */}
                <div>
                    {!showRecipient ? (
                        <button
                            type="button"
                            onClick={() => setShowRecipient(true)}
                            className="group relative w-full cursor-pointer overflow-hidden rounded-lg border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20 p-3 text-center font-semibold text-orange-700 dark:text-orange-400"
                        >
                            <span className="inline-block translate-x-1 transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
                                Ordering for someone else?
                            </span>
                            <div className="absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-white opacity-0 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100">
                                <span>Ordering for someone else?</span>
                                <ArrowRight className="w-5 h-5" />
                            </div>
                            <div className="absolute left-[20%] top-[40%] h-2 w-2 scale-[1] rounded-lg bg-orange-500 transition-all duration-300 group-hover:left-[0%] group-hover:top-[0%] group-hover:h-full group-hover:w-full group-hover:scale-[1.8] group-hover:bg-orange-500"></div>
                        </button>
                    ) : (
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-100 dark:border-orange-900/50 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-orange-800 dark:text-orange-400 uppercase">Recipient Details</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowRecipient(false);
                                        setFormData((prev) => ({ ...prev, recipientName: '', recipientPhone: '' }));
                                    }}
                                    className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"
                                >
                                    Remove
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    required
                                    name="recipientName"
                                    placeholder="Recipient Name"
                                    value={formData.recipientName}
                                    onChange={handleInputChange}
                                    className="w-full p-2.5 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-orange-400 transition-colors"
                                />
                                <div className="relative group w-full">
                                    <span className="absolute left-3 top-2.5 text-gray-500 font-medium">+91</span>
                                    <input
                                        required
                                        name="recipientPhone"
                                        type="tel"
                                        placeholder="Phone Number"
                                        value={formData.recipientPhone ? formData.recipientPhone.replace('+91', '') : ''}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                                            handleInputChange({ target: { name: 'recipientPhone', value: '+91' + val } });
                                        }}
                                        pattern="[0-9]{10}"
                                        maxLength="10"
                                        inputMode="numeric"
                                        className="w-full pl-12 pr-4 p-2.5 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-orange-400 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Use Current Location Button */}
                <div>
                    <RippleButton
                        type="button"
                        onClick={handleUseLocation}
                        disabled={gpsLoading}
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-emerald-300 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
                    >
                        {gpsLoading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-emerald-300 dark:border-emerald-800 border-t-emerald-600 dark:border-t-emerald-400 rounded-full animate-spin"></span>
                                Detecting location...
                            </>
                        ) : formData.lat ? (
                            <>
                                <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-sm font-medium">Location set ✓</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 text-emerald-500 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-sm font-medium">Use current location</span>
                            </>
                        )}
                    </RippleButton>
                </div>

                {/* Address Fields */}
                <div className="space-y-3">
                    <input
                        required
                        name="houseNo"
                        placeholder="House / Flat / Block No."
                        value={formData.houseNo}
                        onChange={handleInputChange}
                        className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-ud-primary transition-colors"
                    />
                    <input
                        required
                        name="street"
                        placeholder="Apartment / Road / Area"
                        value={formData.street}
                        onChange={handleInputChange}
                        className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-ud-primary transition-colors"
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <input
                            required
                            name="city"
                            placeholder="City"
                            value={formData.city}
                            onChange={handleInputChange}
                            className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-ud-primary transition-colors"
                        />
                        <input
                            required
                            name="zipCode"
                            placeholder="Pincode"
                            value={formData.zipCode}
                            onChange={handleInputChange}
                            className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-ud-primary transition-colors"
                        />
                    </div>

                    <div className="relative">
                        <select
                            required
                            name="state"
                            value={formData.state}
                            onChange={handleInputChange}
                            className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-ud-primary transition-colors appearance-none bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100"
                        >
                            <option value="">Select State</option>
                            {INDIAN_STATES.map((state) => (
                                <option key={state} value={state}>
                                    {state}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                    </div>

                    <input
                        name="landmark"
                        placeholder="Nearby Landmark (Optional)"
                        value={formData.landmark}
                        onChange={handleInputChange}
                        className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-ud-primary transition-colors"
                    />

                    <input
                        name="mapsLink"
                        placeholder="Google/Apple Maps Link (Optional)"
                        value={formData.mapsLink}
                        onChange={handleInputChange}
                        className="w-full p-3 text-sm border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:border-ud-primary transition-colors"
                    />
                </div>

                <div className="pt-4">
                    <RippleButton
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-ud-primary text-white font-bold rounded-xl shadow-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : (initialData ? 'Update Address' : 'Save Address')}
                    </RippleButton>
                </div>
            </form>
        </div>
    );
};

export default AddressForm;
