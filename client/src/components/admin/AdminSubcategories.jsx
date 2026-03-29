/* eslint-disable react/prop-types */
import { RippleButton } from '../ui/ripple-button';
import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { adminApi } from '../../lib/api';
import { STORE_CATEGORY_SUBCATEGORIES, STORE_CATEGORY_LABELS, STORE_CATEGORIES } from '../../constants';

const UPLOAD_TYPE_OPTIONS = [
    { value: 'NONE', label: 'None', color: 'bg-gray-100 text-gray-600' },
    { value: 'PHOTO_UPLOAD', label: 'Photo Upload', color: 'bg-blue-100 text-blue-700' },
    { value: 'DESIGN_UPLOAD', label: 'Design Upload', color: 'bg-purple-100 text-purple-700' },
];

const AdminSubcategories = () => {
    const { admin } = useAdminAuth();
    const isAdmin = admin?.role === 'ADMIN';
    const storeType = admin?.storeType || 'GROCERY';

    const [customSubs, setCustomSubs] = useState([]);
    const [categoryConfigs, setCategoryConfigs] = useState({});
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [selectedStoreType, setSelectedStoreType] = useState(isAdmin ? 'GROCERY' : storeType);
    const [savingConfig, setSavingConfig] = useState(null);

    const staticSubs = STORE_CATEGORY_SUBCATEGORIES[selectedStoreType] || [];

    const fetchCustomSubs = useCallback(async () => {
        try {
            const res = await adminApi().get('/stores/subcategories/custom');
            setCustomSubs(res.data);
        } catch (err) {
            console.error(err);
        }
    }, []);

    const fetchCategoryConfigs = useCallback(async (type) => {
        try {
            const res = await adminApi().get(`/stores/category-config?storeType=${type}`);
            const configMap = {};
            if (Array.isArray(res.data)) {
                res.data.forEach(c => { configMap[c.subcategory] = c; });
            } else if (res.data && typeof res.data === 'object') {
                // If response is already a map of subcategory -> uploadType
                Object.entries(res.data).forEach(([sub, uploadType]) => {
                    configMap[sub] = { subcategory: sub, uploadType };
                });
            }
            setCategoryConfigs(configMap);
        } catch (err) {
            console.error('Failed to fetch category configs:', err);
        }
    }, []);

    useEffect(() => {
        Promise.all([fetchCustomSubs(), fetchCategoryConfigs(selectedStoreType)])
            .finally(() => setLoading(false));
    }, [fetchCustomSubs, fetchCategoryConfigs, selectedStoreType]);

    const getCustomListForType = (type) => {
        if (isAdmin) {
            return customSubs.filter(s => s.storeType === type);
        }
        return customSubs;
    };

    const customList = getCustomListForType(selectedStoreType);
    const allSubcategories = [...staticSubs, ...customList.map(c => c.name)];

    const handleCreate = async (e) => {
        e.preventDefault();
        const trimmed = newName.trim();
        if (!trimmed) return;
        if (!isAdmin) return;

        setCreating(true);
        setError('');
        try {
            await adminApi().post('/stores/subcategories/custom/admin', {
                storeType: selectedStoreType,
                name: trimmed,
            });
            setNewName('');
            fetchCustomSubs();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create subcategory');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!isAdmin) return;
        if (!window.confirm(`CAUTION: Deleting subcategory "${name}" will PERMANENTLY delete all products belonging to it. This action cannot be undone. \n\nAre you sure?`)) return;
        try {
            await adminApi().delete(`/stores/subcategories/custom/${id}`);
            fetchCustomSubs();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete');
        }
    };

    const handleUploadTypeChange = async (subcategory, uploadType) => {
        if (!isAdmin) return;
        setSavingConfig(subcategory);
        try {
            await adminApi().put('/stores/category-config', {
                storeType: selectedStoreType,
                subcategory,
                uploadType,
            });
            setCategoryConfigs(prev => ({
                ...prev,
                [subcategory]: { ...(prev[subcategory] || {}), subcategory, uploadType },
            }));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save upload config');
        } finally {
            setSavingConfig(null);
        }
    };

    const getUploadType = (subcategory) => {
        return categoryConfigs[subcategory]?.uploadType || 'NONE';
    };

    const storeTypeLabel = STORE_CATEGORY_LABELS[selectedStoreType] || selectedStoreType;
    const showUploadConfig = selectedStoreType === 'DROP_IN_FACTORY';

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Subcategories</h1>
                {isAdmin && (
                    <select
                        value={selectedStoreType}
                        onChange={e => setSelectedStoreType(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-ud-primary cursor-pointer"
                    >
                        {STORE_CATEGORIES.map(st => (
                            <option key={st} value={st}>{STORE_CATEGORY_LABELS[st] || st}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Add new subcategory — SuperAdmin Only */}
            {isAdmin && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <h2 className="text-sm font-bold text-gray-700 uppercase mb-3">
                        Add New Subcategory to {storeTypeLabel}
                    </h2>
                    <form onSubmit={handleCreate} className="flex gap-3 items-start">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={newName}
                                onChange={e => { setNewName(e.target.value); if (error) setError(''); }}
                                placeholder="Enter subcategory name..."
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900"
                                maxLength={100}
                            />
                            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                        </div>
                        <RippleButton
                            type="submit"
                            disabled={creating || !newName.trim()}
                            className="bg-ud-primary text-white px-4 py-2 rounded text-sm hover:bg-ud-primary/90 disabled:opacity-50 transition-colors font-medium whitespace-nowrap"
                        >
                            {creating ? 'Adding...' : 'Add Subcategory'}
                        </RippleButton>
                    </form>
                </div>
            )}

            {loading ? (
                <div className="text-center p-10 animate-pulse text-gray-500">Loading subcategories...</div>
            ) : (
                <div className="grid gap-6">
                    {/* Upload Type Configuration — only for DROP_IN_FACTORY */}
                    {showUploadConfig && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100">
                                <h2 className="text-sm font-bold text-indigo-700 uppercase">
                                    Upload Configuration — {storeTypeLabel}
                                </h2>
                                <p className="text-xs text-indigo-500 mt-0.5">
                                    Set which subcategories require photo or design uploads from customers
                                </p>
                            </div>
                            <div className="p-6">
                                <div className="space-y-3">
                                    {allSubcategories.map(name => {
                                        const currentType = getUploadType(name);
                                        const isSaving = savingConfig === name;
                                        return (
                                            <div key={name} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                                                <span className="text-sm font-medium text-gray-800">{name}</span>
                                                <div className="flex items-center gap-2">
                                                     {isSaving && (
                                                         <span className="text-xs text-gray-400 animate-pulse">Saving...</span>
                                                     )}
                                                     <select
                                                         value={currentType}
                                                         onChange={e => handleUploadTypeChange(name, e.target.value)}
                                                         disabled={isSaving || !isAdmin}
                                                         className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${
                                                             currentType === 'PHOTO_UPLOAD' ? 'border-blue-300 bg-blue-50 text-blue-700' :
                                                             currentType === 'DESIGN_UPLOAD' ? 'border-purple-300 bg-purple-50 text-purple-700' :
                                                             'border-gray-200 bg-gray-50 text-gray-500'
                                                         } ${(isSaving || !isAdmin) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                     >
                                                         {UPLOAD_TYPE_OPTIONS.map(opt => (
                                                             <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                         ))}
                                                     </select>
                                                 </div>
                                             </div>
                                         );
                                     })}
                                     {allSubcategories.length === 0 && (
                                         <p className="text-sm text-gray-400">No subcategories to configure.</p>
                                     )}
                                 </div>
                             </div>
                         </div>
                     )}

                     {/* Default subcategories */}
                     <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                         <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                             <h2 className="text-sm font-bold text-gray-600 uppercase">
                                 Default Subcategories — {storeTypeLabel}
                             </h2>
                             <p className="text-xs text-gray-400 mt-0.5">These are built-in and cannot be removed</p>
                         </div>
                         <div className="p-6">
                             <div className="flex flex-wrap gap-2">
                                 {staticSubs.map(name => {
                                     const uploadType = getUploadType(name);
                                     return (
                                         <span key={name} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium inline-flex items-center gap-1.5">
                                             {name}
                                             {uploadType !== 'NONE' && (
                                                 <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                                     uploadType === 'PHOTO_UPLOAD' ? 'bg-blue-200 text-blue-700' : 'bg-purple-200 text-purple-700'
                                                 }`}>
                                                     {uploadType === 'PHOTO_UPLOAD' ? 'Photo' : 'Design'}
                                                 </span>
                                             )}
                                         </span>
                                     );
                                 })}
                                 {staticSubs.length === 0 && (
                                     <p className="text-sm text-gray-400">No default subcategories for this store type.</p>
                                 )}
                             </div>
                         </div>
                     </div>

                     {/* Custom subcategories */}
                     <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                         <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100">
                             <h2 className="text-sm font-bold text-emerald-700 uppercase">
                                 Custom Subcategories — {storeTypeLabel}
                             </h2>
                             <p className="text-xs text-emerald-500 mt-0.5">Added by superadmins. These appear in product creation and customer browsing.</p>
                         </div>
                         <div className="p-6">
                             {customList.length === 0 ? (
                                 <p className="text-sm text-gray-400">No custom subcategories yet. Add one above.</p>
                             ) : (
                                 <div className="flex flex-wrap gap-2">
                                     {customList.map(sub => {
                                         const uploadType = getUploadType(sub.name);
                                         return (
                                             <span key={sub.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium group">
                                                 {sub.name}
                                                 {uploadType !== 'NONE' && (
                                                     <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                                         uploadType === 'PHOTO_UPLOAD' ? 'bg-blue-200 text-blue-700' : 'bg-purple-200 text-purple-700'
                                                     }`}>
                                                         {uploadType === 'PHOTO_UPLOAD' ? 'Photo' : 'Design'}
                                                     </span>
                                                 )}
                                                 {isAdmin && (
                                                     <button
                                                         onClick={() => handleDelete(sub.id, sub.name)}
                                                         className="w-4 h-4 flex items-center justify-center rounded-full text-emerald-500 hover:bg-red-100 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                                         title="Delete"
                                                     >
                                                         &times;
                                                     </button>
                                                 )}
                                             </span>
                                         );
                                     })}
                                 </div>
                             )}
                         </div>
                     </div>
                </div>
            )}
        </div>
    );
};

export default AdminSubcategories;
