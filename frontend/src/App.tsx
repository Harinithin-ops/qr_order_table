import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import WaiterLogin from './pages/WaiterLogin';
import WaiterOrders from './pages/WaiterOrders';
import WaiterCompleted from './pages/WaiterCompleted';
import WaiterMenu from './pages/WaiterMenu';
import WaiterProfile from './pages/WaiterProfile';
import WaiterQueue from './pages/WaiterQueue';
import Menu from './pages/Menu';
import Pay from './pages/Pay';
import Bill from './pages/Bill';
import TrackOrder from './pages/TrackOrder';
import Payment from './pages/Payment';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import AdminQR from './pages/AdminQR';
import AdminMenu from './pages/AdminMenu';
import AdminWaiters from './pages/AdminWaiters';
import BillMachine from './pages/BillMachine';
import AdminLayout from './components/dashboard/AdminLayout';
import WaiterLayout from './components/dashboard/WaiterLayout';
import Checkout from './pages/Checkout';
import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [status, setStatus] = useState<'loading' | 'waiter' | 'admin' | 'unauthenticated'>('loading');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.authenticated) {
            setStatus('unauthenticated');
          } else if (data.username === 'admin') {
            // Admin is logged in — redirect them away from the waiter portal
            setStatus('admin');
          } else {
            setStatus('waiter');
          }
        } else {
          setStatus('unauthenticated');
        }
      } catch (err) {
        setStatus('unauthenticated');
      }
    };
    checkAuth();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <Activity className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (status === 'unauthenticated') return <Navigate to="/waiter-login" replace />;
  if (status === 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

interface AdminRouteProps {
  children: React.ReactNode;
}

function AdminRoute({ children }: AdminRouteProps) {
  const [status, setStatus] = useState<'loading' | 'admin' | 'waiter' | 'unauthenticated'>('loading');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (!data.authenticated) {
            setStatus('unauthenticated');
          } else if (data.username === 'admin') {
            setStatus('admin');
          } else {
            // A waiter is logged in — redirect them to their own dashboard
            setStatus('waiter');
          }
        } else {
          setStatus('unauthenticated');
        }
      } catch (err) {
        setStatus('unauthenticated');
      }
    };
    checkAuth();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Activity className="animate-spin text-green-600" size={32} />
      </div>
    );
  }

  if (status === 'unauthenticated') return <Navigate to="/login" replace />;
  if (status === 'waiter') return <Navigate to="/waiter/orders" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Customer Facing Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/menu/:tableId" element={<Menu />} />
        <Route path="/pay/:billId" element={<Pay />} />
        <Route path="/bill/:id" element={<Bill />} />
        <Route path="/track/:orderId" element={<TrackOrder />} />
        <Route path="/payment/:orderId" element={<Payment />} />
        <Route path="/checkout/:tableId" element={<Checkout />} />

        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/waiter-login" element={<WaiterLogin />} />

        {/* ── Waiter Routes (amber-themed WaiterLayout) ───────────────── */}
        <Route
          element={
            <ProtectedRoute>
              <WaiterLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/waiter" element={<Navigate to="/waiter/orders" replace />} />
          <Route path="/waiter/orders" element={<WaiterOrders />} />
          <Route path="/waiter/queue" element={<WaiterQueue />} />
          <Route path="/waiter/completed" element={<WaiterCompleted />} />
          <Route path="/waiter/menu" element={<WaiterMenu />} />
          <Route path="/waiter/profile" element={<WaiterProfile />} />
        </Route>

        {/* ── Admin Routes (dark AdminLayout) ─────────────────────────── */}
        <Route
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/bill-machine" element={<BillMachine />} />
          <Route path="/dashboard/history" element={<History />} />
          <Route path="/admin/qr" element={<AdminQR />} />
          <Route path="/admin/menu" element={<AdminMenu />} />
          <Route path="/admin/waiters" element={<AdminWaiters />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
