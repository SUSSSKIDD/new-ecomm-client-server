import { useState, useEffect, useRef } from 'react';
import { adminApi, API_URL } from '../../lib/api';
import { STORE_CATEGORIES, STORE_CATEGORY_LABELS } from '../../constants';
import { RippleButton } from '../ui/ripple-button';

const AdminSubcategoryPhoto = () => {
    const [subcategories, setSubcategories] = useState({});
    const [bannerImages, setBannerImages] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedStoreType, setSelectedStoreType] = useState('GROCERY');
    const [uploading, setUploading] = useState(null);
    const fileInputRefs = useRef({});

    const fetchData = async () => {
        try {
            const res = await fetch(`${API_URL}/stores/categories`).then(r => r.json());
            if (res.subcategories) setSubcategories(res.subcategories);
            // support both old (photoUrls) and new (bannerImages) key names
            if (res.bannerImages) setBannerImages(res.bannerImages);
            else if (res.photoUrls) setBannerImages(res.photoUrls);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleFileUpload = async (e, storeType, subcategory) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(`${storeType}-${subcategory}`);
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('storeType', storeType);
        formData.append('subcategory', subcategory);

        try {
            await adminApi().post('/stores/subcategories/photo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            await fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to upload banner');
        } finally {
            setUploading(null);
            if (fileInputRefs.current[`${storeType}-${subcategory}`]) {
                fileInputRefs.current[`${storeType}-${subcategory}`].value = '';
            }
        }
    };

    const handleDeleteBanner = async (storeType, subcategory) => {
        if (!window.confirm(`Delete banner for "${subcategory}"?`)) return;
        try {
            await adminApi().delete('/stores/subcategories/photo', {
                data: { storeType, subcategory }
            });
            await fetchData();
        } catch (err) {
            alert('Failed to delete banner');
        }
    };

    const triggerFileInput = (storeType, subcategory) => {
        const key = `${storeType}-${subcategory}`;
        fileInputRefs.current[key]?.click();
    };

    const isVideoUrl = (url) => {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        return ['.mp4', '.webm', '.ogg', '.mov'].some(ext => lowerUrl.includes(ext));
    };

    const currentSubs = subcategories[selectedStoreType] || [];

    // Hero banner entry (special key for the HeroSection)
    const HERO_KEY = '__hero__';
    const heroBannerUrl = bannerImages[selectedStoreType]?.[HERO_KEY];
    const heroInputKey = `${selectedStoreType}-${HERO_KEY}`;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Subcategory Banners</h1>
                <select
                    value={selectedStoreType}
                    onChange={e => setSelectedStoreType(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-ud-primary bg-white"
                >
                    {STORE_CATEGORIES.map(st => (
                        <option key={st} value={st}>{STORE_CATEGORY_LABELS[st] || st}</option>
                    ))}
                </select>
            </div>

            {/* Hero Banner Card */}
            {selectedStoreType === 'GROCERY' && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-indigo-200 p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Hero Section</span>
                        <h2 className="text-sm font-bold text-gray-700">Homepage Hero Banner</h2>
                    </div>
                    <div className="flex gap-4 items-start">
                        <div className="w-40 h-28 rounded-xl bg-white border border-indigo-200 flex items-center justify-center overflow-hidden relative flex-shrink-0">
                            {heroBannerUrl ? (
                                isVideoUrl(heroBannerUrl) ? (
                                    <video src={heroBannerUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                                ) : (
                                    <img src={heroBannerUrl} alt="Hero Banner" className="w-full h-full object-cover" />
                                )
                            ) : (
                                <span className="text-xs text-gray-400 text-center px-2">No banner set</span>
                            )}
                            {uploading === heroInputKey && (
                                <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                                    <div className="w-6 h-6 border-2 border-ud-primary border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-gray-500 mb-3">Upload an image or video that appears in the homepage hero section. Supports JPG, PNG, WebP, MP4, WebM.</p>
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    accept="image/*,video/mp4,video/webm,video/ogg"
                                    ref={el => fileInputRefs.current[heroInputKey] = el}
                                    className="hidden"
                                    onChange={e => handleFileUpload(e, selectedStoreType, HERO_KEY)}
                                />
                                <RippleButton
                                    onClick={() => triggerFileInput(selectedStoreType, HERO_KEY)}
                                    disabled={uploading === heroInputKey}
                                    className="py-1.5 px-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded text-sm font-medium transition-colors"
                                >
                                    {heroBannerUrl ? 'Change Banner' : 'Upload Banner'}
                                </RippleButton>
                                {heroBannerUrl && (
                                    <RippleButton
                                        onClick={() => handleDeleteBanner(selectedStoreType, HERO_KEY)}
                                        disabled={uploading === heroInputKey}
                                        className="py-1.5 px-3 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm font-medium transition-colors"
                                    >
                                        Remove
                                    </RippleButton>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <h2 className="text-sm font-bold text-gray-600 uppercase">
                        {STORE_CATEGORY_LABELS[selectedStoreType] || selectedStoreType} Subcategories
                    </h2>
                </div>

                {loading ? (
                    <div className="p-10 text-center animate-pulse text-gray-400">Loading subcategories...</div>
                ) : currentSubs.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">No subcategories found for this store type. Add them from the Categories tab.</div>
                ) : (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {currentSubs.map(sub => {
                            const bannerUrl = bannerImages[selectedStoreType]?.[sub];
                            const isUploading = uploading === `${selectedStoreType}-${sub}`;
                            const inputKey = `${selectedStoreType}-${sub}`;

                            return (
                                <div key={sub} className="bg-white border rounded-xl p-4 flex flex-col items-center gap-4 hover:shadow-md transition-shadow">
                                    <h3 className="text-md font-bold text-gray-800 text-center">{sub}</h3>

                                    <div className="w-32 h-32 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden relative group">
                                        {bannerUrl ? (
                                            isVideoUrl(bannerUrl) ? (
                                                <video src={bannerUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                                            ) : (
                                                <img src={bannerUrl} alt={sub} className="w-full h-full object-cover" />
                                            )
                                        ) : (
                                            <span className="text-4xl text-gray-300 font-bold uppercase">{sub.charAt(0)}</span>
                                        )}
                                        {isUploading && (
                                            <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm transition-all duration-300 animate-in fade-in">
                                                <div className="w-6 h-6 border-2 border-ud-primary border-t-transparent rounded-full animate-spin"></div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 w-full mt-2">
                                        <input
                                            type="file"
                                            accept="image/*,video/mp4,video/webm,video/ogg"
                                            ref={el => fileInputRefs.current[inputKey] = el}
                                            className="hidden"
                                            onChange={e => handleFileUpload(e, selectedStoreType, sub)}
                                        />
                                        <RippleButton
                                            onClick={() => triggerFileInput(selectedStoreType, sub)}
                                            disabled={isUploading}
                                            className="flex-1 py-1.5 px-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-sm font-medium transition-colors"
                                        >
                                            {bannerUrl ? 'Modify Banner' : 'Upload Banner'}
                                        </RippleButton>

                                        {bannerUrl && (
                                            <RippleButton
                                                onClick={() => handleDeleteBanner(selectedStoreType, sub)}
                                                disabled={isUploading}
                                                className="py-1.5 px-3 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm font-medium transition-colors"
                                                title="Delete Banner"
                                            >
                                                &times;
                                            </RippleButton>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminSubcategoryPhoto;
