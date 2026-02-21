import UnitedDealsHome from './views/UnitedDealsHome';
import { AuthProvider } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { LocationProvider } from './context/LocationContext';
import { CategoryProvider } from './context/CategoryContext';
import { Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';

const ProductDetails = lazy(() => import('./views/ProductDetails'));
const DeliveryLogin = lazy(() => import('./components/delivery/DeliveryLogin'));
const DeliveryDashboard = lazy(() => import('./components/delivery/DeliveryDashboard'));
const AdminLogin = lazy(() => import('./components/admin/AdminLogin'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./components/admin/AdminProducts'));
const AdminOrders = lazy(() => import('./components/admin/AdminOrders'));
const AdminInventory = lazy(() => import('./components/admin/AdminInventory'));

function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <LocationProvider>
          <CategoryProvider>
          <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ud-primary"></div>
            </div>
          }>
            <Routes>
              <Route path="/" element={<UnitedDealsHome />} />
              <Route path="/product/:id" element={<ProductDetails />} />
              <Route path="/delivery/login" element={<DeliveryLogin />} />
              <Route path="/delivery/dashboard" element={<DeliveryDashboard />} />


              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="inventory" element={<AdminInventory />} />
                <Route index element={<AdminDashboard />} />
              </Route>

              <Route path="*" element={<UnitedDealsHome />} />
            </Routes>
          </Suspense>
          </CategoryProvider>
        </LocationProvider>
      </AdminAuthProvider>
    </AuthProvider>
  );
}

export default App;
