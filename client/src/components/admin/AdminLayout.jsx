import { RippleButton } from '../ui/ripple-button';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useEffect } from 'react';

const AdminLayout = () => {
    const { admin, logout, loading } = useAdminAuth();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !admin) {
            navigate('/admin/login');
        }
    }, [admin, loading, navigate]);

    if (loading || !admin) return <div className="p-10 text-center text-gray-500">Loading Admin Panel...</div>;

    let navItems = [
        { name: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
        { name: 'Products', path: '/admin/products', icon: '📦' },
        { name: 'Orders', path: '/admin/orders', icon: '🛒' },
        { name: 'Inventory', path: '/admin/inventory', icon: '📋' },
        { name: 'Categories', path: '/admin/subcategories', icon: '🏷️' },
        { name: 'Ledger', path: '/admin/ledger', icon: '📒' },
    ];

    // Show Print Products for DROP_IN_FACTORY store managers
    if (admin?.storeType === 'DROP_IN_FACTORY' && admin?.role !== 'ADMIN') {
        navItems.push({ name: 'Print Products', path: '/admin/print-products', icon: '🖨️' });
    }

    if (admin?.role === 'ADMIN') {
        navItems = navItems.filter(i => i.name !== 'Products' && i.name !== 'Inventory');
        navItems.push({ name: 'Stores', path: '/admin/stores', icon: '🏪' });
        navItems.push({ name: 'Managers', path: '/admin/managers', icon: '👔' });
        navItems.push({ name: 'Delivery Guys', path: '/admin/delivery', icon: '🛵' });
        navItems.push({ name: 'Parcels', path: '/admin/parcels', icon: '📬' });
        navItems.push({ name: 'Print Products', path: '/admin/print-products', icon: '🖨️' });
    } else if (admin?.role === 'PARCEL_MANAGER') {
        navItems = [
            { name: 'Dashboard', path: '/admin/dashboard', icon: '📊' },
            { name: 'Parcels', path: '/admin/parcels', icon: '📬' },
            { name: 'Delivery Guys', path: '/admin/delivery', icon: '🛵' },
            { name: 'Stores', path: '/admin/stores', icon: '🏪' }
        ];
    }

    return (
        <div className="flex h-[100dvh] w-full bg-gray-100 font-sans overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white shadow-xl flex flex-col fixed inset-y-0 left-0 z-10">
                <div className="p-6 border-b border-gray-100 bg-ud-primary text-white">
                    <h1 className="text-xl font-bold tracking-tight">Admin Panel</h1>
                    <div className="mt-2 text-sm opacity-90 truncate">
                        {admin?.storeName || 'Store'} <span className="text-xs bg-white/20 px-1 rounded ml-1">{admin?.storeCode}</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map(item => {
                        const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center p-3 rounded-lg transition-colors ${isActive
                                    ? 'bg-ud-primary/10 text-ud-primary font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <span className="mr-3 text-xl">{item.icon}</span>
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-100">
                    <div className="flex items-center mb-4 px-2">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-ud-primary font-bold mr-3">
                            {admin?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-sm overflow-hidden">
                            <p className="font-medium text-gray-900 truncate w-32" title={admin?.name}>{admin?.name}</p>
                            <p className="text-xs text-gray-500 truncate w-32">{admin?.phone}</p>
                        </div>
                    </div>
                    <RippleButton
                        onClick={logout}
                        className="w-full flex items-center justify-center p-2 text-red-600 hover:bg-red-50 rounded transition-colors text-sm font-medium border border-red-200"
                    >
                        LOGOUT
                    </RippleButton>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 ml-64 overflow-y-auto bg-gray-50 min-h-0 relative">
                <div className="max-w-7xl mx-auto p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
