/* eslint-disable react/prop-types */
import { RippleButton } from '../ui/ripple-button';
import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { adminApi, API_URL } from '../../lib/api';
import { STORE_CATEGORY_SUBCATEGORIES } from '../../constants';

// Shows thumbnails for an array of File objects selected via file input
const ImagePreview = ({ files, onRemove }) => {
    if (!files || files.length === 0) return null;
    return (
        <div className="flex gap-2 mt-2 flex-wrap">
            {files.map((file, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded overflow-hidden border border-gray-200 flex-shrink-0">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                    {onRemove && (
                        <button
                            type="button"
                            onClick={() => onRemove(idx)}
                            className="absolute top-0 right-0 bg-black/60 text-white text-xs w-4 h-4 flex items-center justify-center leading-none"
                        >×</button>
                    )}
                </div>
            ))}
        </div>
    );
};

const GstSelect = ({ value, onChange, placeholder = 'GST', className = '' }) => (
    <input type="number" min="0" max="100" step="1" value={value} onChange={onChange} placeholder={placeholder}
        className={`border border-gray-300 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-ud-primary ${className}`} />
);

const emptyForm = { name: '', description: '', price: '', mrp: '', storePrice: '', category: '', stock: '', storeLocation: '', taxRate: '0' };

const ProductModal = ({ product, onClose, onSaved, admin }) => {
    const defaultStoreLocation = admin?.storeCode || '';
    const [form, setForm] = useState(product ? {
        name: product.name || '',
        description: product.description || '',
        price: product.price || '',
        mrp: product.mrp || '',
        storePrice: product.storePrice || '',
        category: product.subCategory || product.category || '',
        stock: product.stock || '',
        storeLocation: product.storeLocation || defaultStoreLocation,
        taxRate: product.taxRate != null ? String(product.taxRate) : '0',
    } : { ...emptyForm, storeLocation: defaultStoreLocation });

    const resolvedStoreType = admin?.storeType || 'GROCERY';
    const [allowedCategories, setAllowedCategories] = useState(STORE_CATEGORY_SUBCATEGORIES[resolvedStoreType] || []);
    const [images, setImages] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [hasVariants, setHasVariants] = useState(false);
    const [variants, setVariants] = useState([{ label: '', price: '', mrp: '', storePrice: '', stock: '', taxRate: '', images: [] }]);

    const addVariant = () =>
        setVariants(v => [...v, { label: '', price: '', mrp: '', storePrice: '', stock: '', taxRate: '', images: [] }]);

    const removeVariant = (i) =>
        setVariants(v => v.filter((_, idx) => idx !== i));

    const updateVariant = (i, field, value) =>
        setVariants(v => v.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

    useEffect(() => {
        let cancelled = false;
        adminApi().get('/stores/categories').then(res => {
            if (!cancelled && res.data?.subcategories?.[resolvedStoreType]) {
                setAllowedCategories(res.data.subcategories[resolvedStoreType]);
            }
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [resolvedStoreType]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        const token = localStorage.getItem('ud_admin_token');
        const fd = new FormData();
        fd.append('name', form.name);
        fd.append('price', Number(form.price));
        fd.append('category', form.category);
        if (!product && hasVariants && variants.length > 0) {
            fd.append('stock', '0'); // variants hold the true stock
            const variantMeta = variants.map(({ label, price, mrp, storePrice, stock, taxRate }) => ({
                label,
                price: Number(price),
                mrp: mrp ? Number(mrp) : undefined,
                storePrice: storePrice ? Number(storePrice) : undefined,
                stock: Number(stock),
                taxRate: taxRate !== '' ? Number(taxRate) : undefined,
            }));
            fd.append('variantsJson', JSON.stringify(variantMeta));
            variants.forEach((v, i) => {
                (v.images || []).slice(0, 3).forEach(f => fd.append(`variantImage_${i}`, f));
            });
        } else {
            fd.append('stock', Number(form.stock));
        }
        fd.append('taxRate', Number(form.taxRate ?? 0));
        if (form.storeLocation) fd.append('storeLocation', form.storeLocation);
        if (form.description) fd.append('description', form.description);
        if (form.mrp) fd.append('mrp', Number(form.mrp));
        if (form.storePrice) fd.append('storePrice', Number(form.storePrice));
        if (images && images.length > 0) {
            images.slice(0, 3).forEach(file => fd.append('images', file));
        }

        try {
            const url = product ? `${API_URL}/products/${product.id}` : `${API_URL}/products`;
            const method = product ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { Authorization: `Bearer ${token}` },
                body: fd
            });
            if (res.ok) {
                onSaved();
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.message || 'Failed to save product');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800">{product ? 'Edit Product' : 'Add Product'}</h2>
                    <RippleButton onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</RippleButton>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="bg-red-50 text-red-700 p-3 rounded text-sm">{error}</div>}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900" />
                    </div>
                    {!(!product && hasVariants) && (
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                                <input type="number" required min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">MRP</label>
                                <input type="number" min="0" step="0.01" value={form.mrp} onChange={e => setForm(f => ({ ...f, mrp: e.target.value }))}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Store Price</label>
                                <input type="number" min="0" step="0.01" value={form.storePrice} onChange={e => setForm(f => ({ ...f, storePrice: e.target.value }))}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900"
                                    placeholder="Private" />
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                            <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900">
                                <option value="">Select Category</option>
                                {allowedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        {!(!product && hasVariants) && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                                <input type="number" required min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900" />
                            </div>
                        )}
                    </div>
                    {!product && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="hasVariants"
                                    checked={hasVariants}
                                    onChange={e => setHasVariants(e.target.checked)}
                                />
                                <label htmlFor="hasVariants" className="text-sm font-medium text-gray-700">
                                    This product has variants (e.g. sizes, weights)
                                </label>
                            </div>

                            {hasVariants && (
                                <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
                                    <p className="text-xs text-gray-500">
                                        When variants are enabled, product-level stock is ignored.
                                        Each variant tracks its own stock and image.
                                    </p>
                                    {variants.map((v, i) => (
                                        <div key={i} className="bg-white border border-gray-200 rounded p-3 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-semibold text-gray-600">Variant {i + 1}</span>
                                                {variants.length > 1 && (
                                                    <button type="button" onClick={() => removeVariant(i)}
                                                        className="text-red-500 text-xs hover:underline">Remove</button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input type="text" placeholder="Label (e.g. 500g, 1L)" value={v.label}
                                                    onChange={e => updateVariant(i, 'label', e.target.value)}
                                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" required />
                                                <input type="number" placeholder="Price *" min="0" step="0.01" value={v.price}
                                                    onChange={e => updateVariant(i, 'price', e.target.value)}
                                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" required />
                                                <input type="number" placeholder="MRP (opt)" min="0" step="0.01" value={v.mrp}
                                                    onChange={e => updateVariant(i, 'mrp', e.target.value)}
                                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                                                <input type="number" placeholder="Store Price (opt)" min="0" step="0.01" value={v.storePrice}
                                                    onChange={e => updateVariant(i, 'storePrice', e.target.value)}
                                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" />
                                                <input type="number" placeholder="Stock *" min="0" value={v.stock}
                                                    onChange={e => updateVariant(i, 'stock', e.target.value)}
                                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm" required />
                                                <GstSelect value={v.taxRate} onChange={e => updateVariant(i, 'taxRate', e.target.value)} placeholder="GST % (inherit)" className="w-full" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block mb-1">Images (max 3, optional)</label>
                                                <input type="file" multiple accept="image/*"
                                                    onChange={e => updateVariant(i, 'images', Array.from(e.target.files).slice(0, 3))}
                                                    className="text-xs w-full" />
                                                <ImagePreview
                                                    files={v.images}
                                                    onRemove={rmIdx => updateVariant(i, 'images', v.images.filter((_, fi) => fi !== rmIdx))}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addVariant}
                                        className="w-full border border-dashed border-gray-300 text-gray-500 text-sm py-2 rounded hover:border-ud-primary hover:text-ud-primary">
                                        + Add Another Variant
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">GST</label>
                        <GstSelect value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: e.target.value }))} placeholder="0" className="w-full py-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea rows="3" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Store Location (ID)</label>
                        <input type="text" readOnly disabled value={form.storeLocation}
                            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-gray-100 text-gray-500 cursor-not-allowed" />
                    </div>
                    {!(!product && hasVariants) && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Images (max 3)</label>
                            <input type="file" multiple accept="image/*" onChange={e => setImages(Array.from(e.target.files))}
                                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-ud-primary/10 file:text-ud-primary hover:file:bg-ud-primary/20 text-gray-900" />
                            <ImagePreview files={images} onRemove={idx => setImages(prev => prev.filter((_, i) => i !== idx))} />
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <RippleButton type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">Cancel</RippleButton>
                        <RippleButton type="submit" disabled={saving}
                            className="bg-ud-primary text-white px-4 py-2 rounded text-sm hover:bg-ud-primary/90 disabled:opacity-50 transition-colors">
                            {saving ? 'Saving...' : (product ? 'Update Product' : 'Create Product')}
                        </RippleButton>
                    </div>
                </form>
            </div>
        </div>
    );
};

const VariantsModal = ({ product, onClose, onRefresh }) => {
    const [variants, setVariants] = useState(product.variants || []);
    const [newVar, setNewVar] = useState({ label: '', price: '', mrp: '', storePrice: '', stock: '', taxRate: '', images: [] });
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ label: '', price: '', mrp: '', storePrice: '', stock: '', taxRate: '', images: [] });

    const handleAdd = async () => {
        try {
            const fd = new FormData();
            fd.append('label', newVar.label);
            fd.append('price', String(Number(newVar.price)));
            if (newVar.mrp) fd.append('mrp', String(Number(newVar.mrp)));
            if (newVar.storePrice) fd.append('storePrice', String(Number(newVar.storePrice)));
            fd.append('stock', String(Number(newVar.stock)));
            if (newVar.taxRate !== '') fd.append('taxRate', String(Number(newVar.taxRate)));
            (newVar.images || []).slice(0, 3).forEach(f => fd.append('images', f));
            const res = await adminApi().post(`/products/${product.id}/variants`, fd);
            setVariants([...variants, res.data]);
            setNewVar({ label: '', price: '', mrp: '', storePrice: '', stock: '', taxRate: '', images: [] });
            onRefresh();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add variant');
        }
    };

    const handleEditStart = (v) => {
        setEditingId(v.id);
        setEditForm({ label: v.label, price: v.price, mrp: v.mrp || '', storePrice: v.storePrice || '', stock: v.stock, taxRate: v.taxRate != null ? String(v.taxRate) : '', images: [] });
    };

    const handleSave = async (id) => {
        try {
            const fd = new FormData();
            fd.append('label', editForm.label);
            fd.append('price', String(Number(editForm.price)));
            fd.append('mrp', editForm.mrp ? String(Number(editForm.mrp)) : '');
            fd.append('storePrice', editForm.storePrice ? String(Number(editForm.storePrice)) : '');
            fd.append('stock', String(Number(editForm.stock)));
            if (editForm.taxRate !== '') fd.append('taxRate', String(Number(editForm.taxRate)));
            else fd.append('clearTaxRate', 'true');
            (editForm.images || []).slice(0, 3).forEach(f => fd.append('images', f));
            const res = await adminApi().patch(`/products/${product.id}/variants/${id}`, fd);
            setVariants(variants.map(v => v.id === id ? res.data : v));
            setEditingId(null);
            onRefresh();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update variant');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete variant?')) return;
        try {
            await adminApi().delete(`/products/${product.id}/variants/${id}`);
            setVariants(variants.filter(v => v.id !== id));
            onRefresh();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete variant');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-800">Variants for {product.name}</h2>
                    <RippleButton onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</RippleButton>
                </div>
                <div className="p-6 space-y-4">
                    {variants.length === 0 ? (
                        <p className="text-gray-500 text-sm">No variants yet.</p>
                    ) : (
                        <div className="space-y-3">
                            {variants.map(v => (
                                <div key={v.id} className="bg-gray-50 p-4 rounded border border-gray-100">
                                    {editingId === v.id ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <input type="text" value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} className="px-2 py-1 text-sm border rounded text-gray-900" placeholder="Label" />
                                                <input type="number" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))} className="px-2 py-1 text-sm border rounded text-gray-900" placeholder="Price" />
                                                <input type="number" value={editForm.mrp} onChange={e => setEditForm(f => ({ ...f, mrp: e.target.value }))} className="px-2 py-1 text-sm border rounded text-gray-900" placeholder="MRP" />
                                                <input type="number" value={editForm.storePrice} onChange={e => setEditForm(f => ({ ...f, storePrice: e.target.value }))} className="px-2 py-1 text-sm border rounded text-gray-900" placeholder="Store Price" />
                                                <input type="number" value={editForm.stock} onChange={e => setEditForm(f => ({ ...f, stock: e.target.value }))} className="px-2 py-1 text-sm border rounded text-gray-900" placeholder="Stock" />
                                                <GstSelect value={editForm.taxRate} onChange={e => setEditForm(f => ({ ...f, taxRate: e.target.value }))} placeholder="GST (inherit)" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 block mb-1">Add Images (max 3 total)</label>
                                                <input type="file" multiple accept="image/*"
                                                    onChange={e => setEditForm(f => ({ ...f, images: Array.from(e.target.files).slice(0, 3) }))}
                                                    className="text-xs w-full" />
                                                <ImagePreview
                                                    files={editForm.images}
                                                    onRemove={idx => setEditForm(f => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleSave(v.id)} className="bg-ud-primary text-white px-3 py-1 text-xs rounded">Save</button>
                                                <button onClick={() => setEditingId(null)} className="bg-gray-200 text-gray-700 px-3 py-1 text-xs rounded">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-2 flex-1 min-w-0">
                                                {/* Image strip — show all variant images */}
                                                <div className="flex gap-1 flex-shrink-0">
                                                    {v.images?.length > 0 ? v.images.map((img, imgIdx) => (
                                                        <div key={imgIdx} className="w-12 h-12 bg-gray-200 rounded overflow-hidden">
                                                            <img src={img} className="w-full h-full object-cover" alt="" />
                                                        </div>
                                                    )) : (
                                                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-[10px] text-gray-400">No Image</div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-gray-800">{v.label}</p>
                                                    <p className="text-xs text-gray-500">₹{v.price} {v.mrp ? `(MRP: ₹${v.mrp})` : ''} {v.storePrice ? `• Store: ₹${v.storePrice}` : ''} • {v.stock} in stock • GST: {v.taxRate != null ? `₹${v.taxRate}` : 'inherited'}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 flex-shrink-0 ml-2">
                                                <button onClick={() => handleEditStart(v)} className="text-ud-primary text-xs hover:underline">Edit</button>
                                                <button onClick={() => handleDelete(v.id)} className="text-red-500 text-xs hover:underline">Delete</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="bg-gray-50 p-4 rounded mt-4 border border-gray-200">
                        <h3 className="text-sm font-bold text-gray-800 mb-2">Add New Variant</h3>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <input type="text" placeholder="Label (e.g. 500g)" value={newVar.label} onChange={e => setNewVar(v => ({ ...v, label: e.target.value }))} className="px-2 py-1 text-sm border rounded text-gray-900" />
                            <input type="number" placeholder="Price" value={newVar.price} onChange={e => setNewVar(v => ({ ...v, price: e.target.value }))} className="px-2 py-1 text-sm border rounded text-gray-900" />
                            <input type="number" placeholder="MRP (Optional)" value={newVar.mrp} onChange={e => setNewVar(v => ({ ...v, mrp: e.target.value }))} className="px-2 py-1 text-sm border rounded text-gray-900" />
                            <input type="number" placeholder="Store Price (Optional)" value={newVar.storePrice} onChange={e => setNewVar(v => ({ ...v, storePrice: e.target.value }))} className="px-2 py-1 text-sm border rounded text-gray-900" />
                            <input type="number" placeholder="Stock" value={newVar.stock} onChange={e => setNewVar(v => ({ ...v, stock: e.target.value }))} className="px-2 py-1 text-sm border rounded text-gray-900" />
                            <GstSelect value={newVar.taxRate} onChange={e => setNewVar(v => ({ ...v, taxRate: e.target.value }))} placeholder="GST (inherit)" />
                        </div>
                        <div className="mb-2">
                            <label className="text-xs text-gray-500 block mb-1">Images (max 3, optional)</label>
                            <input type="file" multiple accept="image/*"
                                onChange={e => setNewVar(v => ({ ...v, images: Array.from(e.target.files).slice(0, 3) }))}
                                className="text-xs w-full" />
                            <ImagePreview
                                files={newVar.images}
                                onRemove={idx => setNewVar(v => ({ ...v, images: v.images.filter((_, i) => i !== idx) }))}
                            />
                        </div>
                        <RippleButton onClick={handleAdd} disabled={!newVar.label || !newVar.price || !newVar.stock} className="w-full bg-ud-primary text-white py-2 text-sm rounded disabled:opacity-50">Add Variant</RippleButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AdminProducts = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [variantsProduct, setVariantsProduct] = useState(null);
    const { admin } = useAdminAuth();

    const fetchProducts = async (signal) => {
        try {
            const res = await adminApi().get('/products/admin/my-store', { signal });
            const data = res.data;
            const productList = Array.isArray(data) ? data : (data.data || []);
            setProducts(productList);
        } catch (err) {
            if (err.name !== 'CanceledError') console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const ctrl = new AbortController();
        fetchProducts(ctrl.signal);
        return () => ctrl.abort();
    }, []);

    const handleDelete = async (product) => {
        if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
        try {
            await adminApi().delete(`/products/${product.id}`);
            setProducts(prev => prev.filter(p => p.id !== product.id));
        } catch (err) {
            console.error(err);
        }
    };

    const openCreate = () => { setEditingProduct(null); setShowModal(true); };
    const openEdit = (p) => { setEditingProduct(p); setShowModal(true); };
    const closeModal = () => { setShowModal(false); setEditingProduct(null); };
    const openVariants = (p) => setVariantsProduct(p);
    const closeVariants = () => setVariantsProduct(null);
    const onSaved = () => { closeModal(); fetchProducts(); };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Products</h1>
                <RippleButton onClick={openCreate} className="bg-ud-primary text-white px-4 py-2 rounded shadow hover:bg-ud-primary/90 transition-colors flex items-center">
                    <span className="text-xl mr-1">+</span> Add Product
                </RippleButton>
            </div>

            {loading ? <div className="text-center p-10 animate-pulse text-gray-500">Loading products...</div> : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price / Stock</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {products.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-10 text-center text-gray-500">
                                        No products found in your store.
                                    </td>
                                </tr>
                            )}
                            {products.map(p => (
                                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10">
                                                {p.images && p.images[0] ? (
                                                    <img className="h-10 w-10 rounded object-cover border border-gray-200" src={p.images[0]} alt="" />
                                                ) : (p.variants?.[0]?.images?.[0] ? (
                                                    <img className="h-10 w-10 rounded object-cover border border-gray-200" src={p.variants[0].images[0]} alt="" />
                                                ) : (
                                                    <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Img</div>
                                                ))}
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={p.name}>{p.name}</div>
                                                <div className="text-xs text-gray-400">{p.id.substring(0, 8)}...</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                            {p.subCategory || p.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="font-bold text-gray-800">
                                            {p.variants?.length > 0 ? (
                                                `Starts at ₹${Math.min(...p.variants.map(v => v.price))}`
                                            ) : `₹${p.price}`}
                                        </div>
                                        {(() => {
                                            const displayStock = p.variants?.length > 0 
                                                ? p.variants.reduce((acc, v) => acc + (v.stock || 0), 0)
                                                : (p.stock || 0);
                                            return (
                                                <div className={`text-xs ${displayStock < 10 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                                    {displayStock} in {p.variants?.length > 0 ? 'total ' : ''}stock
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <RippleButton onClick={() => openVariants(p)} className="text-emerald-600 hover:text-emerald-900 mr-4 font-semibold">Variants ({p.variants?.length || 0})</RippleButton>
                                        <RippleButton onClick={() => openEdit(p)} className="text-indigo-600 hover:text-indigo-900 mr-4 font-semibold">Edit</RippleButton>
                                        <RippleButton onClick={() => handleDelete(p)} className="text-red-600 hover:text-red-900 font-semibold">Delete</RippleButton>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <ProductModal product={editingProduct} onClose={closeModal} onSaved={onSaved} admin={admin} />
            )}
            {variantsProduct && (
                <VariantsModal product={variantsProduct} onClose={closeVariants} onRefresh={() => fetchProducts()} />
            )}
        </div>
    );
};
export default AdminProducts;
