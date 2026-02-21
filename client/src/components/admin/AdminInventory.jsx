/* eslint-disable react/prop-types */
import { RippleButton } from '../ui/ripple-button';
import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AdminInventory = () => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stockEdits, setStockEdits] = useState({});
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
                                    <tr key={pid} className={`hover:bg-gray-50 transition-colors ${successId === pid ? 'bg-green-50' : ''}`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {getProductName(item)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                {getProductCategory(item)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`font-bold ${stock <= 10 ? 'text-red-600' : 'text-green-600'}`}>
                                                {stock}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={stockEdits[pid] ?? stock}
                                                    onChange={e => setStockEdits(prev => ({ ...prev, [pid]: e.target.value }))}
                                                    className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ud-primary"
                                                />
                                                <RippleButton
                                                    onClick={() => updateStock(item)}
                                                    disabled={!isEdited || updatingId === pid}
                                                    className="bg-ud-primary text-white px-3 py-1 rounded text-sm hover:bg-ud-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    {updatingId === pid ? '...' : 'Update'}
                                                </RippleButton>
                                                {successId === pid && (
                                                    <span className="text-green-600 text-xs font-semibold">Saved!</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
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
