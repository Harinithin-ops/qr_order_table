import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventSource } from '@/hooks/useEventSource';
import { OrderCard } from '@/components/dashboard/OrderCard';
import { WaiterAlerts } from '@/components/dashboard/WaiterAlerts';
import { OrderWithItems } from '@/types';
import { Activity, BellOff, Layers, X } from 'lucide-react';

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentNotice, setPaymentNotice] = useState<{ tableNumber: number | null, method: string | null } | null>(null);
  const { lastEvent } = useEventSource('/api/events');
  const navigate = useNavigate();

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

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
      else if (typeof raw === 'string') {
        const n = parseInt(raw, 10);
        if (!Number.isNaN(n)) tableNumber = n;
      }

      setPaymentNotice({ 
        tableNumber, 
        method: (lastEvent.data.paymentMethod as string) || (lastEvent.data.status === 'PAID' ? 'PAID' : 'UPI') 
      });
      
      const t = window.setTimeout(() => setPaymentNotice(null), 12000);
      return () => clearTimeout(t);
    }
  }, [lastEvent]);

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      // Optimistic update
      setOrders(current => 
        current.map(o => o.id === orderId ? { ...o, status: status as any } : o)
      );

      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (e) {
      console.error(e);
      fetchOrders(); // Revert on failure
    }
  };

  const handleCreateBill = async (orderId: string) => {
    try {
      const orderObj = orders.find(o => o.id === orderId);
      if (!orderObj) return;

      const res = await fetch(`/api/tables/${orderObj.tableId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        const bill = await res.json();
        // Redirect to bill page
        navigate(`/bill/${bill.id}`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to generate unified bill for table.');
      }
    } catch (e) {
      console.error('Failed to create bill:', e);
      alert('Network error generating bill.');
    }
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Activity className="animate-spin text-green-600" size={32} /></div>;
  }

  // Filter out paid orders for the active view
  const activeOrders = orders.filter(o => o.status !== 'PAID');

  return (
    <div className="p-6 md:p-8 animate-slide-up">
      <WaiterAlerts lastEvent={lastEvent} />

      {paymentNotice && (
        <div
          role="status"
          className={`mb-6 rounded-xl border px-4 py-3 flex items-center justify-between gap-3 shadow-sm ${
            paymentNotice.method === 'PAID' ? 'border-green-200 bg-green-50' : 
            paymentNotice.method === 'CASH' ? 'border-emerald-200 bg-emerald-50' : 'border-blue-200 bg-blue-50'
          }`}
        >
          <p className={`text-sm font-semibold ${
            paymentNotice.method === 'PAID' ? 'text-green-900' : 
            paymentNotice.method === 'CASH' ? 'text-emerald-900' : 'text-blue-900'
          }`}>
            {paymentNotice.method === 'PAID' ? 'Payment confirmed' : 
             paymentNotice.method === 'CASH' ? 'Cash payment requested' : 'UPI payment submitted'}
            {paymentNotice.tableNumber != null ? ` — Table ${paymentNotice.tableNumber}` : ''}. 
            {paymentNotice.method === 'PAID' ? ' Bill marked paid.' : ' Please verify.'}
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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 font-serif mb-1">Live Dashboard</h1>
          <p className="text-sm text-gray-500">Manage orders and requests</p>
        </div>
        
        <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1 self-start sm:self-auto overflow-hidden">
          <div className="px-3 md:px-4 py-1.5 md:py-2 flex items-center gap-2 border-r border-gray-100">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="font-semibold text-sm md:text-base">{activeOrders.length}</span>
            <span className="text-xs md:text-sm text-gray-600">Active</span>
          </div>
          <div className="px-3 md:px-4 py-1.5 md:py-2 flex items-center gap-2">
             <span className="text-[10px] md:text-sm font-medium text-gray-500">SSE Connected</span>
          </div>
        </div>
      </div>

      {activeOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
          <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
            <BellOff size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No active orders</h3>
          <p className="text-gray-500">New orders from tables will appear here instantly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {activeOrders.map(order => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onUpdateStatus={handleUpdateStatus} 
              onRequestBill={handleCreateBill}
            />
          ))}
        </div>
      )}
    </div>
  );
}
