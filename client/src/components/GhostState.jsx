import { RippleButton } from './ui/ripple-button';
import { Block, BlockTitle } from 'konsta/react';
import { UNAVAILABLE_ITEMS } from '../constants';

const GhostState = () => {
    return (
        <div className="mt-8 mb-4">
            <BlockTitle className="text-gray-400 font-semibold uppercase tracking-wider text-xs ml-4 mb-2">Unavailable in your area</BlockTitle>
            <Block className="my-0 space-y-3">
                {UNAVAILABLE_ITEMS.map((item, index) => (
                    <div key={index} className="flex items-center p-3 bg-white rounded-xl shadow-sm opacity-60 grayscale relative">
                        <div className="w-16 h-16 bg-gray-200 rounded-lg mr-4 animate-pulse"></div>
                        <div className="flex-1">
                            <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                            <div className="h-3 w-16 bg-gray-200 rounded"></div>
                        </div>
                        <div className="absolute top-3 right-3 text-[10px] font-bold text-gray-400 border border-gray-300 px-2 py-0.5 rounded-full">
                            Sold Out
                        </div>
                    </div>
                ))}
                <div className="text-center mt-4">
                    <RippleButton className="text-gray-400 text-sm font-medium flex items-center justify-center w-full py-2 hover:bg-gray-100/50 rounded-lg transition-colors">
                        View all unavailable items
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </RippleButton>
                </div>
            </Block>
        </div>
    );
};

export default GhostState;
