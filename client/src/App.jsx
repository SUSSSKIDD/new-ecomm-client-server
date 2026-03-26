import UnitedDealsHome from './views/UnitedDealsHome';
import { AuthProvider } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { LocationProvider } from './context/LocationContext';
import { CartProvider } from './context/CartContext';
import { CategoryProvider } from './context/CategoryContext';
import ErrorBoundary from './components/ErrorBoundary';
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
const AdminLedger = lazy(() => import('./components/admin/AdminLedger'));
const AdminStores = lazy(() => import('./components/admin/AdminStores'));
const AdminManagers = lazy(() => import('./components/admin/AdminManagers'));
const AdminDelivery = lazy(() => import('./components/admin/AdminDelivery'));
const AdminParcelOrders = lazy(() => import('./components/admin/AdminParcelOrders'));
const AdminSubcategories = lazy(() => import('./components/admin/AdminSubcategories'));
const AdminSubcategoryPhoto = lazy(() => import('./components/admin/AdminSubcategoryPhoto'));
const AdminPrintProducts = lazy(() => import('./components/admin/AdminPrintProducts'));
const LegalPage = lazy(() => import('./views/LegalPage'));

function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <LocationProvider>
          <CartProvider>
            <CategoryProvider>
              <ErrorBoundary>
                <Suspense fallback={
                  <div className="h-[100dvh] w-full flex flex-col overflow-hidden overscroll-none flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ud-primary"></div>
                  </div>
                }>
                  <Routes>
                    <Route path="/" element={<UnitedDealsHome />} />
                    <Route path="/product/:id" element={<ProductDetails />} />
                    <Route path="/legal" element={<LegalPage />} />
                    <Route path="/delivery/login" element={<DeliveryLogin />} />
                    <Route path="/delivery/dashboard" element={<DeliveryDashboard />} />


                    {/* Admin Routes */}
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="products" element={<AdminProducts />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="inventory" element={<AdminInventory />} />
                      <Route path="ledger" element={<AdminLedger />} />
                      <Route path="stores" element={<AdminStores />} />
                      <Route path="managers" element={<AdminManagers />} />
                      <Route path="delivery" element={<AdminDelivery />} />
                      <Route path="parcels" element={<AdminParcelOrders />} />
                      <Route path="subcategories" element={<AdminSubcategories />} />
                      <Route path="subcategory-photo" element={<AdminSubcategoryPhoto />} />
                      <Route path="print-products" element={<AdminPrintProducts />} />
                      <Route index element={<AdminDashboard />} />
                    </Route>

                    <Route path="*" element={<UnitedDealsHome />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </CategoryProvider>
          </CartProvider>
        </LocationProvider>
      </AdminAuthProvider>
    </AuthProvider>
  );
}

export default App;
