import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, History, QrCode, LogOut, Menu, X, Utensils, Printer } from 'lucide-react';
import { HOTEL_NAME } from '@/lib/utils';
import { useEventSource } from '@/hooks/useEventSource';

export default function AdminLayout() {
  const [activeCount, setActiveCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string>('admin');
  const { lastEvent } = useEventSource('/api/events');
  const location = useLocation();
  const navigate = useNavigate();

  const fetchActiveCount = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        const active = data.filter((o: any) => o.status !== 'PAID');
        setActiveCount(active.length);
      }
    } catch (e) {
      console.error('Failed to fetch active count:', e);
    }
  };

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/auth/check');
      if (res.ok) {
        const data = await res.json();
        setUserRole(data.username || 'admin');
      }
    } catch (e) {
      console.error('Failed to fetch user role:', e);
    }
  };

  useEffect(() => {
    fetchActiveCount();
    fetchUserRole();
  }, []);

  useEffect(() => {
    // If a waiter (server role) somehow reaches admin routes, redirect them to the waiter panel
    if (userRole === 'server') {
      navigate('/waiter', { replace: true });
    }
  }, [userRole, navigate]);

  useEffect(() => {
    if (!lastEvent) return;
    if (['NEW_ORDER', 'ORDER_UPDATE'].includes(lastEvent.type)) {
      void fetchActiveCount();
    }
  }, [lastEvent]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        navigate('/login');
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const navItems = [
    {
      name: 'Live Orders',
      path: '/dashboard',
      icon: LayoutDashboard,
      badge: activeCount > 0 ? activeCount : null,
      badgeColor: 'bg-green-500 text-white',
    },
    {
      name: 'Bill Machine',
      path: '/dashboard/bill-machine',
      icon: Printer,
      badge: null,
    },
    ...(userRole === 'admin' ? [
      {
        name: 'Billing History',
        path: '/dashboard/history',
        icon: History,
        badge: null,
      },
      {
        name: 'Manage Menu',
        path: '/admin/menu',
        icon: Utensils,
        badge: null,
      },
      {
        name: 'Table QR Codes',
        path: '/admin/qr',
        icon: QrCode,
        badge: null,
      },
    ] : []),
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Top Navbar */}
      <header className="md:hidden bg-gray-950 text-white px-4 py-3 flex items-center justify-between border-b border-gray-800 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
            <Utensils size={18} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-wide block">{HOTEL_NAME}</span>
            <span className="text-[10px] text-gray-400 block -mt-0.5">Admin Management</span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 transition"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile Sidebar overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-200"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar (Desktop and Mobile drawer) */}
      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 w-64 md:w-72 bg-gray-950 text-gray-300 border-r border-gray-900 flex flex-col z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${mobileMenuOpen ? 'h-screen' : 'h-auto md:h-screen'}`}
      >
        {/* Brand Logo Header */}
        <div className="hidden md:flex items-center gap-3 px-6 py-6 border-b border-gray-900">
          <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/30">
            <Utensils size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base tracking-wide leading-tight">{HOTEL_NAME}</h2>
            <p className="text-[11px] text-gray-500 font-medium">Admin Dashboard</p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                className={`flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-red-600/10 border border-red-500/20 text-red-500 shadow-sm shadow-red-500/5'
                    : 'hover:bg-gray-900 hover:text-gray-100 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-red-500' : 'text-gray-400'} />
                  <span>{item.name}</span>
                </div>
                {item.badge != null && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.badgeColor || 'bg-gray-800 text-gray-400'}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer/Logout */}
        <div className="p-4 border-t border-gray-900 bg-gray-950">
          <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-gray-900/40 border border-gray-900 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-xs text-red-500 uppercase">
                {userRole === 'admin' ? 'AD' : 'WT'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-200 truncate">
                  {userRole === 'admin' ? 'Administrator' : 'Waiter'}
                </p>
                <p className="text-[10px] text-gray-500 truncate">
                  {userRole === 'admin' ? 'Super Admin' : 'Waiter Staff'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-900/60 hover:bg-red-950/20 hover:text-red-400 border border-gray-900 hover:border-red-900/30 font-medium text-sm transition-all duration-150 text-gray-400"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
