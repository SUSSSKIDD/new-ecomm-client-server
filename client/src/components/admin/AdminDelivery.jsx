import { RippleButton } from '../ui/ripple-button';
import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/api';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const AdminDelivery = () => {
    const { admin } = useAdminAuth();
    const [deliveryPersons, setDeliveryPersons] = useState([]);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({ name: '', phone: '', homeStoreId: '', pin: '' });
    const [formError, setFormError] = useState('');
    const [formSuccess, setFormSuccess] = useState('');

    const fetchData = async (signal) => {
        try {
            setLoading(true);
            const [delRes] = await Promise.all([
                adminApi().get('/delivery/persons', { signal }),
            ]);
            setDeliveryPersons(delRes.data);
        } catch (err) {
            if (err.name !== 'CanceledError') {
                console.error(err);
                setError('Error loading data');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const ctrl = new AbortController();
        fetchData(ctrl.signal);
        return () => ctrl.abort();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        setFormSuccess('');
        try {
            const dataToSubmit = { ...formData };
            if (dataToSubmit.phone && !dataToSubmit.phone.startsWith('+91')) {
                dataToSubmit.phone = `+91${dataToSubmit.phone}`;
            }
            const res = await adminApi().post('/delivery/persons', dataToSubmit);
            const newPerson = res.data;
            setDeliveryPersons(prev => [newPerson, ...prev]);
            setShowForm(false);
            setFormData({ name: '', phone: '', pin: '' });
            setFormSuccess('Delivery person created successfully');
        } catch (err) {
            setFormError(err.response?.data?.message || 'Error creating delivery person');
        }
    };

    const toggleStatus = async (id, currentStatus) => {
        try {
            await adminApi().patch(`/delivery/persons/${id}`, { isActive: !currentStatus });
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Delivery Personnel Management</h1>
                {admin?.role === 'ADMIN' && (
                    <RippleButton
                        onClick={() => setShowForm(!showForm)}
                        className="bg-ud-primary text-white px-4 py-2 rounded hover:brightness-110"
                    >
                        {showForm ? 'Cancel' : 'Add Delivery Guy'}
                    </RippleButton>
                )}
            </div>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded mb-6">{error}</div>}
            {formError && <div className="bg-red-50 text-red-700 p-4 rounded mb-4 text-sm">{formError}</div>}
            {formSuccess && <div className="bg-green-50 text-green-700 p-4 rounded mb-4 text-sm">{formSuccess}</div>}

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
                            <label className="block text-sm font-medium text-gray-700">PIN (4 digits)</label>
                            <input
                                required
                                type="text"
                                maxLength={4}
                                pattern="\d{4}"
                                placeholder="1234"
                                value={formData.pin}
                                onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                                className="mt-1 w-full border border-gray-300 rounded p-2 text-gray-900 tracking-widest font-mono text-lg"
                            />
                            <p className="text-xs text-gray-400 mt-1">Delivery guy will use this PIN to login</p>
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PIN</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duty Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Status</th>
                                {admin?.role === 'ADMIN' && (
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {deliveryPersons.map(p => (
                                <tr key={p.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{p.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.phone}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-gray-700">
                                        {p.pin}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-bold rounded-full ${p.status === 'FREE' ? 'bg-green-100 text-green-800' :
                                            p.status === 'BUSY' ? 'bg-orange-100 text-orange-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                            {p.status === 'DUTY_OFF' ? 'OFF DUTY' : p.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${p.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {p.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    {admin?.role === 'ADMIN' && (
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <RippleButton onClick={() => toggleStatus(p.id, p.isActive)} className="text-blue-600 hover:text-blue-900">Toggle Status</RippleButton>
                                        </td>
                                    )}
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
