import { RippleButton } from '../ui/ripple-button';
import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AdminManagers = () => {
    const { admin } = useAdminAuth();
    const [managers, setManagers] = useState([]);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({ name: '', phone: '', pin: '', storeId: '' });

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('ud_admin_token');
            const [manRes, storeRes] = await Promise.all([
                fetch(`${API_URL}/store-managers`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_URL}/stores`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            if (manRes.ok && storeRes.ok) {
                setManagers(await manRes.json());
                setStores(await storeRes.json());
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
            const url = editingId ? `${API_URL}/store-managers/${editingId}` : `${API_URL}/store-managers`;
            const method = editingId ? 'PATCH' : 'POST';

            // Do not send empty pin on update
            const dataToSubmit = { ...formData };
            if (editingId && !dataToSubmit.pin) {
                delete dataToSubmit.pin;
            }
            if (dataToSubmit.phone && !dataToSubmit.phone.startsWith('+91')) {
                dataToSubmit.phone = `+91${dataToSubmit.phone}`;
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
                fetchData();
                setShowForm(false);
                setEditingId(null);
                setFormData({ name: '', phone: '', pin: '', storeId: '' });
                alert(editingId ? `Store Manager updated successfully!` : `Store Manager created successfully!`);
            } else {
                const data = await res.json();
                alert(data.message || (editingId ? 'Failed to update' : 'Failed to create'));
            }
        } catch (err) {
            console.error(err);
            alert('Error saving manager');
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        try {
            const token = localStorage.getItem('ud_admin_token');
            const res = await fetch(`${API_URL}/store-managers/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            if (res.ok) {
                fetchData();
            } else {
                alert('failed to toggle status');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const deleteManager = async (id) => {
        if (!window.confirm('Are you sure you want to delete this manager?')) return;
        try {
            const token = localStorage.getItem('ud_admin_token');
            const res = await fetch(`${API_URL}/store-managers/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) fetchData();
            else alert('Failed to delete manager');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Store Managers</h1>
                <RippleButton
                    onClick={() => {
                        if (showForm) {
                            setShowForm(false);
                            setEditingId(null);
                            setFormData({ name: '', phone: '', pin: '', storeId: '' });
                        } else {
                            setShowForm(true);
                            setEditingId(null);
                            setFormData({ name: '', phone: '', pin: '', storeId: '' });
                        }
                    }}
                    className="bg-ud-primary text-white px-4 py-2 rounded hover:brightness-110"
                >
                    {showForm ? 'Cancel' : 'Add Manager'}
                </RippleButton>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-6 w-full max-w-lg">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-800">Name</label>
                            <input required type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full border rounded p-2 text-gray-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-800">Phone Number</label>
                            <div className="flex border rounded overflow-hidden">
                                <span className="bg-gray-100 border-r px-3 py-2 text-gray-700 font-medium">+91</span>
                                <input required type="text" maxLength={10} pattern="\d{10}" placeholder="9999999999" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} className="w-full p-2 text-gray-900 outline-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-800">PIN (4 digits) {editingId && '(Leave blank to keep current)'}</label>
                            <input required={!editingId} type="text" maxLength={4} pattern="\d{4}" value={formData.pin} onChange={e => setFormData({ ...formData, pin: e.target.value })} className="w-full border rounded p-2 text-gray-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-gray-800">Assign to Store</label>
                            <select required value={formData.storeId} onChange={e => setFormData({ ...formData, storeId: e.target.value })} className="w-full border rounded p-2 text-gray-900">
                                <option value="">Select a store</option>
                                {stores.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.storeCode})</option>
                                ))}
                            </select>
                        </div>
                        <RippleButton type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">{editingId ? 'Update Manager' : 'Create Manager'}</RippleButton>
                    </form>
                </div>
            )}

            {loading ? <p>Loading managers...</p> : (
                <div className="bg-white rounded overflow-hidden shadow">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {managers.map(m => (
                                <tr key={m.id}>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{m.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{m.phone}</td>
                                    <td className="px-6 py-4 text-sm text-gray-900">{m.store?.name || m.storeId}</td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${m.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {m.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm flex gap-3">
                                        <RippleButton onClick={() => {
                                            setEditingId(m.id);
                                            setFormData({ name: m.name, phone: m.phone.replace('+91', ''), pin: '', storeId: m.storeId });
                                            setShowForm(true);
                                        }} className="text-blue-600 hover:text-blue-900 font-medium text-xs">Edit</RippleButton>
                                        <RippleButton onClick={() => deleteManager(m.id)} className="text-red-600 hover:text-red-900 font-medium text-xs">Delete</RippleButton>
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

export default AdminManagers;
