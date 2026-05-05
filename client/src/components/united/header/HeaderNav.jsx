import PropTypes from 'prop-types';

const HeaderNav = ({ navItems, selectedCategory, onSelectCategory }) => {
    return (
        <div className="block border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-[var(--color-bg-surface)] shadow-sm">
            <div className="container mx-auto px-2 md:px-6">
                <ul className="flex items-center gap-2 md:gap-4 text-xs md:text-sm font-medium text-gray-600 dark:text-[var(--color-text-secondary)] py-2 overflow-x-auto no-scrollbar">
                    {navItems.map((item, i) => (
                        <li
                            key={i}
                            onClick={() => onSelectCategory(item)}
                            className={`whitespace-nowrap px-3 py-1 rounded-full border cursor-pointer transition-all ${selectedCategory === item
                                ? 'bg-ud-primary text-white border-ud-primary'
                                : 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 dark:text-gray-300 hover:bg-ud-primary dark:hover:bg-ud-primary hover:text-white dark:hover:text-white hover:border-ud-primary dark:hover:border-ud-primary'
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
