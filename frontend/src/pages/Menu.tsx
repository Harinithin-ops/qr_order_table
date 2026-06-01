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
import { UtensilsCrossed, Search, X, User, Edit2, Clock, CreditCard, ChefHat, CheckCircle2, ShoppingBag } from 'lucide-react';

export default function MenuPage() {
  const { tableId = 'table-1' } = useParams<{ tableId: string }>();

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemWithCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Track MULTIPLE concurrent orders (e.g. first round + second round)
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [inputName, setInputName] = useState('');

  useEffect(() => {
    const savedName = localStorage.getItem('kh_customer_name');
    if (savedName) {
      setCustomerName(savedName);
    }
  }, []);

  // Ref to scroll the item list back to top on category switch
  const itemListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Support array of order IDs stored as JSON for multiple concurrent orders
      const raw = sessionStorage.getItem(`kh_orders_${tableId}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setOrderIds(parsed);
        } catch {
          // Legacy single-id fallback
          setOrderIds([raw]);
        }
      } else {
        // Also try legacy single-order key for backward compat
        const legacySingle = sessionStorage.getItem(`kh_order_${tableId}`);
        if (legacySingle) setOrderIds([legacySingle]);
      }
    }

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

    return () => {
      clearInterval(interval);
    };
  }, [tableId]);

  const handleSelectCategory = (id: string) => {
    setActiveCategory(id);
    // Instantly scroll item list back to top
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

  // Remove a specific completed order from the list
  const handleOrderCompleted = (completedOrderId: string) => {
    setOrderIds(prev => {
      const updated = prev.filter(id => id !== completedOrderId);
      sessionStorage.setItem(`kh_orders_${tableId}`, JSON.stringify(updated));
      return updated;
    });
  };

  // Items for the active category shown first, rest grouped below
  const activeItems = menuItems.filter((item) => item.categoryId === activeCategory);
  const activeCategory_ = categories.find((c) => c.id === activeCategory);
  const otherCategories = categories.filter((c) => c.id !== activeCategory);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <UtensilsCrossed size={40} className="text-green-600 animate-pulse mb-4" />
        <p className="text-gray-500 font-medium">Loading menu...</p>
      </div>
    );
  }

  if (!customerName && !loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4 max-w-md mx-auto shadow-2xl relative overflow-hidden">
        {/* Decorative background blur blobs */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-red-100 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-green-100 rounded-full blur-3xl opacity-50"></div>

        <div className="w-full bg-white rounded-2xl p-6 shadow-xl border border-gray-100 relative z-10 text-center animate-slide-up">
          <img src="/logo.png" alt={HOTEL_NAME} className="h-28 w-auto mx-auto drop-shadow-sm mb-4" />
          
          <h2 className="font-serif font-bold text-2xl text-gray-900 mb-1">Welcome to {HOTEL_NAME}</h2>
          <p className="text-xs text-gray-500 mb-6">Start ordering at Table <span className="font-bold text-green-600">{tableId.replace('table-', '')}</span></p>

          <form onSubmit={(e) => {
            e.preventDefault();
            if (inputName.trim()) {
              localStorage.setItem('kh_customer_name', inputName.trim());
              setCustomerName(inputName.trim());
            }
          }} className="space-y-4 text-left">
            <div>
              <label htmlFor="customer-name" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Enter your name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  id="customer-name"
                  type="text"
                  placeholder="e.g. John Doe"
                  required
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm transition"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-semibold rounded-xl text-sm shadow-md shadow-red-600/10 transition-all flex items-center justify-center gap-2"
            >
              <span>Explore Menu</span> &rarr;
            </button>
          </form>
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
            {customerName && (
              <div className="flex items-center justify-center gap-1 text-[11px] text-gray-500 mt-1.5">
                <span>Welcome, </span>
                <span className="font-bold text-gray-800">{customerName}</span>
                <button
                  onClick={() => {
                    const newName = prompt('Update your name:', customerName);
                    if (newName && newName.trim()) {
                      localStorage.setItem('kh_customer_name', newName.trim());
                      setCustomerName(newName.trim());
                    }
                  }}
                  className="p-0.5 rounded text-gray-400 hover:text-red-500 transition"
                  title="Edit Name"
                >
                  <Edit2 size={10} />
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
        />
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
