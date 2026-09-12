import { useState, useEffect, useRef } from 'react';
import { adminApi } from '../../lib/api';
import { RippleButton } from '../ui/ripple-button';

const AdminHomepageBanners = () => {
    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [linkDrafts, setLinkDrafts] = useState({});
    const [pendingFiles, setPendingFiles] = useState({});
    const [saving, setSaving] = useState(null);
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

    const handleFileChange = (slot, e) => {
        const file = e.target.files?.[0];
        setPendingFiles(f => ({ ...f, [slot]: file || null }));
    };

    const handleSave = async (slot) => {
        setSaving(slot);
        try {
            const fd = new FormData();
            const file = pendingFiles[slot];
            if (file) fd.append('image', file);
            fd.append('linkUrl', linkDrafts[slot] || '');
            await adminApi().post(`/banners/${slot}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setPendingFiles(f => ({ ...f, [slot]: null }));
            if (fileInputRefs.current[slot]) fileInputRefs.current[slot].value = '';
            await fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save banner');
        } finally {
            setSaving(null);
        }
    };

    const handleRemove = async (slot) => {
        if (!window.confirm(`Remove banner in slot ${slot}?`)) return;
        try {
            await adminApi().delete(`/banners/${slot}`);
            await fetchData();
        } catch (err) {
            alert('Failed to remove banner');
        }
    };

    if (loading) {
        return <div className="p-10 text-center animate-pulse text-gray-400">Loading banners...</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Homepage Banners</h1>
                <p className="text-sm text-gray-500 mt-1">Configure the 3 banners shown in the homepage carousel. Each can optionally link to a URL when tapped.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {slots.map(banner => {
                    const previewUrl = pendingFiles[banner.slot]
                        ? URL.createObjectURL(pendingFiles[banner.slot])
                        : banner.imageUrl;
                    const isSaving = saving === banner.slot;

                    return (
                        <div key={banner.slot} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                <h2 className="text-sm font-bold text-gray-600 uppercase">Slot {banner.slot}</h2>
                                {banner.imageUrl && (
                                    <button onClick={() => handleRemove(banner.slot)} className="text-red-500 text-xs hover:underline">Remove</button>
                                )}
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="w-full h-32 rounded bg-gray-100 flex items-center justify-center overflow-hidden relative">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt={`Banner ${banner.slot}`} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xs text-gray-400">No image set</span>
                                    )}
                                    {isSaving && (
                                        <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                                            <div className="w-6 h-6 border-2 border-ud-primary border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    ref={el => fileInputRefs.current[banner.slot] = el}
                                    onChange={e => handleFileChange(banner.slot, e)}
                                    className="text-xs w-full"
                                />
                                <input
                                    type="text"
                                    placeholder="Link URL (optional)"
                                    value={linkDrafts[banner.slot] ?? ''}
                                    onChange={e => setLinkDrafts(d => ({ ...d, [banner.slot]: e.target.value }))}
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-900"
                                />
                                <RippleButton
                                    onClick={() => handleSave(banner.slot)}
                                    disabled={isSaving || (!banner.imageUrl && !pendingFiles[banner.slot])}
                                    className="w-full bg-ud-primary text-white py-1.5 text-sm rounded disabled:opacity-50"
                                >
                                    {isSaving ? 'Saving...' : 'Save'}
                                </RippleButton>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AdminHomepageBanners;
