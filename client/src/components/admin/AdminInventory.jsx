/* eslint-disable react/prop-types */
import { RippleButton } from '../ui/ripple-button';
import React, { useEffect, useState } from 'react';
import { adminApi, API_URL } from '../../lib/api';

const AdminInventory = () => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stockEdits, setStockEdits] = useState({});
    const [variantStockEdits, setVariantStockEdits] = useState({});
    const [updatingId, setUpdatingId] = useState(null);
    const [successId, setSuccessId] = useState(null);

    const getToken = () => localStorage.getItem('ud_admin_token');
    const getStoreId = () => {
        try {
            return JSON.parse(localStorage.getItem('ud_admin_user')).storeId;
        } catch { return null; }
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    const fetchInventory = async () => {
        setLoading(true);
        try {
            const storeId = getStoreId();
            if (!storeId) return;
            const res = await fetch(`${API_URL}/stores/${storeId}/inventory`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (res.ok) {
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data.data || []);
                setInventory(list);
                setStockEdits({});
                setVariantStockEdits({});
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateStock = async (item) => {
        const productId = item.productId || item.product?.id || item.id;
        const newStock = stockEdits[productId];
        if (newStock === undefined || newStock === null) return;

        setUpdatingId(productId);
        try {
            const storeId = getStoreId();
            const res = await fetch(`${API_URL}/stores/${storeId}/inventory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${getToken()}`
                },
                body: JSON.stringify({ productId, stock: Number(newStock) })
            });
            if (res.ok) {
                setInventory(prev => prev.map(i => {
                    const id = i.productId || i.product?.id || i.id;
                    return id === productId ? { ...i, stock: Number(newStock) } : i;
                }));
                setSuccessId(productId);
                setTimeout(() => setSuccessId(null), 1500);
                setStockEdits(prev => { const n = { ...prev }; delete n[productId]; return n; });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setUpdatingId(null);
        }
    };

    const updateVariantStock = async (variantId, productId) => {
        const newStock = variantStockEdits[variantId];
        if (newStock === undefined || newStock === null) return;
        
        try {
            await adminApi().patch(`/products/${productId}/variants/${variantId}`, {
                stock: Number(newStock)
            });
            setVariantStockEdits(prev => { const n = { ...prev }; delete n[variantId]; return n; });
            fetchInventory();
        } catch (err) {
            console.error(err);
        }
    };

    const getProductId = (item) => item.productId || item.product?.id || item.id;
    const getProductName = (item) => item.product?.name || item.name || '—';
    const getProductCategory = (item) => item.product?.category || item.category || '—';
    const getStock = (item) => item.stock ?? 0;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
                <RippleButton
                    onClick={fetchInventory}
                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 transition-colors text-sm"
                >
                    Refresh
                </RippleButton>
            </div>

            {loading ? (
                <div className="text-center p-10 animate-pulse text-gray-500">Loading inventory...</div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Stock</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Update Stock</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {inventory.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-10 text-center text-gray-500">No inventory items found.</td>
                                </tr>
                            )}
                            {inventory.map(item => {
                                const pid = getProductId(item);
                                const stock = getStock(item);
                                const isEdited = stockEdits[pid] !== undefined;
                                return (
                                    <React.Fragment key={pid}>
                                        <tr className={`hover:bg-gray-50 transition-colors ${successId === pid ? 'bg-green-50' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center gap-2">
                                                {getProductName(item)}
                                                {item.product?.variants?.length > 0 && (
                                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-100 uppercase tracking-tighter font-bold">Variants</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                    {getProductCategory(item)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {item.product?.variants?.length > 0 ? (
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-xs text-gray-400">See below</span>
                                                      {item.product.variants.some(v => v.stock <= 10) && (
                                                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100 animate-pulse">LOW</span>
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <span className={`font-bold text-base ${stock <= 10 ? 'text-red-600' : 'text-green-600'}`}>
                                                        {stock}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {item.product?.variants?.length > 0 ? (
                                                    <span className="text-xs text-gray-400 italic">Multi-stock</span>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={stockEdits[pid] ?? stock}
                                                            onChange={e => setStockEdits(prev => ({ ...prev, [pid]: e.target.value }))}
                                                            className="w-24 border border-gray-300 rounded px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-ud-primary bg-white shadow-sm"
                                                        />
                                                        <RippleButton
                                                            onClick={() => updateStock(item)}
                                                            disabled={!isEdited || updatingId === pid}
                                                            className="bg-ud-primary text-white px-4 py-1.5 rounded-md text-sm font-bold shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                        >
                                                            {updatingId === pid ? '...' : 'Update'}
                                                        </RippleButton>
                                                        {successId === pid && (
                                                            <span className="text-green-600 text-xs font-semibold animate-bounce">Saved!</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                        {item.product?.variants?.map(v => (
                                          <tr key={v.id} className="bg-gray-50/30 border-l-4 border-ud-primary/20">
                                            <td className="px-10 py-2 whitespace-nowrap text-xs font-medium text-gray-600">
                                              <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-ud-primary/40"></div>
                                                {v.label}
                                              </div>
                                            </td>
                                            <td className="px-6 py-2 whitespace-nowrap text-xs text-gray-400">—</td>
                                            <td className="px-6 py-2 whitespace-nowrap text-xs">
                                              <span className={`font-bold ${v.stock <= 10 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'} px-2 py-0.5 rounded border ${v.stock <= 10 ? 'border-red-100' : 'border-green-100'}`}>
                                                {v.stock} in stock
                                              </span>
                                            </td>
                                            <td className="px-6 py-2 whitespace-nowrap text-xs">
                                              <div className="flex items-center gap-2">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  value={variantStockEdits[v.id] ?? v.stock}
                                                  onChange={e => setVariantStockEdits(prev => ({ ...prev, [v.id]: e.target.value }))}
                                                  className="w-20 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ud-primary bg-white shadow-sm"
                                                />
                                                <button
                                                  onClick={() => updateVariantStock(v.id, pid)}
                                                  disabled={variantStockEdits[v.id] === undefined}
                                                  className="bg-ud-primary/80 text-white px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider disabled:opacity-30 hover:bg-ud-primary transition-colors active:scale-95"
                                                >
                                                  Update
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminInventory;
