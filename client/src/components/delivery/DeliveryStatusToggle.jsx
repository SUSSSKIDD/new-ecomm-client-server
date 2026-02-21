import { RippleButton } from '../ui/ripple-button';
const DeliveryStatusToggle = ({ status, onToggle, loading }) => {
    const isFree = status === 'FREE';

    return (
        <div className="flex items-center gap-3">
            <span className={`text-sm font-bold ${isFree ? 'text-emerald-600' : 'text-orange-500'}`}>
                {isFree ? 'Available' : 'Busy'}
            </span>
            <RippleButton
                onClick={() => onToggle(isFree ? 'BUSY' : 'FREE')}
                disabled={loading}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${isFree ? 'bg-emerald-500' : 'bg-orange-400'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isFree ? 'translate-x-6' : 'translate-x-1'
                        }`}
                />
            </RippleButton>
        </div>
    );
};

export default DeliveryStatusToggle;
