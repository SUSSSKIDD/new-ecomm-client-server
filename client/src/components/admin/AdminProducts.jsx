/* eslint-disable react/prop-types */
import { RippleButton } from '../ui/ripple-button';
import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { STORE_CATEGORY_SUBCATEGORIES } from '../../constants';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const emptyForm = { name: '', description: '', price: '', mrp: '', category: '', stock: '', storeLocation: '' };

const ProductModal = ({ product, onClose, onSaved, admin }) => {
    const defaultStoreLocation = admin?.storeCode || '';
    const [form, setForm] = useState(product ? {
        name: product.name || '',
        description: product.description || '',
        price: product.price || '',
        mrp: product.mrp || '',
        category: product.subCategory || product.category || '',
        stock: product.stock || '',
        storeLocation: product.storeLocation || defaultStoreLocation
    } : { ...emptyForm, storeLocation: defaultStoreLocation });

    const resolvedStoreType = admin?.storeType || 'GROCERY';
    const allowedCategories = STORE_CATEGORY_SUBCATEGORIES[resolvedStoreType] || [];
    const [images, setImages] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        const token = localStorage.getItem('ud_admin_token');
        const fd = new FormData();
        fd.append('name', form.name);
        fd.append('price', Number(form.price));
        fd.append('category', form.category);
        fd.append('stock', Number(form.stock));
        if (form.storeLocation) fd.append('storeLocation', form.storeLocation);
        if (form.description) fd.append('description', form.description);
        if (form.mrp) fd.append('mrp', Number(form.mrp));
        if (images) {
            for (let i = 0; i < Math.min(images.length, 3); i++) {
                fd.append('images', images[i]);
            }
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
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                            <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900">
                                <option value="">Select Category</option>
                                {allowedCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
                            <input type="number" required min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary text-gray-900" />
                        </div>
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
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Images (max 3)</label>
                        <input type="file" multiple accept="image/*" onChange={e => setImages(e.target.files)}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-ud-primary/10 file:text-ud-primary hover:file:bg-ud-primary/20 text-gray-900" />
                    </div>
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

const AdminProducts = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const { admin } = useAdminAuth();

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const token = localStorage.getItem('ud_admin_token');
            const res = await fetch(`${API_URL}/products/admin/my-store`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const productList = Array.isArray(data) ? data : (data.data || []);
                setProducts(productList);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (product) => {
        if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
        try {
            const token = localStorage.getItem('ud_admin_token');
            const res = await fetch(`${API_URL}/products/${product.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setProducts(prev => prev.filter(p => p.id !== product.id));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const openCreate = () => { setEditingProduct(null); setShowModal(true); };
    const openEdit = (p) => { setEditingProduct(p); setShowModal(true); };
    const closeModal = () => { setShowModal(false); setEditingProduct(null); };
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
                                                ) : (
                                                    <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Img</div>
                                                )}
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
                                        <div className="font-bold text-gray-800">₹{p.price}</div>
                                        <div className={`text-xs ${p.stock < 10 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                                            {p.stock} in stock
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
        </div>
    );
};
export default AdminProducts;
