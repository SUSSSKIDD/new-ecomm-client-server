import { BRAND_NAMES } from '../../constants';
// Replaced local brands array with global constant

const BrandGrid = () => {
    return (
        <div className="container mx-auto px-4 md:px-6 mb-10">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-4">Top Grocery Brands</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
                {BRAND_NAMES.map((brand, i) => (
                    <div key={i} className="bg-gray-50 h-20 md:h-24 rounded-md flex items-center justify-center border border-gray-100 grayscale hover:grayscale-0 transition-all cursor-pointer hover:shadow-md hover:border-ud-primary/20">
                        <span className="text-lg md:text-xl font-serif font-bold text-gray-800">{brand}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BrandGrid;
