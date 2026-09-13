import { useState, useEffect, useRef } from 'react';
import { adminApi } from '../../lib/api';
import { RippleButton } from '../ui/ripple-button';

const AdminHomepageBanners = () => {
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [linkDrafts, setLinkDrafts] = useState({});
    const [uploading, setUploading] = useState(null);
    const [savingLink, setSavingLink] = useState(null);
    const fileInputRefs = useRef({});

    const fetchData = async () => {
        try {
            const res = await adminApi().get('/banners/admin');
            setSlots(res.data);
            setLinkDrafts(Object.fromEntries(res.data.map(b => [b.slot, b.linkUrl || ''])));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleFileUpload = async (slot, e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(slot);
        const fd = new FormData();
        fd.append('image', file);
        try {
            await adminApi().post(`/banners/${slot}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            await fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to upload banner');
        } finally {
            setUploading(null);
            if (fileInputRefs.current[slot]) fileInputRefs.current[slot].value = '';
        }
    };

    const handleRemove = async (slot) => {
        if (!window.confirm(`Remove banner ${slot}?`)) return;
        try {
            await adminApi().delete(`/banners/${slot}`);
            await fetchData();
        } catch (err) {
            alert('Failed to remove banner');
        }
    };

    const handleSaveLink = async (slot) => {
        setSavingLink(slot);
        try {
            const fd = new FormData();
            fd.append('linkUrl', linkDrafts[slot] || '');
            await adminApi().post(`/banners/${slot}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            await fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save link');
        } finally {
            setSavingLink(null);
        }
    };

    const triggerFileInput = (slot) => fileInputRefs.current[slot]?.click();

    if (loading) {
        return <div className="p-10 text-center animate-pulse text-gray-400">Loading banners...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Homepage Banners</h1>
                <p className="text-sm text-gray-500 mt-1">Configure the 3 banners shown in the homepage carousel.</p>
            </div>

            <div className="space-y-4">
                {slots.map(banner => (
                    <div key={banner.slot} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-indigo-200 p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Banner {banner.slot}</span>
                            <h2 className="text-sm font-bold text-gray-700">Homepage Carousel Slide {banner.slot}</h2>
                        </div>
                        <div className="flex gap-4 items-start">
                            <div className="w-40 h-28 rounded-xl bg-white border border-indigo-200 flex items-center justify-center overflow-hidden relative flex-shrink-0">
                                {banner.imageUrl ? (
                                    <img src={banner.imageUrl} alt={`Banner ${banner.slot}`} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-xs text-gray-400 text-center px-2">No banner set</span>
                                )}
                                {uploading === banner.slot && (
                                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                                        <div className="w-6 h-6 border-2 border-ud-primary border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-gray-500 mb-3">Upload an image that appears as one of the 3 homepage carousel slides. Supports JPG, PNG, WebP.</p>
                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        ref={el => fileInputRefs.current[banner.slot] = el}
                                        className="hidden"
                                        onChange={e => handleFileUpload(banner.slot, e)}
                                    />
                                    <RippleButton
                                        onClick={() => triggerFileInput(banner.slot)}
                                        disabled={uploading === banner.slot}
                                        className="py-1.5 px-4 bg-indigo-600 text-white hover:bg-indigo-700 rounded text-sm font-medium transition-colors"
                                    >
                                        {banner.imageUrl ? 'Change Banner' : 'Upload Banner'}
                                    </RippleButton>
                                    {banner.imageUrl && (
                                        <RippleButton
                                            onClick={() => handleRemove(banner.slot)}
                                            disabled={uploading === banner.slot}
                                            className="py-1.5 px-3 bg-red-50 text-red-600 hover:bg-red-100 rounded text-sm font-medium transition-colors"
                                        >
                                            Remove
                                        </RippleButton>
                                    )}
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        placeholder="Link URL (optional)"
                                        value={linkDrafts[banner.slot] ?? ''}
                                        onChange={e => setLinkDrafts(d => ({ ...d, [banner.slot]: e.target.value }))}
                                        className="flex-1 border border-indigo-200 rounded px-2 py-1.5 text-sm text-gray-900 bg-white"
                                    />
                                    <button
                                        onClick={() => handleSaveLink(banner.slot)}
                                        disabled={savingLink === banner.slot}
                                        className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50 flex-shrink-0"
                                    >
                                        {savingLink === banner.slot ? 'Saving...' : 'Save Link'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminHomepageBanners;
