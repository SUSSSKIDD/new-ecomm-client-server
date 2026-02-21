import PropTypes from 'prop-types';

const HeaderNav = ({ navItems, selectedCategory, onSelectCategory }) => {
    return (
        <div className="block border-t border-gray-100 bg-white shadow-sm">
            <div className="container mx-auto px-2 md:px-6">
                <ul className="flex items-center gap-2 md:gap-4 text-xs md:text-sm font-medium text-gray-600 py-2 overflow-x-auto no-scrollbar">
                    {navItems.map((item, i) => (
                        <li
                            key={i}
                            onClick={() => onSelectCategory(item)}
                            className={`whitespace-nowrap px-3 py-1 rounded-full border cursor-pointer transition-all ${selectedCategory === item
                                ? 'bg-ud-primary text-white border-ud-primary'
                                : 'bg-gray-50 border-gray-100 hover:bg-ud-primary hover:text-white hover:border-ud-primary'
                                }`}
                        >
                            {item}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

HeaderNav.propTypes = {
    navItems: PropTypes.arrayOf(PropTypes.string).isRequired,
    selectedCategory: PropTypes.string.isRequired,
    onSelectCategory: PropTypes.func.isRequired,
};

export default HeaderNav;
