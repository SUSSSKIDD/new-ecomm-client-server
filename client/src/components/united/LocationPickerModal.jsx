import { useState } from 'react';
import axios from 'axios';
import { RippleButton } from '../ui/ripple-button';
import { useLocation } from '../../context/LocationContext';

const LocationPickerModal = ({ isOpen, onClose }) => {
    const { requestLocation, locationStatus, setManualLocation } = useLocation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);

    if (!isOpen) return null;

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        setSearching(true);
        try {
            const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in`);
            setResults(res.data || []);
        } catch (err) {
            console.error('Search failed', err);
        } finally {
            setSearching(false);
        }
    };

    const handleSelectLocation = (result) => {
        const addr = result.display_name.split(',').slice(0, 3).join(', ');
        setManualLocation(parseFloat(result.lat), parseFloat(result.lon), addr);
        setQuery('');
        setResults([]);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] overflow-hidden flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={onClose} />
            <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shrink-0">
                    <h2 className="text-xl font-bold text-gray-900">Choose your location</h2>
                    <RippleButton onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </RippleButton>
                </div>
                <div className="p-6 space-y-6 bg-gray-50 overflow-y-auto">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Search your area or pincode..." 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900"
                        />
                        <button type="submit" disabled={searching || !query} className="px-4 bg-ud-primary text-white rounded-xl font-bold disabled:opacity-50">
                            {searching ? '...' : 'Search'}
                        </button>
                    </form>

                    {results.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                            {results.map((r, i) => (
                                <div key={i} onClick={() => handleSelectLocation(r)} className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between transition-colors">
                                    <p className="text-sm text-gray-800 line-clamp-2">{r.display_name}</p>
                                    <svg className="w-4 h-4 text-gray-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-gray-50 text-gray-500">Or</span>
                        </div>
                    </div>

                    <RippleButton 
                        onClick={() => {
                            requestLocation();
                            onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-emerald-100 text-emerald-700 font-bold py-3 px-4 rounded-xl hover:bg-emerald-200 transition-colors"
                    >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Use Current Location
                    </RippleButton>
                </div>
            </div>
        </div>
    );
};

export default LocationPickerModal;
