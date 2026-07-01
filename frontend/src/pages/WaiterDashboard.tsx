import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEventSource } from '@/hooks/useEventSource';
import { WaiterAlerts } from '@/components/dashboard/WaiterAlerts';
import { OrderWithItems, BillData } from '@/types';
import {
  Bell,
  Clock,
  CheckCircle2,
  ChefHat,
  Utensils,
  Volume2,
  Printer,
  Receipt,
  CreditCard,
  ArrowRight,
  Search,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  Minus,
  AlertTriangle,
  Check,
  Share2,
  X,
  Smartphone,
  Eye
} from 'lucide-react';
import { formatCurrency, formatDate, HOTEL_NAME, HOTEL_UPI_ID, getStatusColor } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

// Waiter flow status progression
const STATUS_FLOW = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'];

const STATUS_META: Record<string, { label: string; icon: any; pill: string }> = {
  PLACED:    { label: 'New Order',  icon: Bell,         pill: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  ACCEPTED:  { label: 'Accepted',   icon: CheckCircle2, pill: 'bg-blue-100 text-blue-800 border-blue-200'       },
  PREPARING: { label: 'Preparing',  icon: ChefHat,      pill: 'bg-green-100 text-green-800 border-green-200'    },
  READY:     { label: 'Ready!',     icon: CheckCircle2, pill: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  SERVED:    { label: 'Served',     icon: Utensils,     pill: 'bg-purple-100 text-purple-800 border-purple-200' },
  PENDING:   { label: 'Pending',    icon: Clock,        pill: 'bg-orange-100 text-orange-800 border-orange-200' },
  PAID:      { label: 'Paid',       icon: CheckCircle2, pill: 'bg-gray-100 text-gray-655 border-gray-250'       },
};

interface Table {
  id: string;
  tableNumber: number;
  slug: string;
  active: boolean;
  callingWaiter: boolean;
  assignedWaiterId: string | null;
  assignedWaiter?: {
    id: string;
    username: string;
    email: string;
  } | null;
}

// Live elapsed timer component
function LiveTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const created = new Date(createdAt).getTime();
      const diffMs = Date.now() - created;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      setElapsed(`${diffMins}m ${diffSecs}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400">
      <Clock size={11} />
      {elapsed}
    </span>
  );
}



export default function WaiterDashboard() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [completedOrders, setCompletedOrders] = useState<OrderWithItems[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'billing' | 'completed'>('orders');
  const [completedFilter, setCompletedFilter] = useState<'today' | 'week' | 'month'>('today');

  // Modal states
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [shareBill, setShareBill] = useState<(BillData & { tableNumber?: number }) | null>(null);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  // Merge Mode States
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const [targetMergeId, setTargetMergeId] = useState<string>('');
  const [merging, setMerging] = useState(false);

  const { lastEvent } = useEventSource('/api/events');
  const navigate = useNavigate();

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        setCurrentUser(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch user:', e);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const flatItems = data.flatMap(cat => cat.items || []);
          setMenuItems(flatItems);
        }
      }
    } catch (e) {
      console.error('Failed to fetch menu:', e);
    }
  };

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [ordersRes, completedRes, tablesRes] = await Promise.all([
        fetch('/api/orders', { credentials: 'include' }),
        fetch('/api/orders?status=completed', { credentials: 'include' }),
        fetch('/api/tables', { credentials: 'include' })
      ]);

      if (ordersRes.ok) {
        setOrders(await ordersRes.json());
      }
      if (completedRes.ok) {
        setCompletedOrders(await completedRes.json());
      }
      if (tablesRes.ok) {
        setTables(await tablesRes.json());
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchCurrentUser();
    void fetchDashboardData();
    void fetchMenu();
  }, []);

  useEffect(() => {
    if (!lastEvent) return;
    if (['NEW_ORDER', 'ORDER_UPDATE', 'PAYMENT_SUBMITTED', 'WAITER_CALL', 'WAITER_DISMISS', 'TABLES_UPDATE'].includes(lastEvent.type)) {
      void fetchDashboardData(true);
      if (lastEvent.type === 'NEW_ORDER') {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          void audio.play().catch(() => {});
        } catch { /* ignore */ }
      }
    }
  }, [lastEvent]);

  // Order item quantity update
  const handleUpdateItemQty = async (itemId: string, currentQty: number, change: number) => {
    const targetQty = currentQty + change;
    if (targetQty < 1) return;
    try {
      const res = await fetch(`/api/waiter/order-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: targetQty }),
        credentials: 'include'
      });
      if (res.ok) {
        if (selectedOrder) {
          const updatedOrderRes = await fetch(`/api/orders/${selectedOrder.id}`, { credentials: 'include' });
          if (updatedOrderRes.ok) setSelectedOrder(await updatedOrderRes.json());
        }
        void fetchDashboardData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Order item deletion
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this item?')) return;
    try {
      const res = await fetch(`/api/waiter/order-items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        if (selectedOrder) {
          const updatedOrderRes = await fetch(`/api/orders/${selectedOrder.id}`, { credentials: 'include' });
          if (updatedOrderRes.ok) {
            const data = await updatedOrderRes.json();
            if (data.status === 'CANCELLED') {
              setSelectedOrder(null);
            } else {
              setSelectedOrder(data);
            }
          }
        }
        void fetchDashboardData(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add standard menu item
  const handleAddStandardItem = async (menuItemId: string) => {
    if (!selectedOrder) return;
    setSubmittingItem(true);
    try {
      const res = await fetch(`/api/waiter/orders/${selectedOrder.id}/add-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId, quantity: 1 }),
        credentials: 'include'
      });
      if (res.ok) {
        const updatedOrderRes = await fetch(`/api/orders/${selectedOrder.id}`, { credentials: 'include' });
        if (updatedOrderRes.ok) setSelectedOrder(await updatedOrderRes.json());
        setMenuSearch('');
        void fetchDashboardData(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingItem(false);
    }
  };

  // Add custom item
  const handleAddCustomItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !customItemName.trim() || !customItemPrice) return;
    setSubmittingItem(true);
    try {
      const res = await fetch(`/api/waiter/orders/${selectedOrder.id}/custom-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customItemName.trim(),
          price: parseFloat(customItemPrice),
          quantity: 1
        }),
        credentials: 'include'
      });
      if (res.ok) {
        const updatedOrderRes = await fetch(`/api/orders/${selectedOrder.id}`, { credentials: 'include' });
        if (updatedOrderRes.ok) setSelectedOrder(await updatedOrderRes.json());
        setCustomItemName('');
        setCustomItemPrice('');
        void fetchDashboardData(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingItem(false);
    }
  };

  // Order workflow status progression
  const handleProgressOrder = async (orderId: string, nextStatus: string) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      if (nextStatus === 'SERVED') {
        const res = await fetch('/api/bills/serve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
          credentials: 'include'
        });
        if (!res.ok) alert('Failed to mark order as served.');
      } else {
        const res = await fetch(`/api/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
          credentials: 'include'
        });
        if (!res.ok) alert('Failed to update status.');
      }
      void fetchDashboardData(true);
    } catch (err) {
      console.error(err);
    } finally {
      setActionInProgress(false);
    }
  };

  // Generate Bill
  const handleGenerateBill = async (orderId: string) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      const res = await fetch('/api/bills/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
        credentials: 'include'
      });
      if (res.ok) {
        void fetchDashboardData(true);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to generate bill.');
      }
    } catch {
      alert('Network error generating bill.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Print Bill
  const handlePrintBill = async (billId: string) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      const res = await fetch('/api/bills/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId }),
        credentials: 'include'
      });
      if (res.ok) {
        window.open(`/bill/${billId}`, '_blank');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to register print.');
      }
    } catch {
      alert('Network error printing bill.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Confirm cash payment
  const handleConfirmPayment = async (billId: string, method: 'CASH' | 'UPI' = 'CASH') => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/waiter/bills/${billId}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method }),
        credentials: 'include'
      });
      if (res.ok) {
        void fetchDashboardData(true);
      } else {
        alert('Failed to confirm payment.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error confirming payment.');
    } finally {
      setActionInProgress(false);
    }
  };

  // Reset merge states when tab changes
  useEffect(() => {
    setIsMergeMode(false);
    setSelectedMergeIds([]);
    setTargetMergeId('');
  }, [activeTab]);

  const handleToggleSelectMerge = (billId: string) => {
    setSelectedMergeIds(prev => {
      if (prev.includes(billId)) {
        const next = prev.filter(id => id !== billId);
        if (next.length < 2) setTargetMergeId('');
        return next;
      }
      if (prev.length >= 2) return prev;
      const next = [...prev, billId];
      if (next.length === 2) {
        setTargetMergeId(next[0]);
      }
      return next;
    });
  };

  const handleExecuteMerge = async () => {
    if (selectedMergeIds.length !== 2) return;
    if (!targetMergeId) return;

    const sourceId = selectedMergeIds.find(id => id !== targetMergeId);
    if (!sourceId) return;

    const sourceOrder = orders.find(o => o.bill?.id === sourceId);
    const targetOrder = orders.find(o => o.bill?.id === targetMergeId);

    if (!sourceOrder || !targetOrder || !sourceOrder.bill || !targetOrder.bill) return;

    if (!window.confirm(`Are you sure you want to merge Table ${sourceOrder.table.tableNumber} bill into Table ${targetOrder.table.tableNumber} bill? This action is permanent, items will be moved, and Table ${sourceOrder.table.tableNumber} bill will be deleted.`)) {
      return;
    }

    setMerging(true);
    try {
      const res = await fetch('/api/bills/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBillId: sourceId,
          targetBillId: targetMergeId
        }),
        credentials: 'include'
      });

      if (res.ok) {
        setIsMergeMode(false);
        setSelectedMergeIds([]);
        setTargetMergeId('');
        void fetchDashboardData(true);
        alert('Bills merged successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to merge bills');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while merging the bills');
    } finally {
      setMerging(false);
    }
  };

  // Dismiss table call
  const handleDismissCall = async (tableId: string) => {
    if (actionInProgress) return;
    setActionInProgress(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/call-waiter`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        void fetchDashboardData(true);
      }
    } catch (err) {
      console.error('Failed to dismiss call:', err);
    } finally {
      setActionInProgress(false);
    }
  };

  // Computed tab numbers
  const tabCounts = useMemo(() => {
    const ordersCount = orders.filter(o => ['ACCEPTED', 'PREPARING', 'READY'].includes(o.status)).length;
    const billingCount = orders.filter(o => ['SERVED', 'PENDING'].includes(o.status)).length;
    
    // Completed count filtered by date option
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    const completedCount = completedOrders.filter(o => {
      if (o.status !== 'PAID') return false;
      const createdTime = new Date(o.createdAt).getTime();
      if (completedFilter === 'today') return createdTime >= todayStart;
      if (completedFilter === 'week') return createdTime >= oneWeekAgo;
      return createdTime >= oneMonthAgo;
    }).length;

    return { ordersCount, billingCount, completedCount };
  }, [orders, completedOrders, completedFilter]);



  // Filtered active list for tab contents
  const filteredActiveOrders = useMemo(() => {
    return orders
      .filter(o => {
        if (activeTab === 'orders') {
          return ['ACCEPTED', 'PREPARING', 'READY'].includes(o.status);
        } else if (activeTab === 'billing') {
          return ['SERVED', 'PENDING'].includes(o.status);
        }
        return false;
      })
      .filter(o => {
        if (!searchTerm) return true;
        const matchTable = o.table.tableNumber.toString().includes(searchTerm);
        const matchPhone = o.phone_number?.includes(searchTerm);
        const matchItems = o.items.some(it => it.menuItem?.name.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchTable || matchPhone || matchItems;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, activeTab, searchTerm]);

  // Active calling tables (pinned to top of Orders tab)
  const callingTables = useMemo(() => {
    return tables.filter(t => t.callingWaiter);
  }, [tables]);

  // Completed paid list
  const filteredCompletedOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneWeekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return completedOrders
      .filter(o => o.status === 'PAID')
      .filter(o => {
        const createdTime = new Date(o.createdAt).getTime();
        if (completedFilter === 'today') return createdTime >= todayStart;
        if (completedFilter === 'week') return createdTime >= oneWeekAgo;
        return createdTime >= oneMonthAgo;
      })
      .filter(o => {
        if (!searchTerm) return true;
        const matchTable = o.table.tableNumber.toString().includes(searchTerm);
        const matchPhone = o.phone_number?.includes(searchTerm);
        const matchBillNum = o.bill?.billNumber.includes(searchTerm);
        return matchTable || matchPhone || matchBillNum;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [completedOrders, completedFilter, searchTerm]);

  // Flat menu items list filtered by autocomplete search
  const filteredMenuOptions = useMemo(() => {
    if (!menuSearch.trim()) return [];
    return menuItems
      .filter(item => item.name.toLowerCase().includes(menuSearch.toLowerCase()))
      .slice(0, 5);
  }, [menuItems, menuSearch]);

  const getProgressAction = (status: string) => {
    switch (status) {
      case 'PLACED': return { label: 'Accept Order', next: 'ACCEPTED', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200' };
      case 'ACCEPTED': return { label: 'Start Prep', next: 'PREPARING', color: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200' };
      case 'PREPARING': return { label: 'Mark Ready', next: 'READY', color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' };
      case 'READY': return { label: 'Mark Served', next: 'SERVED', color: 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-100 font-bold' };
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center space-y-4">
          <Clock className="animate-spin text-amber-500 mx-auto" size={40} />
          <p className="text-gray-500 text-sm font-semibold tracking-wide">Loading POS Workflow view…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 flex flex-col gap-6 font-sans">
      <WaiterAlerts lastEvent={lastEvent} />

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-250 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-gray-900">{HOTEL_NAME}</h1>
            <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-full">POS Live Workflow</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Real-time order processing, served tracking, and quick bill confirmation</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64 sm:flex-initial">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search table, mobile, bill, items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-sm"
            />
          </div>

          {activeTab === 'billing' && (
            <button
              onClick={() => {
                setIsMergeMode(!isMergeMode);
                setSelectedMergeIds([]);
                setTargetMergeId('');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm whitespace-nowrap ${
                isMergeMode 
                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                  : 'bg-white text-gray-750 border-gray-250 hover:bg-gray-50'
              }`}
            >
              {isMergeMode ? 'Cancel Merge' : 'Merge Bills'}
            </button>
          )}

          <button
            onClick={() => void fetchDashboardData()}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white border border-gray-250 hover:border-amber-500/30 text-gray-700 hover:bg-gray-50 transition shrink-0 shadow-sm"
            title="Refresh dashboard data"
          >
            <RefreshCw size={15} className={`${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>



      {/* ── Workflow Navigation Tabs ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-250 pb-2">
        <div className="flex gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all border whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10'
                : 'bg-white text-gray-650 border-gray-250 hover:text-gray-900 hover:bg-gray-50 shadow-sm'
            }`}
          >
            <span>Orders</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === 'orders' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {tabCounts.ordersCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('billing')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all border whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'billing'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10'
                : 'bg-white text-gray-650 border-gray-250 hover:text-gray-900 hover:bg-gray-50 shadow-sm'
            }`}
          >
            <span>Bill Generate</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === 'billing' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {tabCounts.billingCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all border whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10'
                : 'bg-white text-gray-655 border-gray-250 hover:text-gray-900 hover:bg-gray-50 shadow-sm'
            }`}
          >
            <span>Completed Orders</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === 'completed' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {tabCounts.completedCount}
            </span>
          </button>
        </div>

        {/* Completed Tab Filters */}
        {activeTab === 'completed' && (
          <div className="flex bg-gray-100 border border-gray-250 rounded-xl p-0.5 shrink-0 self-start sm:self-center">
            {(['today', 'week', 'month'] as const).map((filterOpt) => (
              <button
                key={filterOpt}
                onClick={() => setCompletedFilter(filterOpt)}
                className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all ${
                  completedFilter === filterOpt
                    ? 'bg-white text-amber-600 font-bold border border-gray-200/50 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {filterOpt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Active Waiter Call Requests (Always top of orders view) ── */}
      {activeTab === 'orders' && callingTables.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase font-bold text-rose-600 tracking-wider flex items-center gap-1.5">
            <Bell size={12} className="text-rose-500 animate-pulse" /> Waiter Assistance Requests
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {callingTables.map(t => (
              <div key={t.id} className="bg-rose-50 border border-rose-250 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-100 text-rose-700 border border-rose-200 rounded-xl flex items-center justify-center font-black text-sm">
                    T{t.tableNumber}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">Table {t.tableNumber}</h4>
                    <p className="text-[10px] text-rose-600 mt-0.5">Calling for waiter...</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDismissCall(t.id)}
                  disabled={actionInProgress}
                  className={`px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[10px] font-bold rounded-lg transition ${actionInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  Dismiss Call
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab View Content ──────────────────────────────────────────── */}
      {activeTab === 'billing' && isMergeMode && (
        <div className="p-5 mb-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl shadow-sm animate-slide-up flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-emerald-950 font-medium w-full">
            <h3 className="font-bold text-base mb-1">Bill Merge Assistant</h3>
            {filteredActiveOrders.filter(o => o.bill && o.bill.paymentStatus !== 'PAID').length < 2 ? (
              <p className="text-amber-700 font-semibold">
                ⚠️ There are not enough active bills in this section to merge. Please ensure at least two tables have active bills.
              </p>
            ) : selectedMergeIds.length < 2 ? (
              <p className="text-emerald-700">Select exactly two bills from the list below ({selectedMergeIds.length}/2 selected).</p>
            ) : (
              <div>
                <p className="mb-2">Choose which table keeps the combined bill:</p>
                <div className="flex gap-4 flex-wrap">
                  {selectedMergeIds.map(id => {
                    const order = orders.find(o => o.bill?.id === id);
                    if (!order || !order.bill) return null;
                    return (
                      <label key={id} className="inline-flex items-center gap-2 cursor-pointer font-bold bg-white px-3 py-2 rounded-lg border border-emerald-250 shadow-sm text-xs text-gray-800">
                        <input
                          type="radio"
                          name="target-bill-selection"
                          checked={targetMergeId === id}
                          onChange={() => setTargetMergeId(id)}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Table {order.table.tableNumber} (Bill {order.bill.billNumber})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 shrink-0 w-full md:w-auto justify-end">
            <button
              onClick={() => {
                setIsMergeMode(false);
                setSelectedMergeIds([]);
                setTargetMergeId('');
              }}
              className="px-4 py-2 border border-gray-200 rounded-xl bg-white text-gray-755 hover:bg-gray-50 text-xs font-bold transition shadow-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteMerge}
              disabled={selectedMergeIds.length !== 2 || !targetMergeId || merging}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/10 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {merging ? (
                <>
                  <Clock className="animate-spin" size={14} /> Merging...
                </>
              ) : (
                'Execute Merge'
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'orders' && filteredActiveOrders.length === 0 && callingTables.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300 shadow-sm">
          <div className="mx-auto w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
            <Utensils size={26} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No Orders Active</h3>
          <p className="text-gray-500 text-xs max-w-sm mx-auto">
            All customer tables are served. New orders and assistance requests will appear here instantly.
          </p>
        </div>
      ) : activeTab === 'billing' && filteredActiveOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300 shadow-sm">
          <div className="mx-auto w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
            <Receipt size={26} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No Bills to Process</h3>
          <p className="text-gray-500 text-xs max-w-sm mx-auto">
            There are no served tables waiting for bill generation or cash verification.
          </p>
        </div>
      ) : activeTab === 'completed' && filteredCompletedOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300 shadow-sm">
          <div className="mx-auto w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
            <CheckCircle2 size={26} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No Completed History</h3>
          <p className="text-gray-500 text-xs max-w-sm mx-auto">
            No orders match the selected filters or search parameters in this range.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Active Orders or Bill Generate List */}
          {activeTab !== 'completed' && filteredActiveOrders.map(order => {
            const meta = STATUS_META[order.status] || STATUS_META['PLACED'];
            const Icon = meta.icon;
            
            const isNew = order.status === 'PLACED';
            const itemsCount = order.items.reduce((s, it) => s + it.quantity, 0);
            
            const progress = getProgressAction(order.status);
            
            // Determine badge status for Bill Generate tab
            const isServed = order.status === 'SERVED';
            const isPendingPayment = order.status === 'PENDING';
            const isCashAwaiting = order.bill?.paymentStatus === 'AWAITING_CONFIRMATION' && order.bill?.paymentMethod === 'CASH';
            const isUpiAwaiting = order.bill?.paymentStatus === 'AWAITING_CONFIRMATION' && order.bill?.paymentMethod === 'UPI';

            let pillClass = meta.pill;
            if (isUpiAwaiting) pillClass = 'bg-blue-100 text-blue-800 border-blue-200';
            else if (isCashAwaiting) pillClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
            else if (isPendingPayment) pillClass = 'bg-orange-100 text-orange-800 border-orange-200';
            else if (isServed) pillClass = 'bg-purple-100 text-purple-800 border-purple-200';

            const borderColor = getStatusColor(order.status).replace('bg-', 'border-');

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl shadow-sm border-l-4 ${borderColor} overflow-hidden flex flex-col justify-between transition-all duration-200 ${
                  isNew && activeTab === 'orders' ? 'ring-2 ring-amber-300 ring-offset-1 shadow-amber-100' : ''
                } ${
                  isCashAwaiting ? 'ring-2 ring-emerald-300 ring-offset-1 shadow-emerald-100' : ''
                }`}
              >
                {/* Header (Clickable) */}
                <div 
                  onClick={() => setSelectedOrder(order)}
                  className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-100/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isMergeMode && activeTab === 'billing' && (
                      (() => {
                        const firstSelectedOrderId = selectedMergeIds.length > 0
                          ? orders.find(o => o.bill?.id === selectedMergeIds[0])?.id
                          : null;
                        const firstSelectedOrder = orders.find(o => o.id === firstSelectedOrderId);
                        const isDifferentTable = firstSelectedOrder && firstSelectedOrder.table.tableNumber !== order.table.tableNumber;
                        const isSelectable = !!order.bill && order.bill.paymentStatus !== 'PAID';
                        const isDisabledCheckbox = isDifferentTable || !isSelectable;
                        
                        return (
                          <input
                            type="checkbox"
                            checked={order.bill ? selectedMergeIds.includes(order.bill.id) : false}
                            disabled={isDisabledCheckbox && (order.bill ? !selectedMergeIds.includes(order.bill.id) : true)}
                            onChange={() => {
                              if (order.bill) {
                                handleToggleSelectMerge(order.bill.id);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          />
                        );
                      })()
                    )}
                    <span className="font-bold text-gray-900 border border-gray-200 bg-white px-2 py-0.5 rounded text-sm shadow-sm">
                      Table {order.table.tableNumber}
                    </span>
                    <div>
                      <p className="text-[10px] font-bold text-gray-600">{order.phone_number || 'Guest Customer'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${pillClass}`}>
                      <Icon size={11} />
                      {isUpiAwaiting ? 'UPI Review' : isCashAwaiting ? 'Collect Cash' : isPendingPayment ? 'Bill Sent' : isServed ? 'Served' : meta.label}
                    </span>
                    <LiveTimer createdAt={order.createdAt} />
                  </div>
                </div>

                {/* Items Body (Clickable) */}
                <div 
                  onClick={() => setSelectedOrder(order)}
                  className="p-4 flex-1 space-y-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                >
                  <ul className="space-y-2">
                    {order.items.slice(0, 3).map(item => (
                      <li key={item.id} className="flex justify-between items-start text-xs text-gray-700">
                        <span className="truncate pr-2">
                          <strong className="text-amber-600 mr-1">{item.quantity}×</strong>
                          {item.menuItem?.name || 'Item'}
                        </span>
                        <span className="text-gray-500 shrink-0 font-mono">{formatCurrency(item.price * item.quantity)}</span>
                      </li>
                    ))}
                    {order.items.length > 3 && (
                      <li className="text-[10px] text-gray-550 font-bold italic">
                        + {order.items.length - 3} more item(s)...
                      </li>
                    )}
                  </ul>

                  {order.notes && (
                    <div className="p-2 rounded-lg bg-yellow-50 border border-yellow-250 text-[10px] text-yellow-850 leading-relaxed max-h-16 overflow-y-auto">
                      <strong>Notes:</strong> {order.notes}
                    </div>
                  )}
                </div>

                {/* Footer Action Bar */}
                <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] text-gray-505 uppercase font-extrabold tracking-wider">Total Amount</p>
                    <span className="font-extrabold text-sm text-gray-900">{formatCurrency(order.bill ? order.bill.total : order.total)}</span>
                  </div>

                  <div className="flex gap-2">
                    {/* Details button visible on all tabs */}
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="px-3 py-2 bg-white hover:bg-gray-50 active:scale-95 text-gray-700 text-[10px] font-bold rounded-xl transition border border-gray-250 shadow-sm"
                    >
                      Details
                    </button>

                    {activeTab === 'orders' ? (
                      <>
                        {progress && (
                          <button
                            type="button"
                            onClick={() => handleProgressOrder(order.id, progress.next)}
                            disabled={actionInProgress}
                            className={`px-3.5 py-2 rounded-xl text-[10px] font-bold border transition-all active:scale-95 flex items-center gap-1 ${progress.color} ${actionInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {progress.label}
                            <ArrowRight size={11} />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {isServed && (
                          <button
                            type="button"
                            onClick={() => handleGenerateBill(order.id)}
                            disabled={actionInProgress}
                            className={`px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-[10px] font-bold rounded-xl transition shadow-md shadow-amber-200/50 ${actionInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            Generate Bill
                          </button>
                        )}

                        {isPendingPayment && order.bill && (
                          <div className="flex gap-1.5">
                            {/* Share QR */}
                            <button
                              type="button"
                              onClick={() => setShareBill(order.bill ? { ...order.bill, tableNumber: order.table.tableNumber } : null)}
                              disabled={actionInProgress}
                              className={`p-2 bg-white hover:bg-gray-50 text-gray-650 hover:text-gray-900 rounded-xl transition border border-gray-250 shadow-sm ${actionInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Share checkout QR"
                            >
                              <Share2 size={13} />
                            </button>

                            {/* Print */}
                            <button
                              type="button"
                              onClick={() => handlePrintBill(order.bill!.id)}
                              disabled={actionInProgress}
                              className={`p-2 bg-white hover:bg-gray-50 text-gray-650 hover:text-gray-900 rounded-xl transition border border-gray-250 shadow-sm ${actionInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="Print bill copy"
                            >
                              <Printer size={13} />
                            </button>

                            {/* Collect Cash Confirmation */}
                            {isCashAwaiting ? (
                              <button
                                type="button"
                                onClick={() => handleConfirmPayment(order.bill!.id, 'CASH')}
                                disabled={actionInProgress}
                                className={`px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[10px] font-bold rounded-xl transition shadow-md shadow-emerald-100 ${actionInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                Confirm Cash
                              </button>
                            ) : isUpiAwaiting ? (
                              <button
                                type="button"
                                onClick={() => handleConfirmPayment(order.bill!.id, 'UPI')}
                                disabled={actionInProgress}
                                className={`px-3 py-1.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white text-[10px] font-bold rounded-xl transition shadow-md shadow-blue-100 ${actionInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                Confirm UPI
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleConfirmPayment(order.bill!.id, 'CASH')}
                                disabled={actionInProgress}
                                className={`px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-750 text-[10px] font-bold rounded-xl transition border border-gray-250 shadow-sm ${actionInProgress ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                Collect Cash
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Completed Orders List */}
          {activeTab === 'completed' && filteredCompletedOrders.map(order => {
            const billNum = order.bill?.billNumber || '----';
            const payMethod = order.bill?.paymentMethod || 'CASH';

            return (
              <div
                key={order.id}
                className="rounded-2xl bg-white border border-gray-200 p-4 flex flex-col justify-between gap-4 transition-all duration-200 hover:border-gray-300 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-50 border border-gray-250 rounded-xl flex items-center justify-center font-bold text-sm text-gray-900">
                      T{order.table.tableNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-gray-900">Bill #{billNum}</span>
                        <span className="px-2 py-0.5 rounded text-[8px] font-bold bg-gray-100 text-gray-650 border border-gray-250 uppercase">
                          {payMethod}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5">{order.phone_number || 'Guest Customer'}</p>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-gray-400 text-right">
                    {formatDate(order.bill?.createdAt || order.createdAt)}
                  </span>
                </div>

                <div className="h-[1px] bg-gray-100" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase font-extrabold tracking-wider">Settled Amount</p>
                    <span className="font-black text-sm text-gray-900">{formatCurrency(order.bill ? order.bill.total : order.total)}</span>
                  </div>

                  <div className="flex gap-1.5">
                    {order.bill && (
                      <>
                        <button
                          onClick={() => setShareBill(order.bill ? { ...order.bill, tableNumber: order.table.tableNumber } : null)}
                          className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-[10px] font-bold rounded-lg transition border border-gray-250 flex items-center gap-1 shadow-sm"
                        >
                          <Eye size={11} />
                          Receipt
                        </button>
                        <button
                          onClick={() => handlePrintBill(order.bill!.id)}
                          className="p-1.5 bg-white hover:bg-gray-50 text-gray-650 hover:text-gray-900 rounded-lg transition border border-gray-250 shadow-sm"
                          title="Reprint receipt"
                        >
                          <Printer size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── View Details Modal / Order Customizer ─────────────────────── */}
      {selectedOrder && (
        <div 
          onClick={() => setSelectedOrder(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] cursor-default"
          >
            {/* Header */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-amber-500/10 text-amber-600 rounded-lg flex items-center justify-center font-bold text-xs">
                  T{selectedOrder.table.tableNumber}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Order Items Customizer</h3>
                  <p className="text-[9px] text-gray-400 font-mono">ID: #{selectedOrder.id.slice(-6).toUpperCase()}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-650 flex items-center justify-center transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Item list editor */}
              <div className="space-y-3">
                <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-extrabold">Current Items</h4>
                <div className="border border-gray-200 rounded-2xl divide-y divide-gray-200 overflow-hidden bg-gray-50/20">
                  {selectedOrder.items.map(item => (
                    <div key={item.id} className="p-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-xs text-gray-800">{item.menuItem?.name || 'Item'}</span>
                        <p className="text-[9px] text-gray-400 font-mono mt-0.5">{formatCurrency(item.price)} each</p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Qty incrementors */}
                        <div className="flex items-center bg-white border border-gray-250 rounded-xl p-0.5 shadow-sm">
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.id, item.quantity, -1)}
                            disabled={item.quantity <= 1 || submittingItem || actionInProgress}
                            className="p-1 hover:text-gray-800 text-gray-400 disabled:opacity-40 transition cursor-pointer"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-6 text-center text-xs font-bold text-gray-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateItemQty(item.id, item.quantity, 1)}
                            disabled={submittingItem || actionInProgress}
                            className="p-1 hover:text-gray-800 text-gray-400 transition cursor-pointer disabled:opacity-40"
                          >
                            <Plus size={11} />
                          </button>
                        </div>

                        {/* Price total */}
                        <span className="w-16 text-right font-mono text-xs font-semibold text-gray-800">
                          {formatCurrency(item.price * item.quantity)}
                        </span>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={submittingItem || actionInProgress}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-rose-100"
                          title="Remove item"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add item search section */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <h4 className="text-[10px] uppercase tracking-wider text-gray-550 font-extrabold">Add Menu Item</h4>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search menu (e.g. Biryani, Naan)..."
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    className="w-full bg-white border border-gray-350 text-gray-950 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-sm"
                  />
                  
                  {/* Autocomplete dropdown options */}
                  {filteredMenuOptions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-10 divide-y divide-gray-100">
                      {filteredMenuOptions.map(item => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => handleAddStandardItem(item.id)}
                          disabled={submittingItem}
                          className="w-full px-4 py-2.5 text-left text-xs hover:bg-gray-50 transition flex items-center justify-between cursor-pointer text-gray-800"
                        >
                          <span className="font-semibold">{item.name}</span>
                          <span className="text-amber-600 font-mono">{formatCurrency(item.price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Add custom custom-item section */}
              <form onSubmit={handleAddCustomItem} className="space-y-3 pt-4 border-t border-gray-200">
                <h4 className="text-[10px] uppercase tracking-wider text-gray-550 font-extrabold">Add Extra / Custom Item</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Custom Item Name (e.g. Ice cream)"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    className="flex-1 bg-white border border-gray-300 text-gray-955 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-sm"
                  />
                  <div className="relative w-24">
                    <span className="absolute left-3 top-2 text-gray-400 text-xs">₹</span>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Price"
                      value={customItemPrice}
                      onChange={(e) => setCustomItemPrice(e.target.value)}
                      className="w-full bg-white border border-gray-300 text-gray-955 rounded-xl pl-6 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingItem}
                    className="px-4 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 shadow-md shadow-amber-200/50 shrink-0 cursor-pointer"
                  >
                    <Plus size={13} />
                    Add
                  </button>
                </div>
              </form>
            </div>

            {/* Sticky Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-150 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Close Editor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Share Bill Checkout QR Code Modal ───────────────────────── */}
      {shareBill && (
        <div 
          onClick={() => setShareBill(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-2xl cursor-default"
          >
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-150 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase text-gray-700 tracking-wider">Share Table Checkout</h3>
              <button
                type="button"
                onClick={() => setShareBill(null)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center transition cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-6 text-center space-y-5">
              <div className="space-y-1">
                <h4 className="text-base font-bold text-gray-900">Table {shareBill.tableNumber || '---'} Payment</h4>
                <p className="text-xs text-gray-550">Scan to complete UPI checkout or view online bill copy</p>
              </div>

              {/* QR Code */}
              <div className="bg-white p-4 inline-block rounded-2xl shadow-xl border border-gray-200">
                <QRCodeSVG
                  value={
                    shareBill.paymentStatus === 'PAID'
                      ? `${window.location.origin}/bill/${shareBill.id}`
                      : `${window.location.origin}/pay/${shareBill.id}`
                  }
                  size={170}
                  level="M"
                />
              </div>

              {/* UPI Link Display */}
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-left space-y-1 font-mono text-[10px] text-gray-600">
                <div className="flex justify-between">
                  <span>Merchant UPI ID:</span>
                  <span className="font-bold text-gray-900">{HOTEL_UPI_ID}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payable Total:</span>
                  <span className="font-bold text-amber-600">{formatCurrency(shareBill.total)}</span>
                </div>
              </div>

              {/* Copy URL */}
              <button
                type="button"
                onClick={() => {
                  const payUrl = `${window.location.origin}/pay/${shareBill.id}`;
                  navigator.clipboard.writeText(payUrl);
                  alert('Checkout link copied!');
                }}
                className="w-full py-3 bg-gray-150 hover:bg-gray-200 text-gray-705 border border-gray-250 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Smartphone size={13} />
                Copy Checkout URL Link
              </button>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-150 flex justify-end">
              <button
                type="button"
                onClick={() => setShareBill(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
