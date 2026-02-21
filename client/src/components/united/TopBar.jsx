const TopBar = () => {
    return (
        <div className="bg-ud-dark text-white text-[11px] py-2 px-6 flex justify-between items-center font-medium tracking-wide">
            <div className="flex gap-4">
                <span>Welcome to HOMDROP!</span>
            </div>
            <div className="flex gap-6">
                <div className="flex items-center gap-1 cursor-pointer hover:text-ud-secondary transition-colors">
                    <span>English</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
                <div className="flex items-center gap-1 cursor-pointer hover:text-ud-secondary transition-colors">
                    <span>USD</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
                <span className="cursor-pointer hover:text-ud-secondary transition-colors">Track Order</span>
                <span className="cursor-pointer hover:text-ud-secondary transition-colors">Daily Deals</span>
            </div>
        </div>
    );
};

export default TopBar;
