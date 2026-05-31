import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEventSource } from '@/hooks/useEventSource';
import { WaiterAlerts } from '@/components/dashboard/WaiterAlerts';
import { OrderWithItems } from '@/types';
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
} from 'lucide-react';
import { formatCurrency, formatDate, HOTEL_NAME } from '@/lib/utils';

const STATUS_FLOW = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'];

const STATUS_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  PLACED:    { label: 'New Order',  icon: Bell,          color: 'text-yellow-700', bg: 'bg-yellow-50',  border: 'border-yellow-200' },
  ACCEPTED:  { label: 'Accepted',   icon: CheckCircle2,  color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  PREPARING: { label: 'Preparing',  icon: ChefHat,       color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
  READY:     { label: 'Ready!',     icon: CheckCircle2,  color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-200' },
  SERVED:    { label: 'Served',     icon: Utensils,      color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200' },
  PENDING:   { label: 'Pending',    icon: Clock,         color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  PAID:      { label: 'Paid',       icon: CheckCircle2,  color: 'text-gray-500',   bg: 'bg-gray-50',    border: 'border-gray-200' },
};

function WaiterOrderCard({ order, onUpdateStatus, onRequestBill }: {
  order: OrderWithItems;
  onUpdateStatus: (id: string, status: string) => void;
  onRequestBill: (id: string) => void;
}) {
  const currentIdx = STATUS_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;
  const meta = STATUS_META[order.status] || STATUS_META['PLACED'];
  const Icon = meta.icon;

  const isReadyToServe = order.status === 'READY';
  const canBill = order.status === 'SERVED' || order.status === 'PENDING';

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all ${
      isReadyToServe ? 'border-emerald-400 ring-2 ring-emerald-300 ring-offset-1' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className={`px-4 py-3 flex justify-between items-center ${meta.bg} border-b ${meta.border}`}>
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg} border ${meta.border}`}>
            <Icon size={16} className={meta.color} />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm">Table {order.table.tableNumber}</span>
            <p className="text-[10px] text-gray-500">{formatDate(order.createdAt)}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${meta.color} ${meta.bg} border ${meta.border}`}>
          {meta.label}
        </span>
      </div>

      {/* Items */}
      <div className="p-4 flex-1">
        <ul className="space-y-2.5">
          {order.items.map(item => (
            <li key={item.id} className="flex justify-between items-start text-sm">
              <div>
                <span className="font-bold text-gray-900">{item.quantity}×</span>{' '}
                <span className="text-gray-800">{item.menuItem.name}</span>
                {item.specialInstructions && (
                  <p className="text-xs text-amber-700 mt-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                    {item.specialInstructions}
                  </p>
                )}
              </div>
              <span className="text-gray-500 font-medium text-xs">{formatCurrency(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        {order.notes && (
          <div className="mt-3 p-2 bg-yellow-50 text-yellow-800 text-xs rounded-lg border border-yellow-200">
            <strong>Notes:</strong> {order.notes}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
        <span className="font-bold text-gray-900 text-sm">{formatCurrency(order.total)}</span>

        <div className="flex gap-2">
          {/* Payment confirmation */}
          {order.bill?.paymentStatus === 'AWAITING_CONFIRMATION' && (
            <Link
              to={`/bill/${order.bill.id}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold animate-pulse ${
                order.bill.paymentMethod === 'CASH' ? 'bg-emerald-600' : 'bg-blue-600'
              }`}
            >
              <CreditCard size={13} />
              Confirm {order.bill.paymentMethod}
            </Link>
          )}

          {/* Generate bill */}
          {canBill && !order.bill && (
            <button
              onClick={() => onRequestBill(order.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-black transition"
            >
              <Receipt size={13} />
              Bill
            </button>
          )}

          {/* Advance status */}
          {!canBill && nextStatus && order.bill?.paymentStatus !== 'AWAITING_CONFIRMATION' && (
            <button
              onClick={() => onUpdateStatus(order.id, nextStatus)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition ${
                isReadyToServe
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-200'
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {nextStatus === 'SERVED' ? 'Mark Served' : `Mark ${nextStatus}`}
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex flex-col items-center bg-white rounded-xl px-4 py-2 border border-gray-100 shadow-sm min-w-[72px]">
      <span className={`text-lg font-bold ${color}`}>{count}</span>
      <span className="text-[10px] text-gray-500 font-medium">{label}</span>
    </div>
  );
}

// ─── Main Floor View Page ───────────────────────────────────────────────────────
export default function WaiterDashboard() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'ready' | 'active'>('all');
  const { lastEvent } = useEventSource('/api/events');
  const navigate = useNavigate();

  const fetchOrders = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/orders', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders(true);
  }, []);

  useEffect(() => {
    if (!lastEvent) return;
    if (['NEW_ORDER', 'ORDER_UPDATE', 'PAYMENT_SUBMITTED'].includes(lastEvent.type)) {
      void fetchOrders(true);
      if (lastEvent.type === 'NEW_ORDER') {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          void audio.play().catch(() => {});
        } catch { /* ignore */ }
      }
    }
  }, [lastEvent]);

  const handleUpdateStatus = async (orderId: string, status: string) => {
    setOrders(curr => curr.map(o => o.id === orderId ? { ...o, status: status as any } : o));
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      console.error(e);
      fetchOrders(true);
    }
  };

  const handleRequestBill = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    try {
      const res = await fetch(`/api/tables/${order.tableId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const bill = await res.json();
        navigate(`/bill/${bill.id}`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to generate bill.');
      }
    } catch {
      alert('Network error generating bill.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Activity className="animate-spin text-amber-500 mx-auto" size={36} />
          <p className="text-gray-500 text-sm">Loading orders…</p>
        </div>
      </div>
    );
  }

  const activeOrders = orders.filter(o => o.status !== 'PAID' && o.status !== 'CANCELLED');
  const readyOrders  = activeOrders.filter(o => o.status === 'READY');
  const servedOrders = activeOrders.filter(o => o.status === 'SERVED' || o.status === 'PENDING');
  const newOrders    = activeOrders.filter(o => o.status === 'PLACED');

  const displayed =
    filter === 'ready'  ? readyOrders :
    filter === 'active' ? activeOrders.filter(o => !['SERVED', 'PENDING'].includes(o.status)) :
    activeOrders;

  return (
    <div className="p-4 md:p-6 animate-slide-up">
      {/* Waiter Alerts (bell calls) */}
      <WaiterAlerts lastEvent={lastEvent} />

      {/* Page Title */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Floor View</h1>
          <p className="text-sm text-gray-500">Real-time table & order status</p>
        </div>
        <button
          onClick={() => fetchOrders()}
          disabled={refreshing}
          className="p-2 rounded-xl bg-white border border-gray-200 hover:border-amber-300 shadow-sm transition"
          title="Refresh"
        >
          <RefreshCw size={16} className={`text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4">
        <StatPill label="Active"  count={activeOrders.length} color="text-amber-600" />
        <StatPill label="New"     count={newOrders.length}    color="text-yellow-600" />
        <StatPill label="Ready!"  count={readyOrders.length}  color="text-emerald-600" />
        <StatPill label="Served"  count={servedOrders.length} color="text-purple-600" />
        <div className="ml-auto flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm shrink-0">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-gray-500 font-medium">Live</span>
        </div>
      </div>

      {/* Ready-to-Serve Banner */}
      {readyOrders.length > 0 && (
        <div className="mb-4 bg-emerald-500 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-md shadow-emerald-200">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center shrink-0 animate-bounce">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="font-bold text-sm">
              {readyOrders.length} order{readyOrders.length > 1 ? 's' : ''} ready to serve!
            </p>
            <p className="text-emerald-100 text-xs">
              {readyOrders.map(o => `Table ${o.table.tableNumber}`).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'ready', 'active'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition ${
              filter === tab
                ? 'bg-amber-500 text-white border-amber-500 shadow'
                : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
            }`}
          >
            {tab === 'all' ? `All (${activeOrders.length})` : tab === 'ready' ? `Ready (${readyOrders.length})` : 'In Progress'}
          </button>
        ))}
      </div>

      {/* Order Grid */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
          <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-300 mb-4">
            <BellOff size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No orders here</h3>
          <p className="text-gray-500 text-sm">
            {filter === 'ready' ? 'No orders are ready to serve yet.' : 'New orders will appear here in real-time.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map(order => (
            <WaiterOrderCard
              key={order.id}
              order={order}
              onUpdateStatus={handleUpdateStatus}
              onRequestBill={handleRequestBill}
            />
          ))}
        </div>
      )}

      {/* Table Overview */}
      {activeOrders.length > 0 && (
        <div className="mt-8 mb-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <LayoutGrid size={15} className="text-amber-500" />
            Table Overview
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {activeOrders.map(order => {
              const meta = STATUS_META[order.status];
              return (
                <div
                  key={order.id}
                  className={`rounded-xl p-3 text-center border ${meta?.border || 'border-gray-200'} ${meta?.bg || 'bg-gray-50'}`}
                >
                  <p className={`text-lg font-black ${meta?.color || 'text-gray-700'}`}>
                    T{order.table.tableNumber}
                  </p>
                  <p className={`text-[10px] font-semibold ${meta?.color || 'text-gray-500'}`}>
                    {meta?.label || order.status}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
