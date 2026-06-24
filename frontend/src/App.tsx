import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { OrdersListPage } from './pages/OrdersListPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { NewOrderPage } from './pages/NewOrderPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { InventoryListPage } from './pages/InventoryListPage';
import { InventoryDetailPage } from './pages/InventoryDetailPage';
import { InventoryNewPage } from './pages/InventoryNewPage';
import { InventoryEditPage } from './pages/InventoryEditPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { AdminProductEditPage } from './pages/AdminProductEditPage';
import { AdminInquiriesPage } from './pages/AdminInquiriesPage';
import { Layout } from './components/Layout';
import { initTelegram } from './utils/telegram';
import { Spinner } from './components/Spinner';

function ProtectedShell() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Жүктелуде..." />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/orders" element={<OrdersListPage />} />
        <Route path="/orders/new" element={<NewOrderPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/inventory" element={<InventoryListPage />} />
        <Route path="/inventory/new" element={<InventoryNewPage />} />
        <Route path="/inventory/:id" element={<InventoryDetailPage />} />
        <Route path="/inventory/:id/edit" element={<InventoryEditPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/products" element={<AdminProductsPage />} />
        <Route path="/admin/products/new" element={<AdminProductEditPage />} />
        <Route path="/admin/products/:id" element={<AdminProductEditPage />} />
        <Route path="/admin/inquiries" element={<AdminInquiriesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Публичный каталог — логинсіз қолжетімді */}
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/catalog/:slug" element={<ProductDetailPage />} />
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedShell />} />
    </Routes>
  );
}

export default function App() {
  useEffect(() => { initTelegram(); }, []);
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
