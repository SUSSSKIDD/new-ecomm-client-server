import { RippleButton } from '../ui/ripple-button';
import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const StatCard = ({ title, value, color }) => {
    const colors = {
        blue: 'bg-blue-50 text-blue-700 border-blue-100',
        green: 'bg-green-50 text-green-700 border-green-100',
        purple: 'bg-purple-50 text-purple-700 border-purple-100',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    };
    return (
        <div className={`p-6 rounded-lg shadow-sm border ${colors[color] || colors.blue} transition transform hover:scale-105 duration-200`}>
            <p className="text-sm font-medium opacity-80 mb-1">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
        </div>
    );
};

const AdminDashboard = () => {
    const { admin } = useAdminAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('ud_admin_token');
            const res = await fetch(`${API_URL}/dashboard/store`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 animate-pulse">Loading Dashboard Stats...</div>;
    if (!stats) return <div className="p-8 text-center text-red-500">Failed to load dashboard data. Please try refreshing.</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
                <RippleButton onClick={fetchStats} className="text-sm text-ud-primary hover:underline">Refresh Data</RippleButton>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Total Orders" value={stats.totalOrders} color="blue" />
                <StatCard title="Total Revenue" value={`₹${stats.totalRevenue?.toLocaleString()}`} color="green" />
                <StatCard title="Today's Orders" value={stats.todayOrders} color="purple" />
                <StatCard title="Today's Revenue" value={`₹${stats.todayRevenue?.toLocaleString()}`} color="indigo" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-4 border-b pb-2">Orders by Status</h3>
                    <div className="space-y-3">
                        {Object.entries(stats.ordersByStatus || {}).map(([status, count]) => (
                            <div key={status} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded transition-colors">
                                <span className="text-sm font-medium text-gray-600">{status}</span>
                                <span className={`font-bold px-3 py-1 rounded-full text-xs ${{
                                        PENDING: 'bg-yellow-100 text-yellow-800',
                                        CONFIRMED: 'bg-blue-100 text-blue-800',
                                        PROCESSING: 'bg-indigo-100 text-indigo-800',
                                        ORDER_PICKED: 'bg-orange-100 text-orange-800',
                                        SHIPPED: 'bg-purple-100 text-purple-800',
                                        DELIVERED: 'bg-green-100 text-green-800',
                                        CANCELLED: 'bg-red-100 text-red-800',
                                    }[status] || 'bg-gray-100 text-gray-800'
                                    }`}>{count}</span>
                            </div>
                        ))}
                        {Object.keys(stats.ordersByStatus || {}).length === 0 && <p className="text-gray-500 text-sm italic">No orders yet.</p>}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold mb-4 border-b pb-2">Inventory Health</h3>
                    <div className="flex justify-between items-center mb-4 p-4 bg-red-50 rounded-lg border border-red-100">
                        <div>
                            <p className="text-red-800 font-bold text-sm uppercase tracking-wide">Low Stock Alert</p>
                            <p className="text-xs text-red-600 mt-1">Products with ≤ 10 items</p>
                        </div>
                        <div className="text-3xl font-bold text-red-700">{stats.lowStockProducts}</div>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div>
                            <p className="text-blue-800 font-bold text-sm uppercase tracking-wide">Total Products</p>
                            <p className="text-xs text-blue-600 mt-1">Active inventory count</p>
                        </div>
                        <div className="text-3xl font-bold text-blue-700">{stats.totalProducts}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
