const PincodeHeader = () => {
    return (
        <div className="fixed top-0 left-0 right-0 z-50">
            <div className="absolute inset-0 bg-white/80 backdrop-blur-md border-b border-black/5 shadow-sm" />
            <div className="relative px-4 pt-12 pb-3 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">Delivering to</span>
                    <div className="flex items-center space-x-1 cursor-pointer active:opacity-70 transition-opacity">
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">560001</h1>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-gray-700"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                    {/* User Icon or Menu */}
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                </div>
            </div>
        </div>
    );
};

export default PincodeHeader;
