import { useState, useEffect } from 'react';
import { RippleButton } from '../../components/ui/ripple-button';
import { api } from '../../lib/api';

const FALLBACK_IMAGE = '/hero-fallback.svg';

const HeroSection = () => {
    const [banners, setBanners] = useState([]);
    const [current, setCurrent] = useState(0);
    const [imageLoaded, setImageLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api().get('/banners').then(res => {
            if (!cancelled && Array.isArray(res.data)) setBanners(res.data);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        setCurrent(0);
        setImageLoaded(false);
    }, [banners.length]);

    // Auto-advance every 3s; resets on any transition (auto or manual) so
    // there's always a consistent 3s gap after the user last interacted.
    useEffect(() => {
        if (banners.length <= 1) return;
        const timer = setInterval(() => {
            setImageLoaded(false);
            setCurrent(prev => (prev === banners.length - 1 ? 0 : prev + 1));
        }, 3000);
        return () => clearInterval(timer);
    }, [banners.length, current]);

    if (banners.length === 0) return null;

    const hasMultiple = banners.length > 1;
    const banner = banners[current];

    const goToPrev = () => {
        setImageLoaded(false);
        setCurrent(prev => (prev === 0 ? banners.length - 1 : prev - 1));
    };

    const goToNext = () => {
        setImageLoaded(false);
        setCurrent(prev => (prev === banners.length - 1 ? 0 : prev + 1));
    };

    const headingLines = (banner.heading || '').split('\n').filter(Boolean);

    const image = (
        <img
            src={banner.imageUrl || FALLBACK_IMAGE}
            alt={banner.badgeText || 'Homepage banner'}
            className={`w-full h-full object-contain filter drop-shadow-2xl transition-all duration-500 ${imageLoaded ? 'hover:scale-105' : ''}`}
            loading="eager"
            fetchPriority="high"
            onLoad={() => setImageLoaded(true)}
            width={450}
            height={300}
        />
    );

    return (
        <div className="bg-ud-primary dark:bg-slate-900 text-white overflow-hidden relative transition-colors duration-300">
            <div className="container mx-auto px-4 py-4 md:py-0 md:h-[400px] flex flex-row items-center justify-between relative z-10">

                {/* Left Arrow (mobile + desktop) */}
                {hasMultiple && (
                    <RippleButton
                        onClick={goToPrev}
                        aria-label="Previous banner"
                        className="flex absolute left-2 md:left-4 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 hover:bg-white/30 items-center justify-center backdrop-blur-sm transition-colors z-30"
                    >
                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </RippleButton>
                )}

                {/* Content */}
                <div className="w-3/5 md:w-1/2 min-w-0 space-y-2 md:space-y-6 md:pl-12 z-10 text-left">
                    {banner.badgeText && (
                        <div className="inline-block px-2 py-0.5 bg-yellow-400 text-black text-[10px] font-bold rounded-sm uppercase tracking-wider">
                            {banner.badgeText}
                        </div>
                    )}
                    {(headingLines.length > 0 || banner.subheading) && (
                        <h2 className="text-xl md:text-5xl font-extrabold tracking-tight leading-tight break-words">
                            {headingLines.map((line, i) => (
                                <span key={i}>{line}<br /></span>
                            ))}
                            {banner.subheading && (
                                <span className="text-white/80 text-sm md:text-3xl">{banner.subheading}</span>
                            )}
                        </h2>
                    )}
                    {/* Dots Pagination */}
                    {hasMultiple && (
                        <div className="flex gap-1 pt-1 md:pt-4 justify-start">
                            {banners.map((_, idx) => (
                                <RippleButton
                                    key={idx}
                                    onClick={() => { setImageLoaded(false); setCurrent(idx); }}
                                    aria-label={`Go to banner ${idx + 1}`}
                                    className={`rounded-full transition-colors ${
                                        current === idx
                                            ? 'w-4 h-1 md:w-8 md:h-1.5 bg-white'
                                            : 'w-1 h-1 md:w-2 md:h-1.5 bg-white/40'
                                    }`}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Circle Graphics */}
                <div className="absolute top-0 right-0 h-full w-1/2 overflow-hidden pointer-events-none hidden md:block">
                    <div className="absolute -top-20 -right-20 w-[600px] h-[600px] bg-yellow-400 dark:bg-emerald-900/20 rounded-full opacity-90 transition-colors duration-300"></div>
                    <div className="absolute top-10 right-10 w-[400px] h-[400px] bg-white/10 dark:bg-white/5 rounded-full"></div>
                </div>

                {/* Hero Banner Image */}
                <div className="w-2/5 md:w-auto md:absolute md:right-20 md:top-1/2 md:-translate-y-1/2 z-20 flex justify-end">
                    <div className="relative w-[120px] h-[100px] md:w-[450px] md:h-[300px]">
                        {banner.linkUrl ? (
                            <a href={banner.linkUrl} className="block w-full h-full">{image}</a>
                        ) : image}
                    </div>
                </div>

                {/* Right Arrow (mobile + desktop) */}
                {hasMultiple && (
                    <RippleButton
                        onClick={goToNext}
                        aria-label="Next banner"
                        className="flex absolute right-2 md:right-4 w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 hover:bg-white/30 items-center justify-center backdrop-blur-sm transition-colors z-30"
                    >
                        <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </RippleButton>
                )}

            </div>
        </div>
    );
};

export default HeroSection;
