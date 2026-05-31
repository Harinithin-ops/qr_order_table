import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CheckCircle2, Menu, X, Utensils, LogOut, BookOpen, User } from 'lucide-react';
import { HOTEL_NAME } from '@/lib/utils';
import { useEventSource } from '@/hooks/useEventSource';

export default function WaiterLayout() {
  const [activeCount, setActiveCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [waiterUsername, setWaiterUsername] = useState<string>('Waiter');
  const { lastEvent } = useEventSource('/api/events');
  const location = useLocation();
  const navigate = useNavigate();

  const fetchActiveCount = async () => {
    try {
      const res = await fetch('/api/orders', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const active = data.filter((o: any) => o.status !== 'PAID' && o.status !== 'CANCELLED');
        setActiveCount(active.length);
      }
    } catch (e) {
      console.error('Failed to fetch active count:', e);
    }
  };

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/auth/check', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setWaiterUsername(data.username || 'Waiter');
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
    if (!lastEvent) return;
    if (['NEW_ORDER', 'ORDER_UPDATE'].includes(lastEvent.type)) {
      void fetchActiveCount();
    }
  }, [lastEvent]);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) navigate('/');
    } catch {
      navigate('/');
    }
  };

  const navItems = [
    {
      name: 'Live Orders',
      path: '/waiter/orders',
      icon: LayoutDashboard,
      badge: activeCount > 0 ? activeCount : null,
      badgeColor: 'bg-amber-500 text-white',
      badgeTitle: 'Active orders',
    },
    {
      name: 'Completed Orders',
      path: '/waiter/completed',
      icon: CheckCircle2,
      badge: null,
    },
    {
      name: 'Manage Menu',
      path: '/waiter/menu',
      icon: BookOpen,
      badge: null,
    },
    {
      name: 'My Profile',
      path: '/waiter/profile',
      icon: User,
      badge: null,
    },
  ];

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col md:flex-row">
      {/* Mobile Top Navbar */}
      <header className="md:hidden bg-amber-500 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Utensils size={18} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-wide block">{HOTEL_NAME}</span>
            <span className="text-[10px] text-amber-100 block -mt-0.5">Waiter Dashboard</span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 w-64 md:w-72 bg-amber-600 text-amber-100 border-r border-amber-700 flex flex-col z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } ${mobileMenuOpen ? 'h-screen' : 'h-auto md:h-screen'}`}
      >
        {/* Brand Header */}
        <div className="hidden md:flex items-center gap-3 px-6 py-6 border-b border-amber-700">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-lg">
            <Utensils size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-base tracking-wide leading-tight">{HOTEL_NAME}</h2>
            <p className="text-[11px] text-amber-200 font-medium">Waiter Panel</p>
          </div>
        </div>


        {/* Nav Links */}
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
                    ? 'bg-white/20 border border-white/30 text-white shadow-sm'
                    : 'hover:bg-white/10 hover:text-white border border-transparent text-amber-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-white' : 'text-amber-200'} />
                  <span>{item.name}</span>
                </div>
                {item.badge != null && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="p-4 border-t border-amber-700 bg-amber-700/30">
          <div className="flex items-center justify-between px-3 py-3 rounded-xl bg-white/10 border border-white/10 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 border border-white/20 flex items-center justify-center font-bold text-xs text-white uppercase">
                {waiterUsername.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate capitalize">{waiterUsername}</p>
                <p className="text-[10px] text-amber-200 truncate">Waiter Staff</p>
              </div>
            </div>
            <div className="flex items-center gap-1 border border-green-400/20 bg-green-400/10 px-1.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] text-amber-200 font-bold uppercase tracking-wider">Live</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-red-600/40 hover:text-white border border-white/10 hover:border-red-400/30 font-medium text-sm transition-all duration-150 text-amber-100"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
