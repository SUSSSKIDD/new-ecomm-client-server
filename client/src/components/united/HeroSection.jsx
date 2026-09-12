import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import ImageCarousel from './ImageCarousel';

const HeroSection = () => {
    const [banners, setBanners] = useState([]);

    useEffect(() => {
        let cancelled = false;
        api().get('/banners').then(res => {
            if (!cancelled && Array.isArray(res.data)) setBanners(res.data);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, []);

    if (banners.length === 0) return null;

    const images = banners.map(b => b.imageUrl);
    const links = banners.map(b => b.linkUrl || null);

    return (
        <div className="bg-ud-primary dark:bg-slate-900 overflow-hidden relative transition-colors duration-300">
            <ImageCarousel
                images={images}
                links={links}
                altText="Homepage banner"
                className="h-40 md:h-[400px]"
            />
        </div>
    );
};

export default HeroSection;
