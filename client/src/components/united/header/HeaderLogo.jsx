import PropTypes from 'prop-types';
import { Typewriter } from '../../ui/typewriter-text';

const HeaderLogo = ({ onReset }) => {
    return (
        <div className="flex flex-col items-center justify-center cursor-pointer" onClick={onReset}>
            <img 
                src="/logo.png" 
                alt="NEYOKART Logo" 
                className="h-8 w-auto object-contain"
            />
            <Typewriter
                text={[
                    "Groceries",
                    "Food",
                    "Fashion",
                    "Home Service",
                    "Print Factory"
                ]}
                speed={70}
                deleteSpeed={40}
                delay={2000}
                loop={true}
                className="text-[10px] font-black text-ud-primary tracking-tight leading-none mt-1"
            />
        </div>
    );
};

HeaderLogo.propTypes = {
    onReset: PropTypes.func.isRequired,
};

export default HeaderLogo;
