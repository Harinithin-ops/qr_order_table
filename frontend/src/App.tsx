import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Menu from './pages/Menu';
import Pay from './pages/Pay';
import Bill from './pages/Bill';
import TrackOrder from './pages/TrackOrder';
import Payment from './pages/Payment';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import AdminQR from './pages/AdminQR';
import AdminMenu from './pages/AdminMenu';
import BillMachine from './pages/BillMachine';
import AdminLayout from './components/dashboard/AdminLayout';
import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check');
        if (res.ok) {
          const data = await res.json();
          setIsAuthenticated(data.authenticated);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Activity className="animate-spin text-green-600" size={32} />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
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

        {/* Admin Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Dashboard/Admin Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/bill-machine" element={<BillMachine />} />
          <Route path="/dashboard/history" element={<History />} />
          <Route path="/admin/qr" element={<AdminQR />} />
          <Route path="/admin/menu" element={<AdminMenu />} />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
