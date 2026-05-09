import { RippleButton } from '../../components/ui/ripple-button';
import { useState, useEffect } from 'react';

const ImageCarousel = ({ images = [], altText = '', className = '' }) => {
    const [current, setCurrent] = useState(0);

    // Reset index when images array changes (use length to avoid new-array-reference rerenders)
    useEffect(() => {
        setCurrent(0);
    }, [images.length]);

    const hasMultiple = images.length > 1;

    const goToPrev = (e) => {
        e?.stopPropagation();
        setCurrent((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const goToNext = (e) => {
        e?.stopPropagation();
        setCurrent((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };

    // No images fallback
    if (!images || images.length === 0) {
        return (
            <div className={`relative bg-gray-100 flex items-center justify-center ${className || 'h-80'}`}>
                <div className="text-center text-gray-400">
                    <svg className="w-16 h-16 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">No Image Available</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative bg-gray-50 flex items-center justify-center overflow-hidden ${className || 'h-80'}`}>
            {/* Carousel Track */}
            <div
                className="flex transition-transform duration-500 ease-in-out h-full"
                style={{
                    transform: `translateX(-${current * 100}%)`,
                    width: `${images.length * 100}%`,
                }}
            >
                {images.map((img, idx) => (
                    <div
                        key={idx}
                        className="w-full h-full flex items-center justify-center p-4"
                        style={{ width: `${100 / images.length}%` }}
                    >
                        <img
                            src={img}
                            alt={`${altText} - View ${idx + 1}`}
                            className="max-h-full max-w-full object-contain filter drop-shadow-xl"
                            loading={idx === 0 ? 'eager' : 'lazy'}
                        />
                    </div>
                ))}
            </div>

            {/* Prev / Next Arrows */}
            {hasMultiple && (
                <>
                    <RippleButton
                        onClick={goToPrev}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:text-gray-900 transition-all z-10"
                        aria-label="Previous image"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </RippleButton>
                    <RippleButton
                        onClick={goToNext}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-700 hover:bg-white hover:text-gray-900 transition-all z-10"
                        aria-label="Next image"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </RippleButton>
                </>
            )}

            {/* Dot Indicators */}
            {hasMultiple && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {images.map((_, idx) => (
                        <RippleButton
                            key={idx}
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrent(idx);
                            }}
                            className={`h-2 rounded-full transition-all duration-300 ${current === idx
                                    ? 'bg-ud-primary w-4'
                                    : 'bg-gray-300 w-2 hover:bg-gray-400'
                                }`}
                            aria-label={`Go to image ${idx + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ImageCarousel;
