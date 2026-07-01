import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MenuItemWithCategory, OrderWithItems } from '@/types';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { CartButton } from '@/components/menu/CartButton';
import { CartSheet } from '@/components/menu/CartSheet';
import { SmartSuggestions } from '@/components/menu/SmartSuggestions';
import { WaiterCallButton } from '@/components/menu/WaiterCallButton';
import { CartProvider } from '@/hooks/useCart';
import { useEventSource } from '@/hooks/useEventSource';
import { HOTEL_NAME, getStatusLabel } from '@/lib/utils';
import { CustomerUnavailabilityModal } from '@/components/menu/CustomerUnavailabilityModal';
import { UtensilsCrossed, Search, X, LogOut, Clock, CreditCard, ChefHat, CheckCircle2 } from 'lucide-react';


export default function MenuPage() {
  const { tableId = 'table-1' } = useParams<{ tableId: string }>();

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemWithCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initializingSession, setInitializingSession] = useState(true);
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Phone auth state
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');

  const [activeOrders, setActiveOrders] = useState<OrderWithItems[]>([]);
  const { lastEvent } = useEventSource('/api/events');

  const itemListRef = useRef<HTMLDivElement>(null);

  // ── Session initialization ──────────────────────────────────────────────
  useEffect(() => {
    const initializeSession = async () => {
      setInitializingSession(true);
      const rawSession = localStorage.getItem(`kh_customer_session_${tableId}`);
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          if (parsed && parsed.customerId && parsed.phone) {
            const res = await fetch('/api/sessions/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customerId: parsed.customerId, tableId })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.valid && data.session) {
                setCustomerId(data.session.customerId);
                setCustomerPhone(data.session.phone);
                setCustomerName(parsed.name || 'Guest');

                const ordersRes = await fetch(`/api/orders/active?tableId=${tableId}&customerId=${data.session.customerId}`);
                if (ordersRes.ok) {
                  const activeOrdersData = await ordersRes.json();
                  const dbOrderIds = activeOrdersData.map((o: any) => o.id);
                  let localOrderIds: string[] = [];
                  const rawLocal = sessionStorage.getItem(`kh_orders_${tableId}`);
                  if (rawLocal) {
                    try {
                      const parsedLocal = JSON.parse(rawLocal);
                      if (Array.isArray(parsedLocal)) localOrderIds = parsedLocal;
                    } catch {}
                  }
                  const combined = Array.from(new Set([...dbOrderIds, ...localOrderIds]));
                  setOrderIds(combined);
                  if (combined.length > 0) {
                    sessionStorage.setItem(`kh_orders_${tableId}`, JSON.stringify(combined));
                  }
                  setInitializingSession(false);
                  return;
                }
              }
            }
          }
        } catch (err) {
          console.error('Failed to initialize customer session:', err);
        }
      }

      localStorage.removeItem(`kh_customer_session_${tableId}`);
      setCustomerId(null);
      setCustomerPhone(null);
      setCustomerName(null);
      setOrderIds([]);
      sessionStorage.removeItem(`kh_orders_${tableId}`);
      setInitializingSession(false);
    };

    initializeSession();
  }, [tableId]);

  // ── Phone Sign-In Submission ────────────────────────────────────────────
  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput || phoneInput.trim().length < 10) {
      setSignInError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!nameInput || !nameInput.trim()) {
      setSignInError('Please enter your name.');
      return;
    }

    setSignInLoading(true);
    setSignInError('');

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: phoneInput.trim(), 
          name: nameInput.trim(), 
          tableId 
        })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(`kh_customer_session_${tableId}`, JSON.stringify({
          customerId: data.customerId,
          phone: data.phone,
          name: data.name,
        }));
        setCustomerPhone(data.phone);
        setCustomerName(data.name);
        setCustomerId(data.customerId);

        try {
          const ordersRes = await fetch(`/api/orders/active?tableId=${tableId}&customerId=${data.customerId}`);
          if (ordersRes.ok) {
            const activeOrdersData = await ordersRes.json();
            const dbOrderIds = activeOrdersData.map((o: any) => o.id);
            setOrderIds(dbOrderIds);
            if (dbOrderIds.length > 0) {
              sessionStorage.setItem(`kh_orders_${tableId}`, JSON.stringify(dbOrderIds));
            } else {
              sessionStorage.removeItem(`kh_orders_${tableId}`);
            }
          }
        } catch (err) {
          console.error('Failed to restore active orders after login:', err);
          setOrderIds([]);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setSignInError(errData.error || 'Failed to sign in. Please try again.');
      }
    } catch (err) {
      setSignInError('Network error. Please try again.');
    } finally {
      setSignInLoading(false);
    }
  };

  // ── Sign out ────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    localStorage.removeItem(`kh_customer_session_${tableId}`);
    sessionStorage.removeItem(`kh_orders_${tableId}`);
    setCustomerPhone(null);
    setCustomerName(null);
    setCustomerId(null);
    setOrderIds([]);
  };

  // ── Fetch Menu ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await fetch('/api/menu');
        const data = await res.json();

        setCategories(data.map((c: any) => ({ id: c.id, name: c.name })));
        if (data.length > 0) {
          setActiveCategory(prev => prev || data[0].id);
        }

        const allItems = data.flatMap((c: any) => 
          c.items.map((item: any) => ({
            ...item,
            category: { id: c.id, name: c.name }
          }))
        );
        setMenuItems(allItems);
      } catch (error) {
        console.error('Failed to load menu', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
    const interval = setInterval(fetchMenu, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchActiveOrders = useCallback(async () => {
    if (orderIds.length === 0) {
      setActiveOrders([]);
      return;
    }
    try {
      const fetched = await Promise.all(
        orderIds.map(async id => {
          const res = await fetch(`/api/orders/${id}`);
          return res.ok ? res.json() : null;
        })
      );
      setActiveOrders(fetched.filter((o): o is OrderWithItems => o !== null && o.status !== 'PAID'));
    } catch (e) {
      console.error(e);
    }
  }, [orderIds]);

  useEffect(() => { fetchActiveOrders(); }, [fetchActiveOrders]);

  useEffect(() => {
    if (lastEvent?.type === 'ORDER_UPDATE') {
      setTimeout(() => fetchActiveOrders(), 500);
    }
  }, [lastEvent, fetchActiveOrders]);

  const handleSelectCategory = (id: string) => {
    setActiveCategory(id);
    if (itemListRef.current) {
      itemListRef.current.scrollTo({ top: 0 });
    }
    window.scrollTo({ top: 0 });
  };

  const handleOrderPlaced = (newOrderId: string) => {
    setOrderIds(prev => {
      const updated = prev.includes(newOrderId) ? prev : [...prev, newOrderId];
      sessionStorage.setItem(`kh_orders_${tableId}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleOrderCompleted = (completedOrderId: string) => {
    setOrderIds(prev => {
      const updated = prev.filter(id => id !== completedOrderId);
      sessionStorage.setItem(`kh_orders_${tableId}`, JSON.stringify(updated));
      return updated;
    });
  };

  const activeItems = menuItems.filter((item) => item.categoryId === activeCategory);
  const activeCategory_ = categories.find((c) => c.id === activeCategory);
  const otherCategories = categories.filter((c) => c.id !== activeCategory);

  if (loading || initializingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <UtensilsCrossed size={40} className="text-green-600 animate-pulse mb-4" />
        <p className="text-gray-500 font-medium">Loading menu...</p>
      </div>
    );
  }

  // ── Phone Sign-In Screen ───────────────────────────────────────────────
  if (!customerPhone) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-sm relative z-10 animate-slide-up">
          {/* Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
            {/* Logo */}
            <div className="mb-6">
              <img src="/logo.png" alt={HOTEL_NAME} className="h-24 w-auto mx-auto drop-shadow-lg" />
            </div>

            <h1 className="font-serif font-bold text-2xl text-white mb-1">{HOTEL_NAME}</h1>
            <p className="text-white/50 text-sm mb-1">Table <span className="font-bold text-amber-400">{tableId.replace('table-', '')}</span></p>
            <p className="text-white/40 text-xs mb-8">Enter your details to view the menu &amp; order</p>

            <form onSubmit={handlePhoneSignIn} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wider">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm transition placeholder:text-white/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5 uppercase tracking-wider">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm transition placeholder:text-white/30"
                  required
                />
              </div>

              {signInError && (
                <p className="text-red-400 text-xs mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {signInError}
                </p>
              )}

              <button
                type="submit"
                disabled={signInLoading}
                className="w-full py-3 mt-4 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-amber-500/10 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {signInLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Enter Menu</span>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-white/30 text-[10px] leading-relaxed">
                Your mobile number is used only to track your order at this table.<br />
                We do not store or share your personal information.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <CartProvider tableId={tableId}>
      <main className="min-h-screen bg-gray-50 pb-28 max-w-md mx-auto shadow-2xl relative overflow-x-hidden">
        {/* Header */}
        <header className="bg-white px-4 pt-5 pb-3 flex flex-col items-center justify-center text-center shadow-sm relative z-10">
          <img src="/logo.png" alt={HOTEL_NAME} className="h-24 w-auto drop-shadow-sm mb-1" />
          <div className="flex flex-col items-center gap-1">
            <p className="inline-flex items-center gap-1.5 text-gray-500 text-sm font-semibold bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
              Table <span className="text-green-600 font-bold">{tableId.replace('table-', '')}</span>
            </p>
            {customerPhone && (
              <div className="flex items-center justify-center gap-2 mt-1.5 bg-gray-50 border border-gray-150 px-2.5 py-1.5 rounded-xl">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <span className="text-[8px] font-bold text-blue-600">{(customerName || customerPhone)[0].toUpperCase()}</span>
                </div>
                <span className="font-extrabold text-gray-800 text-[11px] tracking-wide truncate max-w-[140px]">
                  {customerName}
                </span>
                <button
                  onClick={handleSignOut}
                  className="p-0.5 rounded text-gray-400 hover:text-red-500 transition ml-0.5"
                  title="Sign out"
                >
                  <LogOut size={10} />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Category Sticky Nav */}
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
        />

        <div className="p-3" ref={itemListRef}>
          {/* Active Order Banners + unified Pay All when >1 order */}
          {orderIds.length > 0 && (
            <div className="space-y-2 mb-2">
              {orderIds.map((oid, idx) => (
                <ActiveOrderBanner
                  key={oid}
                  orderId={oid}
                  orderIndex={idx + 1}
                  totalOrders={orderIds.length}
                  tableId={tableId}
                  onCompleted={() => handleOrderCompleted(oid)}
                />
              ))}

            </div>
          )}

          {/* Search Bar */}
          <div className="relative mb-4 mt-1 animate-slide-up">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search dishes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-xs shadow-sm transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-lg hover:bg-gray-100 transition"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {searchTerm ? (
            // Search Results
            <div className="mt-2 animate-slide-up">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-bold text-green-600 uppercase tracking-widest">
                  Search Results
                </span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                  {menuItems.filter(item => 
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (item.description || '').toLowerCase().includes(searchTerm.toLowerCase())
                  ).length} found
                </span>
              </div>
              {(() => {
                const results = menuItems.filter(item => 
                  item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (item.description || '').toLowerCase().includes(searchTerm.toLowerCase())
                );
                if (results.length === 0) {
                  return (
                    <div className="bg-white rounded-xl p-10 text-center border border-dashed border-gray-300">
                      <p className="text-gray-400 text-sm">No dishes match "{searchTerm}"</p>
                    </div>
                  );
                }
                return (
                  <div className="bg-white rounded-xl shadow-sm border border-green-50 px-3">
                    {results.map((item) => (
                      <MenuItemCard key={item.id} item={item} />
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : (
            // Normal Categorized View
            <>
              {/* Smart Suggestions */}
              <SmartSuggestions menuItems={menuItems} />

              {/* Active Category — shown at top, full list */}
              {activeCategory_ && activeItems.length > 0 && (
                <div className="mt-2 animate-slide-up">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-xs font-bold text-green-600 uppercase tracking-widest">
                      {activeCategory_.name}
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
                      {activeItems.length} items
                    </span>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-green-100 px-3">
                    {activeItems.map((item) => (
                      <MenuItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              )}

              {/* Other Categories — collapsed/listed below */}
              {otherCategories.map((category) => {
                const catItems = menuItems.filter((item) => item.categoryId === category.id);
                if (catItems.length === 0) return null;
                return (
                  <OtherCategorySection
                    key={category.id}
                    category={category}
                    items={catItems}
                    onSelect={() => handleSelectCategory(category.id)}
                  />
                );
              })}
            </>
          )}
        </div>

        <WaiterCallButton tableId={tableId} />
        <CartButton onClick={() => setIsCartOpen(true)} />
        <CartSheet
          tableId={tableId}
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          onOrderPlaced={handleOrderPlaced}
          menuItems={menuItems}
          customerId={customerId}
        />
        {activeOrders.length > 0 && menuItems.length > 0 && (
          <CustomerUnavailabilityModal
            activeOrders={activeOrders}
            menuItems={menuItems}
            onRefresh={fetchActiveOrders}
          />
        )}
      </main>
    </CartProvider>
  );
}

/** Minimal sticky banner shown at top of menu listing when an order is active */
function ActiveOrderBanner({
  orderId,
  orderIndex,
  totalOrders,
  tableId,
  onCompleted,
}: {
  orderId: string;
  orderIndex?: number;
  totalOrders?: number;
  tableId: string;
  onCompleted?: () => void;
}) {
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const { lastEvent } = useEventSource('/api/events');

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
        // Auto-clear after paid
        if (data.status === 'PAID' && onCompleted) {
          const t = setTimeout(() => onCompleted(), 3000);
          return () => clearTimeout(t);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [orderId, onCompleted]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  useEffect(() => {
    if (lastEvent?.type !== 'ORDER_UPDATE') return;
    const payload = lastEvent.data as { orderId?: string };
    if (payload.orderId !== orderId) return;
    setTimeout(() => fetchOrder(), 500);
  }, [lastEvent, orderId, fetchOrder]);

  if (!order || order.status === 'PAID') return null;

  const statusIcon = () => {
    switch (order.status) {
      case 'PLACED': return <Clock size={14} className="animate-pulse" />;
      case 'PREPARING': return <ChefHat size={14} />;
      case 'READY': case 'SERVED': return <CheckCircle2 size={14} className="text-green-500" />;
      case 'PENDING': return <CreditCard size={14} className="text-red-500" />;
      default: return <Clock size={14} />;
    }
  };

  const bannerColor = {
    PLACED: 'border-yellow-200 bg-yellow-50',
    ACCEPTED: 'border-blue-200 bg-blue-50',
    PREPARING: 'border-green-200 bg-green-50',
    READY: 'border-green-300 bg-green-100',
    SERVED: 'border-purple-200 bg-purple-50',
    PENDING: 'border-red-200 bg-red-50',
  }[order.status] || 'border-gray-200 bg-gray-50';

  const showIndex = totalOrders && totalOrders > 1 && orderIndex;

  return (
    <div className={`rounded-xl border-2 ${bannerColor} p-3 flex items-center gap-3 shadow-sm animate-slide-up`}>
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {statusIcon()}
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
            {showIndex ? `Order #${orderIndex}` : 'Active Order'}
          </p>
          <p className="text-xs font-extrabold text-gray-800 truncate">{getStatusLabel(order.status)}</p>
          {order.items.length > 0 && (
            <p className="text-[10px] text-gray-400 truncate mt-0.5">
              {order.items.slice(0, 2).map(i => i.menuItem.name).join(', ')}
              {order.items.length > 2 ? ` +${order.items.length - 2} more` : ''}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          to={`/track/${orderId}`}
          className="text-[10px] font-bold bg-white border border-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition active:scale-95 shadow-sm"
        >
          Track
        </Link>
        {(order.status === 'PENDING' || order.bill) && (
          <Link
            to={`/checkout/${tableId}`}
            className="text-[10px] font-bold bg-red-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-700 transition active:scale-95 shadow-sm"
          >
            Pay Bill
          </Link>
        )}
      </div>
    </div>
  );
}

/** Collapsed category row — shows name + item count + tap-to-expand */
function OtherCategorySection({
  category,
  items,
  onSelect,
}: {
  category: { id: string; name: string };
  items: MenuItemWithCategory[];
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
      {/* Header — always visible, tap to toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:bg-gray-50 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{category.name}</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">
            {items.length} items
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-lg hover:bg-green-100 active:scale-95 transition-transform"
          >
            View All
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded items */}
      {expanded && (
        <div className="bg-white border border-gray-100 border-t-0 rounded-b-xl px-3 shadow-sm">
          {items.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
