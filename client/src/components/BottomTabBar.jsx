import PropTypes from 'prop-types';
import { Tabbar, TabbarLink } from 'konsta/react';

const BottomTabBar = ({ activeTab, setActiveTab }) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50">
            <div className="absolute inset-0 bg-white/80 backdrop-blur-md border-t border-black/5" />
            <div className="relative pb-6 pt-2"> {/* Added padding for iPhone Home Indicator */}
                <Tabbar className="bg-transparent" innerClassName="justify-around text-xs font-medium">
                    <TabbarLink
                        active={activeTab === 'home'}
                        onClick={() => setActiveTab?.('home')}
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill={activeTab === 'home' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        }
                        label="Home"
                    />
                    <TabbarLink
                        active={activeTab === 'search'}
                        onClick={() => setActiveTab?.('search')}
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        }
                        label="Search"
                    />
                    <TabbarLink
                        active={activeTab === 'cart'}
                        onClick={() => setActiveTab?.('cart')}
                        icon={
                            <div className="relative">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill={activeTab === 'cart' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                {/* Badge example */}
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">2</span>
                            </div>
                        }
                        label="Cart"
                    />
                    <TabbarLink
                        active={activeTab === 'account'}
                        onClick={() => setActiveTab?.('account')}
                        icon={
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill={activeTab === 'account' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        }
                        label="Account"
                    />
                </Tabbar>
            </div>
        </div>
    );
};

BottomTabBar.propTypes = {
    activeTab: PropTypes.string.isRequired,
    setActiveTab: PropTypes.func.isRequired,
};

export default BottomTabBar;
