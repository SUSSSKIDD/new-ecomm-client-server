import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';

const LocationContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const LocationProvider = ({ children }) => {
    const [location, setLocation] = useState(() => {
        const saved = localStorage.getItem('user_location');
        return saved ? JSON.parse(saved) : null;
    }); // { lat, lng }
    const [locationStatus, setLocationStatus] = useState(location ? 'granted' : 'idle'); // idle | requesting | granted | denied
    const [serviceable, setServiceable] = useState(null); // true | false | null
    const [nearestStore, setNearestStore] = useState(null); // { id, name, distance, pincode }
    const [userAddress, setUserAddress] = useState(localStorage.getItem('user_address') || '');
    const [userPincode, setUserPincode] = useState(localStorage.getItem('user_pincode') || '');
    const [loading, setLoading] = useState(false);

    // Effect to check serviceability if location is already present on load
    useEffect(() => {
        if (location && location.lat && location.lng) {
            checkServiceability(location.lat, location.lng, userPincode);
        }
    }, []);

    const checkServiceability = useCallback(async (lat, lng, pincode) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/stores/serviceability`, {
                params: { lat, lng, pincode },
            });
            const { serviceable: isServiceable, nearestStore: nearest } = res.data;
            setServiceable(isServiceable);
            setNearestStore(nearest);
        } catch (err) {
            console.error('Serviceability check failed:', err);
            setServiceable(false);
        } finally {
            setLoading(false);
        }
    }, []);

    const requestLocation = useCallback((force = false) => {
        if (!force && locationStatus === 'granted') return;

        if (!navigator.geolocation) {
            setLocationStatus('denied');
            setServiceable(true);
            return;
        }

        setLocationStatus('requesting');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude: lat, longitude: lng } = position.coords;
                setLocation({ lat, lng });
                setLocationStatus('granted');
                localStorage.setItem('user_location', JSON.stringify({ lat, lng }));
                
                try {
                    const addrRes = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                    if (addrRes.data && addrRes.data.display_name) {
                        const parts = addrRes.data.display_name.split(',');
                        const addr = parts.slice(0, 3).join(', ');
                        setUserAddress(addr);
                        localStorage.setItem('user_address', addr);

                        // Extract pincode if available
                        const pincodeMatch = addrRes.data.display_name.match(/\b\d{6}\b/);
                        if (pincodeMatch) {
                            setUserPincode(pincodeMatch[0]);
                            localStorage.setItem('user_pincode', pincodeMatch[0]);
                        }
                    } else {
                        setUserAddress('Current Location');
                    }
                } catch (e) {
                    setUserAddress('Current Location');
                }

                await checkServiceability(lat, lng);
            },
            (error) => {
                console.warn('Geolocation denied:', error.message);
                setLocationStatus('denied');
                setServiceable(true);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
    }, [checkServiceability, locationStatus]);

    const setManualLocation = useCallback(async (lat, lng, address) => {
        setLocation({ lat, lng });
        setUserAddress(address);
        setLocationStatus('granted');
        localStorage.setItem('user_location', JSON.stringify({ lat, lng }));
        localStorage.setItem('user_address', address);

        // Extract pincode from address string
        const pincodeMatch = address.match(/\b\d{6}\b/);
        const pincode = pincodeMatch ? pincodeMatch[0] : '';
        setUserPincode(pincode);
        localStorage.setItem('user_pincode', pincode);

        await checkServiceability(lat, lng, pincode);
    }, [checkServiceability]);

    const value = {
        location,
        locationStatus,
        serviceable,
        nearestStore,
        userAddress,
        userPincode,
        loading,
        requestLocation,
        setManualLocation,
    };


    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
};

LocationProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

export const useLocation = () => useContext(LocationContext);
