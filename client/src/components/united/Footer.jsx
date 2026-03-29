import { Link } from 'react-router-dom';

const Footer = ({ className = "" }) => {
    return (
        <div className={`bg-ud-dark text-white py-12 px-6 mt-auto ${className}`}>
            <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
                <div className="flex flex-col items-center gap-1.5 mb-2">
                    <p className="text-[10px] font-black text-green-400 tracking-[0.4em] uppercase">NEYOKART</p>
                    <div className="w-12 h-0.5 bg-ud-primary rounded-full"></div>
                </div>
                
                <p className="text-xs text-gray-400 text-center leading-relaxed font-medium max-w-sm">
                    Your neighborhood delivery partner — Serving Groceries, Prints &amp; Parcels direct to your doorstep.
                </p>

                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
                    <Link to="/legal#terms" className="text-[10px] text-gray-500 hover:text-white uppercase tracking-wider font-bold transition-colors">Terms &amp; Conditions</Link>
                    <span className="text-gray-800 text-xs hidden sm:inline">•</span>
                    <Link to="/legal#privacy" className="text-[10px] text-gray-500 hover:text-white uppercase tracking-wider font-bold transition-colors">Privacy Policy</Link>
                    <span className="text-gray-800 text-xs hidden sm:inline">•</span>
                    <Link to="/legal#shipping" className="text-[10px] text-gray-500 hover:text-white uppercase tracking-wider font-bold transition-colors">Shipping Policy</Link>
                    <span className="text-gray-800 text-xs hidden sm:inline">•</span>
                    <Link to="/legal#refunds" className="text-[10px] text-gray-500 hover:text-white uppercase tracking-wider font-bold transition-colors">Cancellations &amp; Refunds</Link>
                    <span className="text-gray-800 text-xs hidden sm:inline">•</span>
                    <Link to="/legal#contact" className="text-[10px] text-gray-500 hover:text-white uppercase tracking-wider font-bold transition-colors">Contact Us</Link>
                </div>

                <div className="flex flex-col items-center gap-1 mt-8">
                    <p className="text-[8px] text-gray-600 uppercase tracking-widest">Powered by Advanced Logistics</p>
                    <p className="text-[10px] text-gray-500 font-medium opacity-50">© 2026 NEYOKART. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default Footer;
