import { useEffect, useState } from "react";
import PropTypes from 'prop-types';

/**
 * @typedef {Object} TypewriterProps
 * @property {string | string[]} text - The text to display.
 * @property {number} [speed=100] - Typing speed in ms.
 * @property {string} [cursor="|"] - Custom cursor character.
 * @property {boolean} [loop=false] - Whether to loop the animation continuously.
 * @property {number} [deleteSpeed=50] - Deletion speed in ms.
 * @property {number} [delay=1500] - Pause delay before deletion starts.
 * @property {string} [className] - Additional CSS classes.
 */

/**
 * Typewriter Component
 * @param {TypewriterProps} props
 * @returns {JSX.Element}
 */
export function Typewriter({
    text,
    speed = 100,
    cursor = "|",
    loop = false,
    deleteSpeed = 50,
    delay = 1500,
    className,
}) {
    const [displayText, setDisplayText] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    const [textArrayIndex, setTextArrayIndex] = useState(0);

    // Validate and process input text
    const textArray = Array.isArray(text) ? text : [text];
    const currentText = textArray[textArrayIndex] || "";

    useEffect(() => {
        if (!currentText) return;

        const timeout = setTimeout(
            () => {
                if (!isDeleting) {
                    if (currentIndex < currentText.length) {
                        setDisplayText((prev) => prev + currentText[currentIndex]);
                        setCurrentIndex((prev) => prev + 1);
                    } else if (loop) {
                        setTimeout(() => setIsDeleting(true), delay);
                    }
                } else {
                    if (displayText.length > 0) {
                        setDisplayText((prev) => prev.slice(0, -1));
                    } else {
                        setIsDeleting(false);
                        setCurrentIndex(0);
                        setTextArrayIndex((prev) => (prev + 1) % textArray.length);
                    }
                }
            },
            isDeleting ? deleteSpeed : speed,
        );

        return () => clearTimeout(timeout);
    }, [
        currentIndex,
        isDeleting,
        currentText,
        loop,
        speed,
        deleteSpeed,
        delay,
        displayText,
        text,
    ]);

    return (
        <span className={className}>
            {displayText}
            <span className="animate-pulse font-bold">{cursor}</span>
        </span>
    );
}

Typewriter.propTypes = {
    text: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]).isRequired,
    speed: PropTypes.number,
    cursor: PropTypes.string,
    loop: PropTypes.bool,
    deleteSpeed: PropTypes.number,
    delay: PropTypes.number,
    className: PropTypes.string,
};
