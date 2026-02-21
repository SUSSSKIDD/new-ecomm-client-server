import { FEATURE_ITEMS } from '../../constants';
// Replaced local features array with global constant

const FeatureBar = () => {
    return (
        <div className="container mx-auto px-4 md:px-6 py-4 md:py-8">
            <div className="bg-white rounded-lg border border-gray-100 p-4 md:p-6 grid grid-cols-2 md:flex justify-between gap-4 shadow-sm">
                {FEATURE_ITEMS.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 md:gap-4 px-0 md:px-4 md:border-r border-gray-100 md:last:border-0 md:flex-1 justify-start md:justify-center">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-gray-200 flex items-center justify-center text-xl md:text-2xl text-ud-primary flex-shrink-0">
                            {f.icon}
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 text-xs md:text-sm uppercase tracking-wide">{f.title}</h4>
                            <span className="text-gray-500 text-[10px] md:text-xs block">{f.sub}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FeatureBar;
