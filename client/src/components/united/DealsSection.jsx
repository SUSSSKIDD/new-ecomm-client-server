import { RippleButton } from '../../components/ui/ripple-button';
import { DEAL_OF_DAY_ITEMS } from '../../constants';

const DealsSection = () => {
    const products = DEAL_OF_DAY_ITEMS;

    return (
        <div className="container mx-auto px-4 md:px-6 mb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-gray-100 pb-4 gap-2">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 uppercase tracking-tight">Today&apos;s Deals of the Day</h3>

                <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                        <span>Ends in:</span>
                        <div className="flex gap-1 text-white text-xs font-bold">
                            <span className="bg-yellow-400 p-1 rounded">12h</span>
                            <span className="bg-yellow-400 p-1 rounded">30m</span>
                        </div>
                    </div>
                    <RippleButton className="text-xs font-bold text-gray-500 hover:text-ud-primary uppercase tracking-wider">View All</RippleButton>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                {products.map((p, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-lg p-3 md:p-4 group hover:shadow-lg transition-shadow relative">
                        <span className="absolute top-2 left-2 md:top-3 md:left-3 bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">-15%</span>

                        <div className="h-32 md:h-48 flex items-center justify-center mb-2 md:mb-4 p-2 md:p-4">
                            <img src={p.image} alt={p.name} className="max-h-full object-contain group-hover:scale-105 transition-transform" />
                        </div>

                        <h4 className="font-bold text-gray-800 text-xs md:text-sm mb-1 line-clamp-2 min-h-[32px] md:min-h-[40px]">{p.name}</h4>

                        {/* Stars */}
                        <div className="flex text-yellow-400 text-[10px] md:text-xs mb-2 md:mb-3">★★★★☆</div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between mt-auto gap-2 md:gap-0">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-400 line-through">{p.original}</span>
                                <span className="text-base md:text-lg font-bold text-ud-primary">{p.price}</span>
                            </div>
                            <RippleButton className="w-full md:w-auto bg-ud-dark text-white text-xs font-bold px-3 py-1.5 md:px-4 md:py-2 rounded hover:bg-ud-primary transition-colors text-center">ADD</RippleButton>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DealsSection;
