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

    const value = {
        location,
        locationStatus,
        serviceable,
        nearestStore,
        loading,
        requestLocation,
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
