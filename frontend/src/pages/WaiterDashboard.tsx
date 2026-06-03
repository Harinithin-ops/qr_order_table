import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEventSource } from '@/hooks/useEventSource';
import { WaiterAlerts } from '@/components/dashboard/WaiterAlerts';
import { OrderWithItems, BillData } from '@/types';
import {
  Activity,
  BellOff,
  Utensils,
  Clock,
  CheckCircle2,
  ChefHat,
  Bell,
  ArrowRight,
  CreditCard,
  Receipt,
  RefreshCw,
  LayoutGrid,
  Users,
  TrendingUp,
  DollarSign,
  Layers,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Check,
  AlertTriangle,
  Printer,
  FileText,
  Volume2
} from 'lucide-react';
import { formatCurrency, formatDate, HOTEL_NAME } from '@/lib/utils';

// Waiter flow status progression
const STATUS_FLOW = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'];

const STATUS_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  PLACED:    { label: 'New Order',  icon: Bell,          color: 'text-amber-400', bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  ACCEPTED:  { label: 'Accepted',   icon: CheckCircle2,  color: 'text-blue-400',  bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  PREPARING: { label: 'Preparing',  icon: ChefHat,       color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  READY:     { label: 'Ready!',     icon: CheckCircle2,  color: 'text-emerald-400',bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  SERVED:    { label: 'Served',     icon: Utensils,      color: 'text-violet-400', bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
  PENDING:   { label: 'Pending',    icon: Clock,         color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20' },
  PAID:      { label: 'Paid',       icon: CheckCircle2,  color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20' },
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

// ─── Live Timer Component with Color Coding ──────────────────────────────────
function LiveTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState('');
  const [colorClass, setColorClass] = useState('text-emerald-400 bg-emerald-500/10 border-emerald-500/20');

  useEffect(() => {
    const updateTimer = () => {
      const created = new Date(createdAt).getTime();
      const now = Date.now();
      const diffMs = now - created;
      const diffMins = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);

      setElapsed(`${diffMins}m ${diffSecs}s`);

      if (diffMins < 10) {
        setColorClass('text-emerald-400 bg-emerald-500/10 border-emerald-500/20');
      } else if (diffMins < 15) {
        setColorClass('text-amber-400 bg-amber-500/10 border-amber-500/20');
      } else if (diffMins < 20) {
        setColorClass('text-orange-400 bg-orange-500/10 border-orange-500/20');
      } else {
        setColorClass('text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 shrink-0 ${colorClass}`}>
      <Clock size={12} />
      {elapsed}
    </span>
  );
}

// ─── Stat Widget Card ────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
  bgClass
}: {
  label: string;
  value: string | number;
  icon: any;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className="p-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md shadow-lg flex items-center gap-3 transition-all hover:scale-[1.02] duration-200">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bgClass} shrink-0`}>
        <Icon className={colorClass} size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold truncate">{label}</p>
        <h3 className="text-base font-black text-slate-100 mt-0.5 truncate">{value}</h3>
      </div>
    </div>
  );
}

// ─── Main Waiter Dashboard Floor View Component ──────────────────────────────
export default function WaiterDashboard() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilter, setTableFilter] = useState<'my' | 'active' | 'calling' | 'ready' | 'all'>('my');
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  // Merge modal states
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergePhone, setMergePhone] = useState('');
  const [mergeTableId, setMergeTableId] = useState('');
  const [mergeTableNum, setMergeTableNum] = useState<number>(0);
  const [sourceBillId, setSourceBillId] = useState('');
  const [targetBillId, setTargetBillId] = useState('');
  const [mergeReason, setMergeReason] = useState('Customer requested consolidation');
  const [merging, setMerging] = useState(false);

  const { lastEvent } = useEventSource('/api/events');
  const navigate = useNavigate();

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
        // Default to 'all' if admin, 'my' if waiter
        if (data.role === 'admin') {
          setTableFilter('active');
        }
      }
    } catch (e) {
      console.error('Failed to fetch user:', e);
    }
  };

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [ordersRes, tablesRes, statsRes] = await Promise.all([
        fetch('/api/orders', { credentials: 'include' }),
        fetch('/api/tables', { credentials: 'include' }),
        fetch('/api/waiter/dashboard-stats', { credentials: 'include' })
      ]);

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }
      if (tablesRes.ok) {
        const tablesData = await tablesRes.json();
        setTables(tablesData);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
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

  // Set default expansion for tables that have active orders or calls
  useEffect(() => {
    if (tables.length > 0 && Object.keys(expandedTables).length === 0) {
      const initialExp: Record<string, boolean> = {};
      tables.forEach(t => {
        const hasOrders = orders.some(o => o.tableId === t.id && o.status !== 'PAID' && o.status !== 'CANCELLED' && o.status !== 'MERGED');
        if (hasOrders || t.callingWaiter) {
          initialExp[t.id] = true;
        }
      });
      setExpandedTables(initialExp);
    }
  }, [tables, orders]);

  // Handle order status advancement
  const handleUpdateStatus = async (orderId: string, status: string) => {
    // Optimistic status update
    setOrders(curr => curr.map(o => o.id === orderId ? { ...o, status: status as any } : o));
    try {
      if (status === 'SERVED') {
        // Use served specific audit logging endpoint
        await fetch('/api/bills/serve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId }),
          credentials: 'include'
        });
      } else {
        await fetch(`/api/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status }),
        });
      }
      void fetchDashboardData(true);
    } catch (e) {
      console.error(e);
      void fetchDashboardData(true);
    }
  };

  // Generate single bill for order
  const handleGenerateBill = async (orderId: string) => {
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
    }
  };

  // Print log and navigate/print preview
  const handlePrintBill = async (billId: string) => {
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
    }
  };

  // Dismiss table waiter call
  const handleDismissCall = async (tableId: string) => {
    try {
      const res = await fetch(`/api/tables/${tableId}/call-waiter`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setTables(prev => prev.map(t => t.id === tableId ? { ...t, callingWaiter: false } : t));
      }
    } catch (err) {
      console.error('Failed to dismiss call:', err);
    }
  };

  // Manual Merge Handler
  const handleOpenMergeModal = (tableId: string, tableNumber: number, phoneNum: string, bills: BillData[]) => {
    if (bills.length < 2) return;
    setMergeTableId(tableId);
    setMergeTableNum(tableNumber);
    setMergePhone(phoneNum);
    setSourceBillId(bills[0].id);
    setTargetBillId(bills[1].id);
    setShowMergeModal(true);
  };

  const handleMergeSubmit = async () => {
    if (sourceBillId === targetBillId) {
      alert('Source and Target bills cannot be the same!');
      return;
    }
    setMerging(true);
    try {
      const res = await fetch('/api/bills/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBillId,
          targetBillId,
          reason: mergeReason
        }),
        credentials: 'include'
      });

      if (res.ok) {
        setShowMergeModal(false);
        void fetchDashboardData(true);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to merge bills.');
      }
    } catch (err) {
      alert('Network error merging bills.');
    } finally {
      setMerging(false);
    }
  };

  const toggleTableExpand = (tableId: string) => {
    setExpandedTables(prev => ({ ...prev, [tableId]: !prev[tableId] }));
  };

  // Active filters and selectors
  const activeOrders = useMemo(() => {
    return orders.filter(o => o.status !== 'PAID' && o.status !== 'CANCELLED' && o.status !== 'MERGED');
  }, [orders]);

  const groupedTables = useMemo(() => {
    const isUserAdmin = currentUser?.role === 'admin';
    const waiterId = currentUser?.id;

    // Filter tables list based on tabs
    const filtered = tables.filter(t => {
      // 1. Text Search matches table number, customer phone, menu item names
      if (searchTerm) {
        const matchTable = t.tableNumber.toString().includes(searchTerm);
        const tOrders = activeOrders.filter(o => o.tableId === t.id);
        const matchPhone = tOrders.some(o => o.phone_number?.includes(searchTerm));
        const matchItems = tOrders.some(o => o.items.some(it => it.menuItem.name.toLowerCase().includes(searchTerm.toLowerCase())));
        if (!matchTable && !matchPhone && !matchItems) return false;
      }

      // 2. Tab Filter
      const tOrders = activeOrders.filter(o => o.tableId === t.id);
      const isAssigned = isUserAdmin || t.assignedWaiterId === waiterId;
      const isCalling = t.callingWaiter;
      const hasReady = tOrders.some(o => o.status === 'READY');
      const hasActive = tOrders.length > 0;

      if (tableFilter === 'my') {
        return isAssigned;
      } else if (tableFilter === 'active') {
        return hasActive || isCalling;
      } else if (tableFilter === 'calling') {
        return isCalling;
      } else if (tableFilter === 'ready') {
        return hasReady;
      }
      return true; // 'all'
    });

    // Structure: Table -> Customer Mobile -> Bills/Orders
    return filtered.map(t => {
      const tOrders = activeOrders.filter(o => o.tableId === t.id);
      const customerGroups: Record<string, {
        phone: string;
        customerName: string;
        orders: OrderWithItems[];
        bills: BillData[];
        totalAmount: number;
      }> = {};

      tOrders.forEach(order => {
        const phone = order.phone_number || 'Guest';
        if (!customerGroups[phone]) {
          customerGroups[phone] = {
            phone,
            customerName: phone === 'Guest' ? 'Guest Customer' : `Customer ${phone}`,
            orders: [],
            bills: [],
            totalAmount: 0
          };
        }
        customerGroups[phone].orders.push(order);
        if (order.bill && order.bill.paymentStatus !== 'MERGED') {
          customerGroups[phone].bills.push(order.bill);
        }
        customerGroups[phone].totalAmount += order.bill ? order.bill.total : order.total;
      });

      const customerCount = Object.keys(customerGroups).length;
      const activeBillsCount = tOrders.filter(o => o.bill && o.bill.paymentStatus !== 'MERGED').length;
      const totalPendingValue = tOrders.reduce((sum, o) => sum + (o.bill ? o.bill.total : o.total), 0);
      const pendingOrdersCount = tOrders.filter(o => ['PLACED', 'ACCEPTED', 'PREPARING'].includes(o.status)).length;
      const tableUnpaidBills = tOrders
        .filter(o => o.bill && o.bill.paymentStatus === 'PENDING')
        .map(o => o.bill!);
      const canMergeTable = tableUnpaidBills.length >= 2;

      // Determine Table Status
      let tableStatus: 'CALLING' | 'READY_TO_SERVE' | 'AWAITING_PAYMENT' | 'OCCUPIED' | 'IDLE' = 'IDLE';
      if (t.callingWaiter) {
        tableStatus = 'CALLING';
      } else if (tOrders.some(o => o.status === 'READY')) {
        tableStatus = 'READY_TO_SERVE';
      } else if (tOrders.some(o => o.bill?.paymentStatus === 'AWAITING_CONFIRMATION')) {
        tableStatus = 'AWAITING_PAYMENT';
      } else if (tOrders.length > 0) {
        tableStatus = 'OCCUPIED';
      }

      return {
        table: t,
        customerGroups: Object.values(customerGroups),
        stats: {
          customerCount,
          activeBillsCount,
          totalPendingValue,
          pendingOrdersCount,
          tableStatus,
          tableUnpaidBills,
          canMergeTable
        }
      };
    });
  }, [tables, activeOrders, tableFilter, searchTerm, currentUser]);

  const readyOrdersCount = useMemo(() => {
    return activeOrders.filter(o => o.status === 'READY').length;
  }, [activeOrders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh] bg-slate-950 text-slate-100">
        <div className="text-center space-y-4">
          <Activity className="animate-spin text-amber-500 mx-auto" size={40} />
          <p className="text-slate-400 text-sm font-semibold tracking-wide">Loading Waiter Floor View…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 flex flex-col gap-6 font-sans">
      {/* Waiter Alerts (bell calls) */}
      <WaiterAlerts lastEvent={lastEvent} />

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">Waiter Dashboard</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">Floor View</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Real-time table, customer grouping and order tracking</p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64 sm:flex-initial">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={15} />
            <input
              type="text"
              placeholder="Search table, phone, items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/60 border border-slate-800 text-slate-100 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <button
            onClick={() => void fetchDashboardData()}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-900 border border-slate-850 hover:border-amber-500/30 text-slate-300 hover:text-white transition shrink-0"
            title="Refresh Floor"
          >
            <RefreshCw size={15} className={`${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Analytics Header Panel ────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard
            label="Active Tables"
            value={stats.activeTables}
            icon={LayoutGrid}
            colorClass="text-violet-400"
            bgClass="bg-violet-500/10 border-violet-500/20"
          />
          <StatCard
            label="Customers"
            value={stats.activeCustomers}
            icon={Users}
            colorClass="text-sky-400"
            bgClass="bg-sky-500/10 border-sky-500/20"
          />
          <StatCard
            label="Active Bills"
            value={stats.activeBills}
            icon={FileText}
            colorClass="text-amber-400"
            bgClass="bg-amber-500/10 border-amber-500/20"
          />
          <StatCard
            label="Pending Orders"
            value={stats.pendingOrders}
            icon={Clock}
            colorClass="text-orange-400"
            bgClass="bg-orange-500/10 border-orange-500/20"
          />
          <StatCard
            label="Ready Orders"
            value={stats.readyOrders}
            icon={ChefHat}
            colorClass="text-emerald-400"
            bgClass={`bg-emerald-500/10 border-emerald-500/20 ${stats.readyOrders > 0 ? 'animate-pulse' : ''}`}
          />
          <StatCard
            label="Today's Rev."
            value={formatCurrency(stats.todayRevenue)}
            icon={TrendingUp}
            colorClass="text-green-400"
            bgClass="bg-green-500/10 border-green-500/20"
          />
          <StatCard
            label="Today's Bills"
            value={stats.todayBillCount}
            icon={Receipt}
            colorClass="text-rose-400"
            bgClass="bg-rose-500/10 border-rose-500/20"
          />
          <StatCard
            label="Avg Bill"
            value={formatCurrency(stats.averageBillValue)}
            icon={DollarSign}
            colorClass="text-indigo-400"
            bgClass="bg-indigo-500/10 border-indigo-500/20"
          />
        </div>
      )}

      {/* ── Ready to Serve Banner ────────────────────────────────────────── */}
      {readyOrdersCount > 0 && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-lg shadow-emerald-950/20 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <Volume2 className="text-white animate-bounce" size={20} />
            </div>
            <div>
              <p className="font-black text-sm tracking-wide">
                {readyOrdersCount} DISHES READY TO SERVE!
              </p>
              <p className="text-emerald-100 text-xs mt-0.5">
                Check tables marked with the green "Ready to Serve" status.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Floor Filter Tabs ────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-slate-900">
        {[
          { id: 'my', label: 'My Tables', show: currentUser?.role !== 'admin' },
          { id: 'active', label: 'Active Floor', show: true },
          { id: 'calling', label: 'Waiter Calls', show: true },
          { id: 'ready', label: 'Ready Foods', show: true },
          { id: 'all', label: 'All Tables', show: true }
        ].filter(tab => tab.show).map(tab => (
          <button
            key={tab.id}
            onClick={() => setTableFilter(tab.id as any)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
              tableFilter === tab.id
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/10'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tables & Customer Hierarchy ──────────────────────────────────── */}
      {groupedTables.length === 0 ? (
        <div className="bg-slate-900/20 rounded-2xl p-16 text-center border border-dashed border-slate-800/80">
          <div className="mx-auto w-14 h-14 bg-slate-900/60 rounded-full flex items-center justify-center text-slate-600 mb-4 border border-slate-800">
            <BellOff size={26} />
          </div>
          <h3 className="text-base font-bold text-slate-200 mb-1">No Tables Match</h3>
          <p className="text-slate-500 text-xs max-w-sm mx-auto">
            {tableFilter === 'ready'
              ? 'No active orders are marked READY right now.'
              : tableFilter === 'calling'
              ? 'No tables are currently calling for assistance.'
              : 'All tables are idle. New orders and waiter requests will appear instantly.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groupedTables.map(({ table, customerGroups, stats }) => {
            const isExpanded = !!expandedTables[table.id];

            // Render different styles for table status
            let borderStyle = 'border-slate-800 bg-slate-900/25';
            let statusBadge = 'bg-slate-800/50 text-slate-400 border-slate-700/50';
            let statusText = 'Idle';

            if (stats.tableStatus === 'CALLING') {
              borderStyle = 'border-rose-500/40 ring-1 ring-rose-500/20 bg-rose-950/5';
              statusBadge = 'bg-rose-500/15 text-rose-400 border-rose-500/25 animate-pulse';
              statusText = 'Calls Waiter';
            } else if (stats.tableStatus === 'READY_TO_SERVE') {
              borderStyle = 'border-emerald-500/40 ring-1 ring-emerald-500/20 bg-emerald-950/5';
              statusBadge = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 animate-pulse';
              statusText = 'Ready to Serve';
            } else if (stats.tableStatus === 'AWAITING_PAYMENT') {
              borderStyle = 'border-sky-500/40 bg-sky-950/5';
              statusBadge = 'bg-sky-500/15 text-sky-400 border-sky-500/25';
              statusText = 'Billing';
            } else if (stats.tableStatus === 'OCCUPIED') {
              borderStyle = 'border-amber-500/30 bg-amber-950/5';
              statusBadge = 'bg-amber-500/15 text-amber-400 border-amber-500/25';
              statusText = 'Occupied';
            }

            return (
              <div
                key={table.id}
                className={`rounded-2xl border ${borderStyle} transition-all duration-350 overflow-hidden shadow-sm`}
              >
                {/* ── Table Card Header ────────────────────────────────────── */}
                <div
                  onClick={() => toggleTableExpand(table.id)}
                  className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-900/30 select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-750 flex items-center justify-center shrink-0">
                      <span className="text-sm font-black text-white">T{table.tableNumber}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                        {statusText}
                      </span>
                      {table.assignedWaiter && (
                        <span className="text-[10px] text-slate-500 font-semibold bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                          {table.assignedWaiter.username}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="flex items-center gap-4 ml-auto sm:ml-0">
                    <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400 font-medium">
                      <div>
                        Customers: <span className="font-bold text-slate-200">{stats.customerCount}</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-slate-700" />
                      <div>
                        Bills: <span className="font-bold text-slate-200">{stats.activeBillsCount}</span>
                      </div>
                      <div className="w-1 h-1 rounded-full bg-slate-700" />
                      <div>
                        Pending Value:{' '}
                        <span className="font-bold text-amber-400">
                          {formatCurrency(stats.totalPendingValue)}
                        </span>
                      </div>
                    </div>

                    {/* Table-level Action Buttons */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {stats.canMergeTable && (
                        <button
                          onClick={() => handleOpenMergeModal(table.id, table.tableNumber, '', stats.tableUnpaidBills)}
                          className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black rounded-lg transition flex items-center gap-1 animate-pulse"
                        >
                          <Layers size={11} />
                          Merge Bills
                        </button>
                      )}
                      {table.callingWaiter && (
                        <button
                          onClick={() => handleDismissCall(table.id)}
                          className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 hover:border-rose-500 text-rose-400 text-[10px] font-bold rounded-lg transition"
                        >
                          Dismiss Call
                        </button>
                      )}
                    </div>

                    <div className="text-slate-500 hover:text-slate-300 transition">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* ── Table Card Content (Expanded) ────────────────────────── */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 border-t border-slate-900/60 bg-slate-950/40">
                    {customerGroups.length === 0 ? (
                      <p className="text-slate-500 text-xs italic py-4 text-center">Table is empty.</p>
                    ) : (
                      <div className="flex flex-col gap-6">
                        {customerGroups.map(group => {
                          const unpaidBills = group.bills.filter(b => b.paymentStatus === 'PENDING');
                          const canMerge = unpaidBills.length >= 2;

                          return (
                            <div key={group.phone} className="flex flex-col gap-3.5 border-t border-slate-900/40 pt-4 first:border-0 first:pt-0">
                              {/* Customer Group Header */}
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-amber-500/80" />
                                  <span className="text-xs font-bold text-slate-200">
                                    {group.customerName}
                                  </span>
                                  <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                    {group.orders.length} order{group.orders.length > 1 ? 's' : ''}
                                  </span>
                                  <span className="text-[10px] text-amber-500 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                                    Total: {formatCurrency(group.totalAmount)}
                                  </span>
                                </div>

                                {canMerge && (
                                  <button
                                    onClick={() => handleOpenMergeModal(table.id, table.tableNumber, group.phone, unpaidBills)}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-[10px] font-black rounded-lg transition"
                                  >
                                    <Layers size={11} />
                                    Merge Unpaid Bills
                                  </button>
                                )}
                              </div>

                              {/* Customer Orders/Bills Subgrid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {group.orders.map(order => {
                                  const currentIdx = STATUS_FLOW.indexOf(order.status);
                                  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;
                                  const meta = STATUS_META[order.status] || STATUS_META['PLACED'];
                                  const Icon = meta.icon;

                                  const isReadyToServe = order.status === 'READY';
                                  const hasBill = !!order.bill;
                                  const canGenerateBill = !hasBill && order.status !== 'PAID' && order.status !== 'CANCELLED' && order.status !== 'MERGED';
                                  const showProgressButton = !hasBill && nextStatus;

                                  // Display identifier
                                  const cardTitle = order.bill
                                    ? `Bill #${order.bill.billNumber}`
                                    : `Order #${order.id.slice(-4).toUpperCase()}`;

                                  return (
                                    <div
                                      key={order.id}
                                      className={`rounded-2xl bg-slate-900/60 border overflow-hidden flex flex-col transition-all hover:border-slate-700/80 duration-200 ${
                                        isReadyToServe ? 'border-emerald-500/40 ring-1 ring-emerald-500/15' : 'border-slate-800/80'
                                      }`}
                                    >
                                      {/* Card Sub-header */}
                                      <div className={`px-4 py-3 flex justify-between items-center bg-slate-900/90 border-b border-slate-800`}>
                                        <div className="flex items-center gap-2">
                                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${meta.bg} border ${meta.border}`}>
                                            <Icon size={12} className={meta.color} />
                                          </div>
                                          <div>
                                            <span className="font-bold text-slate-200 text-xs">{cardTitle}</span>
                                            <p className="text-[9px] text-slate-500">{formatDate(order.createdAt)}</p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                          <LiveTimer createdAt={order.createdAt} />
                                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${meta.color} ${meta.bg} ${meta.border}`}>
                                            {order.bill?.paymentStatus === 'AWAITING_CONFIRMATION' ? 'Awaiting Cash/UPI' : meta.label}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Food Items List */}
                                      <div className="p-4 flex-1">
                                        <ul className="space-y-2">
                                          {order.items.map(item => (
                                            <li key={item.id} className="flex justify-between items-start text-xs text-slate-300">
                                              <div className="min-w-0 flex-1 pr-2">
                                                <span className="font-bold text-amber-500">{item.quantity}×</span>{' '}
                                                <span className="truncate">{item.menuItem?.name || 'Unknown Item'}</span>
                                                {item.specialInstructions && (
                                                  <p className="text-[10px] text-orange-400 mt-0.5 bg-orange-500/5 px-1.5 py-0.5 rounded border border-orange-500/10 inline-block font-mono">
                                                    {item.specialInstructions}
                                                  </p>
                                                )}
                                              </div>
                                              <span className="text-slate-500 shrink-0 font-medium">{formatCurrency(item.price * item.quantity)}</span>
                                            </li>
                                          ))}
                                        </ul>
                                        {order.notes && (
                                          <div className="mt-3 p-2 bg-slate-950/80 text-slate-400 text-[10px] rounded-lg border border-slate-850">
                                            <strong className="text-slate-300">Notes:</strong> {order.notes}
                                          </div>
                                        )}
                                      </div>

                                      {/* Card Footer Actions */}
                                      <div className="p-3 bg-slate-900/40 border-t border-slate-900 flex items-center justify-between gap-3">
                                        <span className="font-extrabold text-slate-200 text-xs">
                                          {formatCurrency(order.bill ? order.bill.total : order.total)}
                                        </span>

                                        <div className="flex gap-1.5 flex-wrap">
                                          {/* Payment verification link */}
                                          {order.bill?.paymentStatus === 'AWAITING_CONFIRMATION' && (
                                            <Link
                                              to={`/bill/${order.bill.id}`}
                                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-slate-950 text-[10px] font-black animate-pulse ${
                                                order.bill.paymentMethod === 'CASH' ? 'bg-emerald-400' : 'bg-sky-400'
                                              }`}
                                            >
                                              <CreditCard size={11} />
                                              Confirm {order.bill.paymentMethod}
                                            </Link>
                                          )}

                                          {/* Generate Bill button */}
                                          {canGenerateBill && (
                                            <button
                                              onClick={() => handleGenerateBill(order.id)}
                                              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg transition border border-slate-750"
                                            >
                                              <Receipt size={11} />
                                              Generate Bill
                                            </button>
                                          )}

                                          {/* Print Receipt button */}
                                          {hasBill && (
                                            <button
                                              onClick={() => handlePrintBill(order.bill!.id)}
                                              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg transition border border-slate-750"
                                            >
                                              <Printer size={11} />
                                              Print
                                            </button>
                                          )}

                                          {/* Progress Order Status button */}
                                          {showProgressButton && (
                                            <button
                                              onClick={() => handleUpdateStatus(order.id, nextStatus)}
                                              className={`flex items-center gap-1 px-2.5 py-1.5 text-slate-950 text-[10px] font-black rounded-lg transition ${
                                                isReadyToServe
                                                  ? 'bg-emerald-400 hover:bg-emerald-500 shadow-md shadow-emerald-950/20'
                                                  : 'bg-amber-400 hover:bg-amber-500'
                                              }`}
                                            >
                                              {nextStatus === 'SERVED' ? 'Mark Served' : `Mark ${nextStatus}`}
                                              <ArrowRight size={11} />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Manual Merge Confirmation Modal ───────────────────────────────── */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-scale-up">
            <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-amber-500" />
                <h3 className="text-base font-black text-white">Manual Bill Merge</h3>
              </div>
              <button
                onClick={() => setShowMergeModal(false)}
                className="text-slate-500 hover:text-white transition text-xs"
              >
                Cancel
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-850 flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Table Number</span>
                  <span className="text-slate-200 font-bold">Table {mergeTableNum}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500 font-medium">Registered Mobile</span>
                  <span className="text-slate-200 font-bold">{mergePhone || 'Multiple / Varies'}</span>
                </div>
              </div>

              {/* Source Bill Select */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                  Source Bill (will be closed/marked merged)
                </label>
                <select
                  value={sourceBillId}
                  onChange={(e) => setSourceBillId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {orders
                    .filter(o => {
                      const matchesTable = o.tableId === mergeTableId;
                      const matchesPhone = !mergePhone || (o.phone_number || 'Guest') === mergePhone;
                      return matchesTable && matchesPhone && o.bill && o.bill.paymentStatus === 'PENDING';
                    })
                    .map(o => (
                      <option key={o.bill!.id} value={o.bill!.id}>
                        Bill #{o.bill!.billNumber} ({o.phone_number || 'Guest'}) - {formatCurrency(o.bill!.total)}
                      </option>
                    ))}
                </select>
              </div>

              {/* Target Bill Select */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                  Target Bill (will absorb items & consolidate totals)
                </label>
                <select
                  value={targetBillId}
                  onChange={(e) => setTargetBillId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {orders
                    .filter(o => {
                      const matchesTable = o.tableId === mergeTableId;
                      const matchesPhone = !mergePhone || (o.phone_number || 'Guest') === mergePhone;
                      return matchesTable && matchesPhone && o.bill && o.bill.paymentStatus === 'PENDING';
                    })
                    .map(o => (
                      <option key={o.bill!.id} value={o.bill!.id} disabled={o.bill!.id === sourceBillId}>
                        Bill #{o.bill!.billNumber} ({o.phone_number || 'Guest'}) - {formatCurrency(o.bill!.total)}
                      </option>
                    ))}
                </select>
              </div>

              {/* Reason input */}
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">
                  Reason for Merge
                </label>
                <input
                  type="text"
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  placeholder="e.g. Guest requested single bill"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Projected Merged Total */}
              {(() => {
                const src = orders.find(o => o.bill?.id === sourceBillId)?.bill;
                const tgt = orders.find(o => o.bill?.id === targetBillId)?.bill;
                if (!src || !tgt) return null;
                return (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex flex-col gap-2">
                    <p className="text-[10px] uppercase tracking-wider text-amber-500 font-extrabold">Merged Bill Summary</p>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Source Bill Total</span>
                      <span>{formatCurrency(src.total)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Target Bill Total</span>
                      <span>{formatCurrency(tgt.total)}</span>
                    </div>
                    <div className="h-[1px] bg-slate-800/80 my-1" />
                    <div className="flex justify-between text-sm font-black text-slate-100">
                      <span>Consolidated Total</span>
                      <span className="text-amber-400">{formatCurrency(src.total + tgt.total)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-900 flex gap-2 justify-end">
              <button
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
              <button
                onClick={handleMergeSubmit}
                disabled={merging || sourceBillId === targetBillId}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 text-xs font-black rounded-xl transition"
              >
                {merging ? 'Merging...' : 'Confirm & Merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
