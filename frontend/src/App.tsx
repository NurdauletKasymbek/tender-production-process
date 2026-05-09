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
