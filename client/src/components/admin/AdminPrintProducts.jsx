/* eslint-disable react/prop-types */
import { RippleButton } from '../ui/ripple-button';
import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../../lib/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const PRODUCT_TYPES = [
    { value: 'TSHIRT', label: 'T-Shirt' },
    { value: 'FRAME', label: 'Frame' },
    { value: 'MUG', label: 'Mug' },
    { value: 'OTHER', label: 'Other' },
];

const PRESET_SIZES = {
    TSHIRT: [
        { label: 'S', value: 'S' },
        { label: 'M', value: 'M' },
        { label: 'L', value: 'L' },
        { label: 'XL', value: 'XL' },
        { label: 'XXL', value: 'XXL' },
    ],
    FRAME: [
        { label: '4x4 in (10x10 cm)', value: '4x4' },
        { label: '4x6 in (10x15 cm)', value: '4x6' },
        { label: '5x7 in (13x18 cm)', value: '5x7' },
        { label: '6x8 in (15x20 cm)', value: '6x8' },
        { label: '8x10 in (20x25 cm)', value: '8x10' },
        { label: '8x12 in (20x30 cm)', value: '8x12' },
        { label: '11x14 in (28x36 cm)', value: '11x14' },
        { label: '12x16 in (30x40 cm)', value: '12x16' },
        { label: '16x20 in (40x50 cm)', value: '16x20' },
        { label: '18x24 in (45x60 cm)', value: '18x24' },
        { label: '20x30 in (50x75 cm)', value: '20x30' },
        { label: '24x36 in (60x90 cm)', value: '24x36' },
    ],
    MUG: [
        { label: 'Standard (11 oz)', value: '11oz' },
        { label: 'Large (15 oz)', value: '15oz' },
    ],
    OTHER: [],
};

const emptyForm = {
    name: '',
    productType: 'TSHIRT',
    basePrice: '',
    sizes: [],
    image: '',
};

