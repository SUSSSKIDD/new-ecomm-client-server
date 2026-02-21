import { RippleButton } from '../ui/ripple-button';
import { useEffect, useState } from 'react';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const AdminDelivery = () => {
    const [deliveryPersons, setDeliveryPersons] = useState([]);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', homeStoreId: '' });

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('ud_admin_token');
            const [delRes, storeRes] = await Promise.all([
                fetch(`${API_URL}/delivery/persons`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_URL}/stores`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            if (delRes.ok && storeRes.ok) {
                setDeliveryPersons(await delRes.json());
                setStores(await storeRes.json());
            } else {
                setError('Failed to fetch data');
            }
        } catch (err) {
            console.error(err);
            setError('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('ud_admin_token');
            const dataToSubmit = { ...formData };
            if (dataToSubmit.phone && !dataToSubmit.phone.startsWith('+91')) {
                dataToSubmit.phone = `+91${dataToSubmit.phone}`;
            }

            const res = await fetch(`${API_URL}/delivery/persons`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(dataToSubmit)
            });

            if (res.ok) {
                const newPerson = await res.json();
                setDeliveryPersons(prev => [newPerson, ...prev]);
                setShowForm(false);
                setFormData({ name: '', phone: '', homeStoreId: '' });
                alert(`Delivery guy created successfully! Original PIN is: ${newPerson.pin}`);
            } else {
                const data = await res.json();
                alert(data.message || 'Failed to create');
            }
        } catch (err) {
            console.error(err);
            alert('Error creating delivery person');
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        try {
            const token = localStorage.getItem('ud_admin_token');
            await fetch(`${API_URL}/delivery/persons/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Delivery Personnel Management</h1>
                <RippleButton
                    onClick={() => setShowForm(!showForm)}
                    className="bg-ud-primary text-white px-4 py-2 rounded hover:brightness-110"
                >
                    {showForm ? 'Cancel' : 'Add Delivery Guy'}
                </RippleButton>
            </div>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded mb-6">{error}</div>}

            {showForm && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                    <h2 className="text-lg font-bold mb-4">New Delivery Guy</h2>
                    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="mt-1 w-full border border-gray-300 rounded p-2 text-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                            <div className="mt-1 flex border border-gray-300 rounded overflow-hidden">
                                <span className="bg-gray-100 border-r px-3 py-2 text-gray-700 font-medium">+91</span>
                                <input
                                    required
                                    type="text"
                                    maxLength={10}
                                    pattern="\d{10}"
                                    placeholder="9999999999"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                    className="w-full p-2 text-gray-900 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Assign to Store</label>
                            <select
                                required
                                value={formData.homeStoreId}
                                onChange={e => setFormData({ ...formData, homeStoreId: e.target.value })}
                                className="mt-1 w-full border border-gray-300 rounded p-2 text-gray-900"
                            >
                                <option value="">Select a store</option>
                                {stores.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.storeCode})</option>
                                ))}
                            </select>
                        </div>
                        <RippleButton type="submit" className="bg-blue-600 text-white px-4 py-2 rounded font-medium">Create</RippleButton>
                    </form>
                </div>
            )}

            {loading ? (
                <p>Loading...</p>
            ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Home Store</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {deliveryPersons.map(p => (
                                <tr key={p.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.phone}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.homeStore?.name || p.homeStoreId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {p.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <RippleButton onClick={() => toggleStatus(p.id, p.isActive)} className="text-blue-600 hover:text-blue-900">Toggle Status</RippleButton>
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

export default AdminDelivery;
