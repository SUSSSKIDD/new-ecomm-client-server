import { useState, useEffect } from 'react';
import { RippleButton } from '../../components/ui/ripple-button';
import { API_URL } from '../../lib/api';

const FALLBACK_IMAGE = 'https://png.pngtree.com/png-clipart/20230914/ourmid/pngtree-basket-of-vegetables-png-image_10116238.png';

// The subcategory key whose bannerImage is used for the hero section.
const HERO_STORE_TYPE = 'GROCERY';
const HERO_SUBCATEGORY = '__hero__';

const HeroSection = () => {
    const [bannerSrc, setBannerSrc] = useState(FALLBACK_IMAGE);
    const [isVideo, setIsVideo] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetch(`${API_URL}/stores/categories`)
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                const url = data?.bannerImages?.[HERO_STORE_TYPE]?.[HERO_SUBCATEGORY];
                if (url) {
                    const lowerUrl = url.toLowerCase();
                    const videoExts = ['.mp4', '.webm', '.ogg', '.mov'];
                    setIsVideo(videoExts.some(ext => lowerUrl.includes(ext)));
                    setBannerSrc(url);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="bg-ud-primary dark:bg-slate-900 text-white overflow-hidden relative transition-colors duration-300">
            <div className="container mx-auto px-4 py-4 md:py-0 md:h-[400px] flex flex-row items-center justify-between relative z-10">

                {/* Left Arrow (Desktop Only) */}
                <RippleButton className="hidden md:flex absolute left-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 items-center justify-center backdrop-blur-sm transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </RippleButton>

                {/* Content */}
                <div className="w-3/5 md:w-1/2 space-y-2 md:space-y-6 md:pl-12 z-10 text-left">
                    <div className="inline-block px-2 py-0.5 bg-yellow-400 text-black text-[10px] font-bold rounded-sm uppercase tracking-wider">
                        Fresh from Farm
                    </div>
                    <h2 className="text-xl md:text-5xl font-extrabold tracking-tight leading-tight">
                        ORGANIC<br />VEGETABLES<br /><span className="text-white/80 text-sm md:text-3xl">UP TO 50% OFF</span>
                    </h2>
                    {/* Dots Pagination */}
                    <div className="flex gap-1 pt-1 md:pt-4 justify-start">
                        <div className="w-4 h-1 md:w-8 md:h-1.5 bg-white rounded-full"></div>
                        <div className="w-1 h-1 md:w-2 md:h-1.5 bg-white/40 rounded-full"></div>
                        <div className="w-1 h-1 md:w-2 md:h-1.5 bg-white/40 rounded-full"></div>
                    </div>
                </div>

                {/* Circle Graphics */}
                <div className="absolute top-0 right-0 h-full w-1/2 overflow-hidden pointer-events-none hidden md:block">
                    <div className="absolute -top-20 -right-20 w-[600px] h-[600px] bg-yellow-400 dark:bg-emerald-900/20 rounded-full opacity-90 transition-colors duration-300"></div>
                    <div className="absolute top-10 right-10 w-[400px] h-[400px] bg-white/10 dark:bg-white/5 rounded-full"></div>
                </div>

                {/* Hero Banner (Image or Video) */}
                <div className="w-2/5 md:w-auto md:absolute md:right-20 md:top-1/2 md:-translate-y-1/2 z-20 flex justify-end">
                    <div className="relative w-[120px] h-[100px] md:w-[450px] md:h-[300px]">
                        {isVideo ? (
                            <video
                                src={bannerSrc}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full h-full object-contain filter drop-shadow-2xl"
                            />
                        ) : (
                            <img
                                src={bannerSrc}
                                alt="Fresh Vegetables"
                                className="w-full h-full object-contain filter drop-shadow-2xl hover:scale-105 transition-all duration-500"
                            />
                        )}
                    </div>
                </div>

                {/* Right Arrow (Desktop Only) */}
                <RippleButton className="hidden md:flex absolute right-4 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 items-center justify-center backdrop-blur-sm transition-colors z-30">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </RippleButton>

            </div>
        </div>
    );
};

export default HeroSection;
