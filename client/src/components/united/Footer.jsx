import { Link } from 'react-router-dom';

const Footer = ({ className = "" }) => {
    return (
        <footer className={`bg-[#0a0f18] text-gray-400 py-8 px-6 mt-auto border-t border-gray-800/50 ${className}`}>
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
                
                {/* Policy Links */}
                <div className="flex flex-col md:flex-row items-center gap-x-8 gap-y-3">
                    <h4 className="text-white text-[10px] font-black uppercase tracking-widest md:mr-4">Policies</h4>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px] uppercase font-bold tracking-wider">
                        <Link to="/legal#terms" className="hover:text-white transition-colors">Terms</Link>
                        <Link to="/legal#privacy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link to="/legal#refunds" className="hover:text-white transition-colors">Refunds</Link>
                        <Link to="/legal#shipping" className="hover:text-white transition-colors">Shipping</Link>
                    </div>
                </div>

                {/* Support & Legal */}
                <div className="flex flex-col md:flex-row items-center gap-x-8 gap-y-3">
                    <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-wider">
                        <Link to="/legal#contact" className="text-white hover:text-ud-primary transition-colors">Contact Us</Link>
                        <span className="text-gray-800 hidden md:inline">|</span>
                        <p className="text-gray-600 opacity-60">© 2026 NEYOKART</p>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
