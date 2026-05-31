/**
 * WaiterOrders — Waiter-facing Live Orders view at /waiter/orders.
 *
 * Features a prominent "Mark Complete" button on each order so the waiter
 * can quickly mark an order as SERVED once food has been delivered.
 */
import { useEffect, useState } from 'react';
import { useEventSource } from '@/hooks/useEventSource';
import { WaiterAlerts } from '@/components/dashboard/WaiterAlerts';
import { OrderWithItems } from '@/types';
import {
  Activity,
  BellOff,
  X,
  CheckCircle2,
  Clock,
  ChefHat,
  Bell,
  Utensils,
  Check,
} from 'lucide-react';
import { formatDate, getStatusColor } from '@/lib/utils';

// ─── Status display map ────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; icon: any; pill: string }> = {
  PLACED:    { label: 'New Order',  icon: Bell,         pill: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  ACCEPTED:  { label: 'Accepted',   icon: CheckCircle2, pill: 'bg-blue-100 text-blue-800 border-blue-200'       },
  PREPARING: { label: 'Preparing',  icon: ChefHat,      pill: 'bg-green-100 text-green-800 border-green-200'    },
  READY:     { label: 'Ready!',     icon: CheckCircle2, pill: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  SERVED:    { label: 'Served',     icon: Utensils,     pill: 'bg-purple-100 text-purple-800 border-purple-200' },
  PENDING:   { label: 'Pending',    icon: Clock,        pill: 'bg-orange-100 text-orange-800 border-orange-200' },
  PAID:      { label: 'Paid',       icon: CheckCircle2, pill: 'bg-gray-100 text-gray-600 border-gray-200'       },
};

// Status flow the waiter can advance through
const WAITER_FLOW = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'];

// ─── Individual Order Card ─────────────────────────────────────────────────────
function WaiterOrderCard({
  order,
  onMarkComplete,
  onUpdateStatus,
  completing,
}: {
  order: OrderWithItems;
  onMarkComplete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  completing: boolean;
}) {
  const meta = STATUS_META[order.status] || STATUS_META['PLACED'];
  const Icon = meta.icon;

  // Determine which status comes next in the waiter flow
  const flowIdx = WAITER_FLOW.indexOf(order.status);
  const nextStatus = flowIdx >= 0 && flowIdx < WAITER_FLOW.length - 1 ? WAITER_FLOW[flowIdx + 1] : null;

  // "Mark Complete" = mark as SERVED — applicable when order is READY
  const canMarkComplete = order.status === 'READY';

  const borderColor = getStatusColor(order.status).replace('bg-', 'border-');
  const isReady = order.status === 'READY';

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border-l-4 ${borderColor} overflow-hidden flex flex-col transition-all ${
        isReady ? 'ring-2 ring-emerald-300 ring-offset-1 shadow-emerald-100' : ''
      }`}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-900 border border-gray-200 bg-white px-2 py-0.5 rounded text-sm shadow-sm">
            Table {order.table.tableNumber}
          </span>
          <span className="text-xs text-gray-400">{formatDate(order.createdAt)}</span>
        </div>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${meta.pill}`}>
          <Icon size={11} />
          {meta.label}
        </span>
      </div>

      {/* ── Items ──────────────────────────────────────────────────── */}
      <div className="p-4 flex-1">
        <ul className="space-y-2.5">
          {order.items.map(item => (
            <li key={item.id} className="flex justify-between items-start text-sm">
              <div>
                <span className="font-semibold text-gray-900">{item.quantity}×</span>{' '}
                <span className="text-gray-800">{item.menuItem?.name || 'Unknown Item'}</span>
                {item.specialInstructions && (
                  <p className="text-xs text-amber-700 mt-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block">
                    {item.specialInstructions}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
        {order.notes && (
          <div className="mt-3 p-2 bg-yellow-50 text-yellow-800 text-xs rounded-lg border border-yellow-200">
            <strong>Notes:</strong> {order.notes}
          </div>
        )}
      </div>

      {/* ── MARK COMPLETE button (prominent, full-width) ────────────── */}
      {canMarkComplete && (
        <div className="px-4 pb-3">
          <button
            onClick={() => onMarkComplete(order.id)}
            disabled={completing}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-bold rounded-xl shadow-md shadow-emerald-200 transition-all text-sm disabled:opacity-60"
          >
            {completing ? (
              <>
                <Activity size={16} className="animate-spin" />
                Marking…
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Mark as Served (Complete)
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Footer / secondary actions ──────────────────────────────── */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
        <span className="font-bold text-gray-900 text-sm shrink-0">
          {order.items.length} item{order.items.length !== 1 ? 's' : ''}
        </span>

        <div className="flex gap-1.5 items-center overflow-x-auto">
          {/* Advance status for non-READY orders (smaller secondary button) */}
          {!canMarkComplete && nextStatus && order.status !== 'PAID' && (
            <button
              onClick={() => onUpdateStatus(order.id, nextStatus)}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition shrink-0"
            >
              Mark {nextStatus}
            </button>
          )}

          {/* Completed state */}
          {order.status === 'PAID' && (
            <span className="text-emerald-600 font-bold flex items-center gap-1 text-xs whitespace-nowrap">
              <Check size={14} /> Done
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function WaiterOrders() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{ tableNumber: number | null; method: string | null } | null>(null);
  const { lastEvent } = useEventSource('/api/events');

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) setOrders(await res.json());
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  useEffect(() => {
    if (!lastEvent) return;
    if (!['NEW_ORDER', 'ORDER_UPDATE', 'PAYMENT_SUBMITTED'].includes(lastEvent.type)) return;

    void fetchOrders();

    if (lastEvent.type === 'NEW_ORDER') {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        void audio.play().catch(() => {});
      } catch { /* ignore */ }
    }

    if (lastEvent.type === 'PAYMENT_SUBMITTED' || (lastEvent.type === 'ORDER_UPDATE' && lastEvent.data.status === 'PAID')) {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1389/1389-preview.mp3');
        void audio.play().catch(() => {});
      } catch { /* ignore */ }

      const raw = lastEvent.data.tableNumber;
      let tableNumber: number | null = null;
      if (typeof raw === 'number' && !Number.isNaN(raw)) tableNumber = raw;
      else if (typeof raw === 'string') { const n = parseInt(raw, 10); if (!Number.isNaN(n)) tableNumber = n; }

      setPaymentNotice({ tableNumber, method: (lastEvent.data.paymentMethod as string) || (lastEvent.data.status === 'PAID' ? 'PAID' : 'UPI') });
      const t = window.setTimeout(() => setPaymentNotice(null), 12000);
      return () => clearTimeout(t);
    }
  }, [lastEvent]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Advance order to any status */
  const handleUpdateStatus = async (orderId: string, status: string) => {
    setOrders(curr => curr.map(o => o.id === orderId ? { ...o, status: status as any } : o));
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      console.error(e);
      fetchOrders();
    }
  };

  /** Mark an order as SERVED — the dedicated "Mark Complete" action */
  const handleMarkComplete = async (orderId: string) => {
    setCompletingId(orderId);
    // Optimistic update
    setOrders(curr => curr.map(o => o.id === orderId ? { ...o, status: 'SERVED' as any } : o));
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SERVED' }),
      });
    } catch (e) {
      console.error(e);
      fetchOrders();
    } finally {
      setCompletingId(null);
    }
  };

  /** Generate unified bill for a table — admin only, removed from waiter view */
  // const handleCreateBill = ...

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Activity className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  // Only show orders that are still being worked on — SERVED/PENDING/PAID
  // move to Completed Orders section after the waiter marks them done
  const activeOrders = orders.filter(
    o => !['SERVED', 'PENDING', 'PAID', 'CANCELLED'].includes(o.status)
  );
  const readyCount = activeOrders.filter(o => o.status === 'READY').length;

  return (
    <div className="p-6 md:p-8 animate-slide-up">
      <WaiterAlerts lastEvent={lastEvent} />

      {/* Payment Notice Banner */}
      {paymentNotice && (
        <div
          role="status"
          className={`mb-6 rounded-xl border px-4 py-3 flex items-center justify-between gap-3 shadow-sm ${
            paymentNotice.method === 'PAID' ? 'border-green-200 bg-green-50' :
            paymentNotice.method === 'CASH' ? 'border-emerald-200 bg-emerald-50' :
                                              'border-blue-200 bg-blue-50'
          }`}
        >
          <p className={`text-sm font-semibold ${
            paymentNotice.method === 'PAID' ? 'text-green-900' :
            paymentNotice.method === 'CASH' ? 'text-emerald-900' :
                                              'text-blue-900'
          }`}>
            {paymentNotice.method === 'PAID' ? 'Payment confirmed' :
             paymentNotice.method === 'CASH' ? 'Cash payment requested' :
                                              'UPI payment submitted'}
            {paymentNotice.tableNumber != null ? ` — Table ${paymentNotice.tableNumber}` : ''}. {' '}
            {paymentNotice.method === 'PAID' ? 'Bill marked paid.' : 'Please verify.'}
          </p>
          <button
            type="button"
            onClick={() => setPaymentNotice(null)}
            className="shrink-0 p-1.5 rounded-lg hover:bg-black/5 transition"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Ready-to-serve banner */}
      {readyCount > 0 && (
        <div className="mb-5 bg-emerald-500 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-md shadow-emerald-200">
          <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center shrink-0 animate-bounce">
            <CheckCircle2 size={20} />
          </div>
          <p className="font-bold text-sm">
            {readyCount} order{readyCount > 1 ? 's are' : ' is'} ready — tap <span className="underline">Mark as Served</span> to complete!
          </p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">Live Orders</h1>
          <p className="text-sm text-gray-500">Tap <strong>Mark as Served</strong> once food is delivered to the table</p>
        </div>
        <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1 self-start sm:self-auto overflow-hidden">
          <div className="px-3 md:px-4 py-1.5 md:py-2 flex items-center gap-2 border-r border-gray-100">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-semibold text-sm md:text-base">{activeOrders.length}</span>
            <span className="text-xs md:text-sm text-gray-600">Active</span>
          </div>
          {readyCount > 0 && (
            <div className="px-3 md:px-4 py-1.5 md:py-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-700">{readyCount} Ready</span>
            </div>
          )}
        </div>
      </div>

      {/* Orders Grid */}
      {activeOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
          <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
            <BellOff size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No active orders</h3>
          <p className="text-gray-500">New orders from tables will appear here instantly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {activeOrders.map(order => (
            <WaiterOrderCard
              key={order.id}
              order={order}
              onMarkComplete={handleMarkComplete}
              onUpdateStatus={handleUpdateStatus}
              completing={completingId === order.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
