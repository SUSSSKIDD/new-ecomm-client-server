import { RippleButton } from '../ui/ripple-button';
import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AdminStores = () => {
    const { admin } = useAdminAuth();
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ name: '', pincode: '', lat: '', lng: '', storeType: 'GROCERY' });

    useEffect(() => {
        fetchStores();
    }, []);

    const fetchStores = async () => {
        try {
            const token = localStorage.getItem('ud_admin_token');
            const res = await fetch(`${API_URL}/stores`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setStores(await res.json());
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('ud_admin_token');
            const url = editingId ? `${API_URL}/stores/${editingId}` : `${API_URL}/stores`;
            const method = editingId ? 'PATCH' : 'POST';

            const dataToSubmit = {
                ...formData,
                lat: parseFloat(formData.lat),
                lng: parseFloat(formData.lng)
            };

            if (editingId) {
                delete dataToSubmit.storeType;
            }

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(dataToSubmit)
            });

            if (res.ok) {
                fetchStores();
                setShowForm(false);
                setEditingId(null);
                setFormData({ name: '', pincode: '', lat: '', lng: '', storeType: 'GROCERY' });
            } else {
                const data = await res.json();
                alert(data.message || (editingId ? 'Failed to update' : 'Failed to create'));
            }
        } catch (err) {
            console.error(err);
            alert('Error saving store');
        }
    };

    const deleteStore = async (id) => {
        if (!window.confirm('Are you sure you want to delete this store?')) return;
        try {
            const token = localStorage.getItem('ud_admin_token');
            const res = await fetch(`${API_URL}/stores/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) fetchStores();
            else alert('Failed to delete store');
        } catch (err) {
            console.error(err);
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        try {
            const token = localStorage.getItem('ud_admin_token');
            const res = await fetch(`${API_URL}/stores/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ isActive: !currentStatus })
            });

            if (res.ok) {
                fetchStores();
            } else {
                const data = await res.json();
                alert(data.message || 'Failed to toggle status');
            }
        } catch (err) {
            console.error(err);
            alert('Error toggling status');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">global stores</h1>
                <RippleButton
                    onClick={() => {
                        if (showForm) {
                            setShowForm(false);
                            setEditingId(null);
                            setFormData({ name: '', pincode: '', lat: '', lng: '', storeType: 'GROCERY' });
                        } else {
                            setShowForm(true);
                        }
                    }}
                    className="bg-ud-primary text-white px-4 py-2 rounded hover:brightness-110"
                >
                    {showForm ? 'Cancel' : 'Add Store'}
                </RippleButton>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-6 w-full max-w-lg">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-800">Store Name</label>
                            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border rounded p-2 text-gray-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-800">Pincode</label>
                            <input required type="text" value={formData.pincode} onChange={e => setFormData({ ...formData, pincode: e.target.value })} className="w-full border rounded p-2 text-gray-900" />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1 text-gray-800">Latitude</label>
                                <input required type="number" step="any" value={formData.lat} onChange={e => setFormData({ ...formData, lat: e.target.value })} className="w-full border rounded p-2 text-gray-900" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1 text-gray-800">Longitude</label>
                                <input required type="number" step="any" value={formData.lng} onChange={e => setFormData({ ...formData, lng: e.target.value })} className="w-full border rounded p-2 text-gray-900" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-800">Store Type</label>
                            <select disabled={!!editingId} value={formData.storeType} onChange={e => setFormData({ ...formData, storeType: e.target.value })} className={`w-full border rounded p-2 text-gray-900 ${editingId ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
                                <option value="GROCERY">Grocery</option>
                                <option value="PIZZA_TOWN">Pizza Town & Food Zone</option>
                                <option value="AUTO_SERVICE">Auto Service & Parts</option>
                                <option value="DROP_IN_FACTORY">Drop In Factory (Print Factory)</option>
                                <option value="AUTO_PARTS_SHOP">Auto Parts Shop</option>
                                <option value="PICKUP_DROP">Pickup & Drop</option>
                                <option value="HEALTH_SERVICE">Health Service</option>
                            </select>
                        </div>
                        <RippleButton type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">{editingId ? 'Update Store' : 'Create Store'}</RippleButton>
                    </form>
                </div>
            )}

            {loading ? <p>Loading stores...</p> : (
                <div className="bg-white rounded overflow-hidden shadow">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pincode</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {stores.map(s => (
                                <tr key={s.id}>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.storeCode}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{s.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{s.pincode}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{s.storeType}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {s.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium flex gap-3">
                                        <RippleButton onClick={() => {
                                            setEditingId(s.id);
                                            setFormData({ name: s.name, pincode: s.pincode, lat: s.lat, lng: s.lng, storeType: s.storeType });
                                            setShowForm(true);
                                        }} className="text-blue-600 hover:text-blue-900">Edit</RippleButton>
                                        <RippleButton onClick={() => toggleStatus(s.id, s.isActive)} className="text-blue-600 hover:text-blue-900">Toggle</RippleButton>
                                        <RippleButton onClick={() => deleteStore(s.id)} className="text-red-600 hover:text-red-900">Delete</RippleButton>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminStores;
