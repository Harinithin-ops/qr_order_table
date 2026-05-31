import { useEffect, useState } from 'react';
import { useEventSource } from '@/hooks/useEventSource';
import { WaiterAlerts } from '@/components/dashboard/WaiterAlerts';
import { formatDate } from '@/lib/utils';
import {
  Activity,
  CheckCircle2,
  Search,
  RefreshCw,
  Clock,
  Utensils,
} from 'lucide-react';

interface CompletedOrder {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  table: { tableNumber: number };
  items: { id: string; quantity: number; menuItem: { name: string } }[];
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  SERVED:  { label: 'Food Served',      color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200' },
  PENDING: { label: 'Awaiting Payment', color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  PAID:    { label: 'Fully Paid',       color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

export default function WaiterCompleted() {
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const { lastEvent } = useEventSource('/api/events');

  const fetchCompleted = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch('/api/orders?status=completed');
      if (res.ok) {
        setOrders(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch completed orders:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCompleted(true);
  }, []);

  // Refresh when an order is updated via SSE
  useEffect(() => {
    if (!lastEvent) return;
    if (['ORDER_UPDATE', 'NEW_ORDER', 'PAYMENT_SUBMITTED'].includes(lastEvent.type)) {
      void fetchCompleted(true);
    }
  }, [lastEvent]);

  const filtered = orders.filter(o =>
    o.table.tableNumber.toString().includes(search) ||
    o.items.some(item => item.menuItem.name.toLowerCase().includes(search.toLowerCase())) ||
    (o.status ? o.status.toLowerCase().includes(search.toLowerCase()) : false)
  );

  const todayOrders = orders.filter(
    o => new Date(o.createdAt).toDateString() === new Date().toDateString()
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Activity className="animate-spin text-amber-500 mx-auto" size={36} />
          <p className="text-gray-500 text-sm">Loading completed orders…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 animate-slide-up">
      <WaiterAlerts lastEvent={lastEvent} />

      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 size={20} className="text-emerald-500" />
            Completed Orders
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">All served and paid orders</p>
        </div>
        <button
          onClick={() => fetchCompleted()}
          disabled={refreshing}
          className="p-2 rounded-xl bg-white border border-gray-200 hover:border-amber-300 shadow-sm transition"
          title="Refresh"
        >
          <RefreshCw size={16} className={`text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Today's Orders</p>
          <p className="text-2xl font-black text-amber-600">{todayOrders}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Total Completed</p>
          <p className="text-2xl font-black text-emerald-600">{orders.length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by table or food items…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm"
        />
      </div>

      {/* Orders List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
          <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-300 mb-4">
            <CheckCircle2 size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">
            {search ? 'No results found' : 'No completed orders yet'}
          </h3>
          <p className="text-gray-500 text-sm">
            {search ? 'Try a different search term.' : 'Orders marked as served or completed will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const isToday = new Date(order.createdAt).toDateString() === new Date().toDateString();
            const itemCount = order.items.reduce((s, i) => s + i.quantity, 0);
            const statusInfo = STATUS_META[order.status] || {
              label: order.status,
              color: 'text-gray-700',
              bg: 'bg-gray-50',
              border: 'border-gray-200'
            };

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all overflow-hidden"
              >
                {/* Card Top */}
                <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">Table {order.table.tableNumber}</span>
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            Today
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={11} className="text-gray-400" />
                        <span className="text-[11px] text-gray-400">{formatDate(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-400 font-semibold mt-1">{itemCount} item{itemCount !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                {/* Items preview */}
                <div className="px-4 py-2.5 bg-gray-50/60">
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">
                    {order.items.map(item => `${item.quantity}× ${item.menuItem.name}`).join(', ')}
                  </p>
                  {order.notes && (
                    <p className="text-[11px] text-amber-800 mt-1 bg-amber-50 px-2 py-1 rounded border border-amber-100 inline-block font-medium">
                      Note: {order.notes}
                    </p>
                  )}
                </div>

                {/* Card Bottom */}
                <div className="flex items-center justify-between px-4 py-3 bg-white">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${statusInfo.color} ${statusInfo.bg} border ${statusInfo.border}`}>
                    <Utensils size={13} />
                    {statusInfo.label}
                  </div>
                  <span className="text-[11px] text-gray-400 font-mono">
                    ID: #{order.id.slice(-6).toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
