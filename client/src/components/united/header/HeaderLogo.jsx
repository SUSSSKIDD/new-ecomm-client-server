import PropTypes from 'prop-types';
import { Typewriter } from '../../ui/typewriter-text';

const HeaderLogo = ({ onReset }) => {
    return (
        <div className="flex items-center gap-2 cursor-pointer" onClick={onReset}>
            <Typewriter
                text={["NEYOKART", "Groceries", "Essentials"]}
                speed={100}
                loop={true}
                delay={3000}
                className="text-2xl font-bold text-gray-900 tracking-tight"
                cursor="."
            />
        </div>
    );
};

HeaderLogo.propTypes = {
    onReset: PropTypes.func.isRequired,
};

export default HeaderLogo;
