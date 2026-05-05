import PropTypes from 'prop-types';
import { useLocation } from '../../../context/LocationContext';
import { ThemeToggle } from '../ThemeToggle';

const HeaderActions = ({ cartCount, onOpenCart, onOpenProfile, onOpenLocation }) => {
    const { userAddress, locationStatus } = useLocation();
    
    const locationText = locationStatus === 'granted' 
        ? (userAddress || 'Current Location') 
        : (locationStatus === 'requesting' ? 'Locating...' : 'Set Location');
    return (
        <div className="flex items-center gap-4 text-gray-600 dark:text-[var(--color-text-secondary)]">
            <ThemeToggle />
            <div className="flex flex-col items-start cursor-pointer hover:text-ud-primary transition-colors group" onClick={onOpenLocation}>
                <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500">Location</span>
                <span className="text-sm font-bold truncate max-w-[100px] sm:max-w-[150px] dark:text-[var(--color-text-primary)]">{locationText}</span>
            </div>

            <div
                className="flex flex-col items-center cursor-pointer hover:text-ud-primary transition-colors group"
                onClick={onOpenProfile}
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>

            <div className="flex flex-col items-center cursor-pointer hover:text-ud-primary transition-colors group" onClick={onOpenCart}>
                <div className="relative">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    {cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                            {cartCount}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

HeaderActions.propTypes = {
    cartCount: PropTypes.number.isRequired,
    onOpenCart: PropTypes.func.isRequired,
    onOpenProfile: PropTypes.func.isRequired,
    onOpenLocation: PropTypes.func.isRequired,
};

export default HeaderActions;