const AdminPrintProducts = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [customSize, setCustomSize] = useState({ label: '', value: '' });

    const fetchProducts = useCallback(async () => {
        try {
            const res = await adminApi().get('/print-products');
            setProducts(res.data);
        } catch (err) {
            console.error('Failed to fetch print products:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...emptyForm, sizes: [...PRESET_SIZES.TSHIRT] });

        setError('');
        setShowModal(true);
    };

    const openEdit = (product) => {
        setEditingId(product.id);
        setForm({
            name: product.name,
            productType: product.productType,
            basePrice: product.basePrice.toString(),
            sizes: product.sizes || [],
            image: product.image || '',
        });

        setError('');
        setShowModal(true);
    };

    const handleProductTypeChange = (type) => {
        setForm(prev => ({
            ...prev,
            productType: type,
            sizes: [...(PRESET_SIZES[type] || [])],
        }));
    };

    const toggleSize = (sizeValue) => {
        setForm(prev => {
            const exists = prev.sizes.find(s => s.value === sizeValue);
            if (exists) {
                return { ...prev, sizes: prev.sizes.filter(s => s.value !== sizeValue) };
            }
            const presetSize = (PRESET_SIZES[prev.productType] || []).find(s => s.value === sizeValue);
            if (presetSize) {
                return { ...prev, sizes: [...prev.sizes, presetSize] };
            }
            return prev;
        });
    };

    const addCustomSize = () => {
        if (!customSize.label.trim() || !customSize.value.trim()) return;
        setForm(prev => ({
            ...prev,
            sizes: [...prev.sizes, { label: customSize.label.trim(), value: customSize.value.trim() }],
        }));
        setCustomSize({ label: '', value: '' });
    };

    const removeCustomSize = (value) => {
        setForm(prev => ({
            ...prev,
            sizes: prev.sizes.filter(s => s.value !== value),
        }));
    };

    const handleImageUpload = async (file) => {
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            const token = localStorage.getItem('ud_admin_token');
            const res = await fetch(`${API_URL}/uploads/product-image`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            setForm(prev => ({ ...prev, image: data.url }));
        } catch (err) {
            console.error('Image upload failed:', err);
            setError('Image upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return setError('Name is required');
        if (!form.basePrice || Number(form.basePrice) < 0) return setError('Valid base price is required');
        if (form.sizes.length === 0) return setError('At least one size is required');

        setSaving(true);
        setError('');
        try {
            const payload = {
                name: form.name.trim(),
                productType: form.productType,
                basePrice: Number(form.basePrice),
                sizes: form.sizes,
                image: form.image || undefined,
            };

            if (editingId) {
                await adminApi().patch(`/print-products/${editingId}`, payload);
            } else {
                await adminApi().post('/print-products', payload);
            }
            setShowModal(false);
            fetchProducts();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save product');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (id, isActive) => {
        try {
            if (isActive) {
                await adminApi().delete(`/print-products/${id}`);
            } else {
                await adminApi().patch(`/print-products/${id}/activate`);
            }
            fetchProducts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to toggle status');
        }
    };

    const presetSizes = PRESET_SIZES[form.productType] || [];
    const customSizes = form.sizes.filter(s => !presetSizes.find(p => p.value === s.value));

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Print Products</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage products available for custom design printing</p>
                </div>
                <RippleButton
                    onClick={openCreate}
                    className="bg-ud-primary text-white px-4 py-2 rounded hover:brightness-110 text-sm font-medium"
                >
                    Add Product
                </RippleButton>
            </div>

            {loading ? (
                <div className="text-center p-10 animate-pulse text-gray-500">Loading print products...</div>
            ) : products.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
                    <p className="text-gray-500">No print products yet. Add your first product to get started.</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Price</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sizes</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {products.map(p => (
                                <tr key={p.id} className={!p.isActive ? 'opacity-50' : ''}>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {p.image ? (
                                                <img src={p.image} alt={p.name} className="w-10 h-10 rounded object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-lg">
                                                    {p.productType === 'TSHIRT' ? '👕' : p.productType === 'FRAME' ? '🖼️' : p.productType === 'MUG' ? '☕' : '📦'}
                                                </div>
                                            )}
                                            <span className="text-sm font-medium text-gray-900">{p.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {PRODUCT_TYPES.find(t => t.value === p.productType)?.label || p.productType}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        ₹{p.basePrice}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(p.sizes || []).slice(0, 4).map(s => (
                                                <span key={s.value} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                                    {s.value}
                                                </span>
                                            ))}
                                            {(p.sizes || []).length > 4 && (
                                                <span className="px-1.5 py-0.5 text-gray-400 text-xs">
                                                    +{p.sizes.length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {p.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm space-x-2">
                                        <RippleButton onClick={() => openEdit(p)} className="text-blue-600 hover:text-blue-800 font-medium">
                                            Edit
                                        </RippleButton>
                                        <RippleButton
                                            onClick={() => handleToggleActive(p.id, p.isActive)}
                                            className={`font-medium ${p.isActive ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                                        >
                                            {p.isActive ? 'Deactivate' : 'Activate'}
                                        </RippleButton>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
                        <div className="p-6 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800">
                                {editingId ? 'Edit Print Product' : 'Add Print Product'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-ud-primary"
                                    placeholder="e.g. Classic T-Shirt"
                                    required
                                />
                            </div>

                            {/* Product Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Product Type</label>
                                <select
                                    value={form.productType}
                                    onChange={e => handleProductTypeChange(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-ud-primary"
                                >
                                    {PRODUCT_TYPES.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Base Price */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (₹)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.basePrice}
                                    onChange={e => setForm(prev => ({ ...prev, basePrice: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-ud-primary"
                                    placeholder="0.00"
                                    required
                                />
                            </div>

                            {/* Image Upload */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
                                <div className="flex items-center gap-3">
                                    {form.image && (
                                        <img src={form.image} alt="Preview" className="w-16 h-16 rounded object-cover border" />
                                    )}
                                    <div className="flex-1">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(file);
                                            }}
                                            className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-ud-primary/10 file:text-ud-primary hover:file:bg-ud-primary/20"
                                        />
                                        {uploading && <p className="text-xs text-gray-400 mt-1 animate-pulse">Uploading...</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Sizes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Available Sizes</label>

                                {/* Preset size toggles */}
                                {presetSizes.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {presetSizes.map(size => {
                                            const selected = form.sizes.find(s => s.value === size.value);
                                            return (
                                                <button
                                                    key={size.value}
                                                    type="button"
                                                    onClick={() => toggleSize(size.value)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                                        selected
                                                            ? 'bg-ud-primary text-white border-ud-primary'
                                                            : 'bg-white text-gray-600 border-gray-300 hover:border-ud-primary'
                                                    }`}
                                                >
                                                    {size.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Custom sizes */}
                                {customSizes.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {customSizes.map(size => (
                                            <span key={size.value} className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                                {size.label} ({size.value})
                                                <button type="button" onClick={() => removeCustomSize(size.value)} className="hover:text-red-600">&times;</button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Add custom size */}
                                <div className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={customSize.label}
                                            onChange={e => setCustomSize(prev => ({ ...prev, label: e.target.value }))}
                                            placeholder="Label (e.g. Extra Large)"
                                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-ud-primary"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={customSize.value}
                                            onChange={e => setCustomSize(prev => ({ ...prev, value: e.target.value }))}
                                            placeholder="Value (e.g. 3XL)"
                                            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-ud-primary"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={addCustomSize}
                                        disabled={!customSize.label.trim() || !customSize.value.trim()}
                                        className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
                                    >
                                        + Add
                                    </button>
                                </div>

                                <p className="text-xs text-gray-400 mt-2">
                                    Selected: {form.sizes.length} size{form.sizes.length !== 1 ? 's' : ''}
                                </p>
                            </div>

                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <RippleButton
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </RippleButton>
                                <RippleButton
                                    type="submit"
                                    disabled={saving || uploading}
                                    className="flex-1 px-4 py-2 bg-ud-primary text-white rounded-lg text-sm font-medium hover:brightness-110 disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editingId ? 'Update Product' : 'Create Product'}
                                </RippleButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPrintProducts;
