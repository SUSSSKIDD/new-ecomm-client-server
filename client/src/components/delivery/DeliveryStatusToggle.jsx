import { RippleButton } from '../ui/ripple-button';

const DeliveryStatusToggle = ({ status, onToggle, loading }) => {
    let badgeColor = 'bg-gray-200 text-gray-700';
    let label = 'Off Duty';
    let btnText = 'Go Online';
    let nextStatus = 'FREE';

    if (status === 'FREE') {
        badgeColor = 'bg-emerald-100 text-emerald-700';
        label = 'Available';
        btnText = 'Go Off Duty';
        nextStatus = 'DUTY_OFF';
    } else if (status === 'BUSY') {
        badgeColor = 'bg-orange-100 text-orange-700';
        label = 'Busy - Delivering';
        btnText = 'Delivering...';
        nextStatus = null;
    }

    return (
        <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${badgeColor}`}>
                {label}
            </span>
            <RippleButton
                onClick={() => nextStatus && onToggle(nextStatus)}
                disabled={loading || status === 'BUSY'}
                className={`py-1.5 px-4 text-xs font-bold rounded-full text-white transition-colors duration-300 focus:outline-none shadow-sm ${status === 'BUSY' ? 'bg-orange-400 opacity-60 cursor-not-allowed' :
                        status === 'FREE' ? 'bg-red-500 hover:bg-red-600' :
                            'bg-emerald-500 hover:bg-emerald-600'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {btnText}
            </RippleButton>
        </div>
    );
};

export default DeliveryStatusToggle;
