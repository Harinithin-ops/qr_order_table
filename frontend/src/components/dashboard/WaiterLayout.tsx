import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Utensils, LogOut,
  BookOpen, User, ClipboardList, X, Menu,
} from 'lucide-react';
import { HOTEL_NAME } from '@/lib/utils';
import { useEventSource } from '@/hooks/useEventSource';

const NAV_ITEMS = [
  { name: 'Orders',  path: '/waiter/orders',    icon: LayoutDashboard, mobileLabel: 'Orders'  },
  { name: 'Queue',   path: '/waiter/queue',      icon: ClipboardList,   mobileLabel: 'Queue'   },
  { name: 'Menu',    path: '/waiter/menu',       icon: BookOpen,        mobileLabel: 'Menu'    },
  { name: 'Profile', path: '/waiter/profile',    icon: User,            mobileLabel: 'Profile' },
];

export default function WaiterLayout() {
  const [ordersCount, setOrdersCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [waiterUsername, setWaiterUsername] = useState('Waiter');
  const { lastEvent } = useEventSource('/api/events');
  const location = useLocation();
  const navigate = useNavigate();

  const fetchActiveCount = async () => {
    try {
      const res = await fetch('/api/orders', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const activeOrders = data.filter((o: any) => o.status !== 'PAID' && o.status !== 'CANCELLED');
        setOrdersCount(
          activeOrders.filter((o: any) => ['PLACED', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status)).length
        );
        setQueueCount(
          activeOrders.filter((o: any) => ['SERVED', 'PENDING'].includes(o.status)).length
        );
      }
    } catch {}
  };

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/auth/check', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setWaiterUsername(data.username || 'Waiter');
      }
    } catch {}
  };

  useEffect(() => {
    fetchActiveCount();
    fetchUserRole();
  }, []);

  useEffect(() => {
    if (!lastEvent) return;
    if (['NEW_ORDER', 'ORDER_UPDATE'].includes(lastEvent.type)) void fetchActiveCount();
  }, [lastEvent]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    /**
     * Root wrapper:
     *   Desktop (md+): flex-row — sidebar (fixed w-64) + scrollable content column
     *   Mobile (<md):  flex-col — sticky top bar + scrollable content + fixed bottom tabs
     *
     * IMPORTANT: We use a SINGLE <Outlet /> so React Router always renders the
     * matched route. We position it with padding/margin to avoid overlap with bars.
     */
    <div className="min-h-screen bg-gray-50">

      {/* ═══════════════════════════════════════════════════════════
          DESKTOP SIDEBAR  (visible only on md+, fixed on the left)
      ════════════════════════════════════════════════════════════ */}
      <aside className="
        hidden md:flex flex-col
        fixed left-0 top-0 bottom-0 w-64
        bg-amber-600 z-30 shadow-xl
      ">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-amber-700">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
            <Utensils size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm leading-tight">{HOTEL_NAME}</h2>
            <p className="text-[10px] text-amber-200 font-medium">Waiter Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all ${
                  active
                    ? 'bg-white/20 border border-white/25 text-white shadow-sm'
                    : 'hover:bg-white/10 text-amber-100 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={17} className={active ? 'text-white' : 'text-amber-200'} />
                  <span>{item.name}</span>
                </div>
                {item.path === '/waiter/orders' && ordersCount > 0 && (
                  <span className="bg-white text-amber-600 text-xs font-black px-2 py-0.5 rounded-full">
                    {ordersCount}
                  </span>
                )}
                {item.path === '/waiter/queue' && queueCount > 0 && (
                  <span className="bg-white text-amber-600 text-xs font-black px-2 py-0.5 rounded-full">
                    {queueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="p-3 border-t border-amber-700 space-y-2">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/10 border border-white/10">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0">
              {waiterUsername.slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate capitalize">{waiterUsername}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-amber-200">Live</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 hover:bg-red-500/30 border border-white/10 hover:border-red-400/30 text-amber-100 hover:text-white text-sm font-medium transition"
          >
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════
          MOBILE TOP BAR  (visible only below md, fixed at top)
      ════════════════════════════════════════════════════════════ */}
      <header className="
        md:hidden
        fixed top-0 left-0 right-0 z-40
        bg-amber-500 text-white
        flex items-center justify-between px-4 py-3
        shadow-md
      ">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Utensils size={15} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">{HOTEL_NAME}</p>
            <p className="text-[10px] text-amber-100">Waiter Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(ordersCount + queueCount) > 0 && (
            <span className="bg-white text-amber-600 text-xs font-black px-2 py-0.5 rounded-full">
              {ordersCount + queueCount} active
            </span>
          )}
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════
          MOBILE DRAWER OVERLAY + PANEL
      ════════════════════════════════════════════════════════════ */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <div className={`
        md:hidden fixed top-0 right-0 bottom-0 w-72
        bg-amber-600 z-50 flex flex-col shadow-2xl
        transition-transform duration-300
        ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-amber-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Utensils size={16} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm">{HOTEL_NAME}</p>
              <p className="text-[10px] text-amber-200">@{waiterUsername}</p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-4 py-3.5 rounded-xl font-medium text-sm transition-all ${
                  active
                    ? 'bg-white/20 border border-white/25 text-white shadow-sm'
                    : 'hover:bg-white/10 text-amber-100 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={active ? 'text-white' : 'text-amber-200'} />
                  <span>{item.name}</span>
                </div>
                {item.path === '/waiter/orders' && ordersCount > 0 && (
                  <span className="bg-white text-amber-600 text-xs font-black px-2 py-0.5 rounded-full">
                    {ordersCount}
                  </span>
                )}
                {item.path === '/waiter/queue' && queueCount > 0 && (
                  <span className="bg-white text-amber-600 text-xs font-black px-2 py-0.5 rounded-full">
                    {queueCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-amber-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-red-500/30 border border-white/10 text-amber-100 hover:text-white text-sm font-semibold transition"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT  ←  SINGLE <Outlet /> for all screen sizes
          • Desktop: offset left by sidebar width (ml-64)
          • Mobile:  padded top (top bar) + padded bottom (tab bar)
      ════════════════════════════════════════════════════════════ */}
      <main className="
        md:ml-64
        pt-[56px] md:pt-0
        pb-[64px] md:pb-0
        min-h-screen
        overflow-x-hidden
      ">
        <Outlet />
      </main>

      {/* ═══════════════════════════════════════════════════════════
          MOBILE BOTTOM TAB BAR  (visible only below md)
      ════════════════════════════════════════════════════════════ */}
      <nav className="
        md:hidden
        fixed bottom-0 left-0 right-0 z-40
        bg-white border-t border-gray-200
        shadow-[0_-2px_12px_rgba(0,0,0,0.08)]
      ">
        <div className="grid grid-cols-4 h-16">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
                  active ? 'text-amber-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {/* Active top accent bar */}
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-amber-500 rounded-b-full" />
                )}
                <div className={`relative p-1.5 rounded-xl transition-all ${active ? 'bg-amber-50' : ''}`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  {/* Order badge */}
                  {item.path === '/waiter/orders' && ordersCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {ordersCount > 9 ? '9+' : ordersCount}
                    </span>
                  )}
                  {/* Queue badge */}
                  {item.path === '/waiter/queue' && queueCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {queueCount > 9 ? '9+' : queueCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold leading-none ${active ? 'text-amber-600' : 'text-gray-400'}`}>
                  {item.mobileLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
