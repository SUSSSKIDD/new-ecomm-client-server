import PropTypes from 'prop-types';
import { CATEGORY_GRID_ITEMS } from '../constants';

const CategoryGrid = ({ variation = 'minimal' }) => {

    // Variation A: Minimal (Standard Grid, White Card, Bold Text)
    if (variation === 'minimal') {
        return (
            <div className="px-4 py-4">
                <h2 className="text-lg font-bold mb-3 text-gray-800 tracking-tight">Shop by Category</h2>
                <div className="grid grid-cols-3 gap-3">
                    {CATEGORY_GRID_ITEMS.map((cat) => (
                        <div key={cat.id} className="bg-white rounded-2xl shadow-sm p-3 flex flex-col items-center justify-center aspect-[1/1.1] active:scale-95 transition-transform">
                            <span className="text-4xl mb-2 filter drop-shadow-sm">{cat.icon}</span>
                            <span className="font-bold text-xs text-center text-gray-800 leading-tight">{cat.name}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Variation B: Bold (Full Color Tiles)
    if (variation === 'bold') {
        return (
            <div className="px-4 py-4">
                <h2 className="text-lg font-bold mb-3 text-gray-800 tracking-tight">Explore</h2>
                <div className="grid grid-cols-2 gap-3">
                    {CATEGORY_GRID_ITEMS.map((cat) => (
                        <div key={cat.id} className={`${cat.boldColor} relative rounded-2xl shadow-sm p-4 flex flex-col justify-between aspect-[1.6/1] overflow-hidden active:opacity-90 transition-opacity`}>
                            {/* Pattern overlay */}
                            <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4 scale-150 text-white">
                                <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" /></svg>
                            </div>

                            <span className="font-extrabold text-xl text-white tracking-wide z-10">{cat.name}</span>
                            <span className="text-4xl self-end filter drop-shadow-md z-10 transform translate-y-1">{cat.icon}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Variation C: List (Horizontal Scroll)
    if (variation === 'list') {
        return (
            <div className="py-4">
                <div className="px-4 flex justify-between items-center mb-3">
                    <h2 className="text-lg font-bold text-gray-800 tracking-tight">Categories</h2>
                    <span className="text-emerald-600 text-xs font-bold uppercase tracking-wider">View All</span>
                </div>
                <div className="flex overflow-x-auto px-4 gap-4 no-scrollbar pb-2">
                    {CATEGORY_GRID_ITEMS.map((cat) => (
                        <div key={cat.id} className="flex-none w-20 flex flex-col items-center gap-2 group">
                            <div className={`w-16 h-16 ${cat.color} rounded-full flex items-center justify-center shadow-sm group-active:scale-95 transition-transform`}>
                                <span className="text-2xl">{cat.icon}</span>
                            </div>
                            <span className={`text-xs font-semibold ${cat.text} text-center`}>{cat.name}</span>
                        </div>
                    ))}
                    {/* Spacer for right padding */}
                    <div className="w-2 flex-none"></div>
                </div>
            </div>
        );
    }

    return null;
};

CategoryGrid.propTypes = {
    variation: PropTypes.oneOf(['minimal', 'bold', 'list']),
};

export default CategoryGrid;
