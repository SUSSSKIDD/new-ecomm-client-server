import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';

const LocationContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const LocationProvider = ({ children }) => {
    const [location, setLocation] = useState(null); // { lat, lng }
    const [locationStatus, setLocationStatus] = useState('idle'); // idle | requesting | granted | denied
    const [serviceable, setServiceable] = useState(null); // true | false | null
    const [nearestStore, setNearestStore] = useState(null); // { id, name, distance, pincode }
    const [userAddress, setUserAddress] = useState('');
    const [loading, setLoading] = useState(false);

    // Removed sessionStorage cache block to always refetch on load

    const checkServiceability = useCallback(async (lat, lng) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/stores/serviceability`, {
                params: { lat, lng },
            });
            const { serviceable: isServiceable, nearestStore: nearest } = res.data;
            setServiceable(isServiceable);
            setNearestStore(nearest);

            // Removed sessionStorage.setItem
        } catch (err) {
            console.error('Serviceability check failed:', err);
            // On error, default to not serviceable — show retry message
            setServiceable(false);
        } finally {
            setLoading(false);
        }
    }, []);

    const requestLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationStatus('denied');
            // Assume serviceable if no geolocation API
            setServiceable(true);
            return;
        }

        setLocationStatus('requesting');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude: lat, longitude: lng } = position.coords;
                setLocation({ lat, lng });
                setLocationStatus('granted');
                
                try {
                    const addrRes = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                    if (addrRes.data && addrRes.data.display_name) {
                        const parts = addrRes.data.display_name.split(',');
                        setUserAddress(parts.slice(0, 3).join(', '));
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
                // On denial, assume serviceable to not block customers
                setServiceable(true);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
    }, [checkServiceability]);

    const setManualLocation = useCallback(async (lat, lng, address) => {
        setLocation({ lat, lng });
        setUserAddress(address);
        setLocationStatus('granted');
        await checkServiceability(lat, lng);
    }, [checkServiceability]);

    const value = {
        location,
        locationStatus,
        serviceable,
        nearestStore,
        userAddress,
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
