import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { OrderWithItems } from '@/types';
import { useEventSource } from '@/hooks/useEventSource';
import { formatCurrency, formatDate, HOTEL_NAME, getStatusColor, ORDER_FLOW } from '@/lib/utils';
import { 
  ArrowLeft, 
  Clock, 
  Check, 
  ChefHat, 
  CheckCircle2, 
  DollarSign, 
  Receipt, 
  Utensils, 
  CreditCard 
} from 'lucide-react';

export default function TrackOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Realtime updates via Server-Sent Events
  const { lastEvent } = useEventSource('/api/events');

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      }
    } catch (e) {
      console.error('Error fetching order:', e);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (lastEvent?.type !== 'ORDER_UPDATE') return;
    const payload = lastEvent.data as { orderId?: string };
    if (payload.orderId !== orderId) return;
    
    // Slight delay to allow DB trans to commit before querying
    const timer = setTimeout(() => {
      fetchOrder();
    }, 500);
    return () => clearTimeout(timer);
  }, [lastEvent, orderId, fetchOrder]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Clock className="animate-spin text-green-600" size={40} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <Receipt size={48} className="text-gray-300 mb-3" />
        <h2 className="text-xl font-bold text-gray-800 mb-1">Order Not Found</h2>
        <p className="text-gray-500 text-sm mb-6">We couldn't retrieve the details for this order.</p>
        <Link 
          to="/"
          className="bg-red-600 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-md"
        >
          Go Home
        </Link>
      </div>
    );
  }

  const currentIdx = ORDER_FLOW.indexOf(order.status);
  const isServed = order.status === 'SERVED';
  const isPending = order.status === 'PENDING';
  const isPaid = order.status === 'PAID';
  
  // Calculate tax and totals on-the-fly if bill is not generated yet
  const taxRate = 0.02; // Standard 2% GST
  const subtotal = order.total;
  const taxAmount = subtotal * taxRate;
  const totalAmount = subtotal + taxAmount;

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'PLACED':
        return <Clock size={18} />;
      case 'ACCEPTED':
        return <Check size={18} />;
      case 'PREPARING':
        return <ChefHat size={18} />;
      case 'READY':
      case 'SERVED':
        return <CheckCircle2 size={18} />;
      case 'PAID':
        return <DollarSign size={18} />;
      default:
        return <Clock size={18} />;
    }
  };

  const statusDisplayNames: Record<string, string> = {
    PLACED: 'Sent to Kitchen',
    ACCEPTED: 'Accepted',
    PREPARING: 'Cooking',
    READY: 'Ready for pickup',
    SERVED: 'Served',
    PENDING: 'Bill Generated',
    PAID: 'Paid & Completed',
    CANCELLED: 'Cancelled'
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto shadow-xl flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button 
          onClick={() => navigate(`/menu/${order.table.slug || order.tableId}`)}
          className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 mr-3 transition"
          aria-label="Back to menu"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900 leading-tight">Track Order</h1>
          <p className="text-[11px] text-gray-500 font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full inline-block mt-0.5">
            Table {order.table.tableNumber}
          </p>
        </div>
        <Link
          to={`/menu/${order.table.slug || order.tableId}`}
          className="text-xs font-bold text-red-600 flex items-center gap-1 hover:underline"
        >
          <Utensils size={14} /> Menu
        </Link>
      </div>

      <div className="p-4 space-y-5 flex-1">
        {/* Status Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-green-600"></div>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Current Status</span>
          <h2 className="text-xl font-extrabold text-gray-900 mb-1">
            {statusDisplayNames[order.status] || order.status}
          </h2>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            {order.status === 'PLACED' && 'Waiting for the kitchen to accept your order.'}
            {order.status === 'PREPARING' && 'The chef is preparing your delicious meal.'}
            {order.status === 'READY' && 'Your order is hot and ready to be served.'}
            {order.status === 'SERVED' && 'Enjoy your meal! Let us know when you need to pay.'}
            {order.status === 'PENDING' && 'Order closed. Click pay below to settle the bill.'}
            {order.status === 'PAID' && 'Thank you for dining with us! Have a nice day.'}
          </p>
        </div>

        {/* Realtime Progress Steps */}
        {order.status !== 'CANCELLED' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider mb-5">Order Progress</h3>
            
            <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
              {['PLACED', 'PREPARING', 'READY', 'SERVED'].map((step, idx) => {
                const stepIdx = ORDER_FLOW.indexOf(step);
                const isPast = currentIdx >= stepIdx;
                const isCurrent = currentIdx === stepIdx;

                return (
                  <div key={step} className="relative flex items-start gap-4">
                    {/* Circle Indicator */}
                    <div 
                      className={`absolute -left-[20px] w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 ${
                        isPast 
                          ? 'bg-green-600 border-green-600 text-white' 
                          : 'bg-white border-gray-200 text-gray-400'
                      } ${isCurrent ? 'ring-4 ring-green-100 scale-110' : ''}`}
                    >
                      {isPast ? <Check size={12} /> : getStepIcon(step)}
                    </div>
                    
                    <div className="pt-0.5">
                      <span className={`text-xs font-bold block ${isPast ? 'text-gray-900' : 'text-gray-400'}`}>
                        {step === 'PLACED' ? 'Sent' : step === 'PREPARING' ? 'Preparing' : step === 'READY' ? 'Ready' : 'Served'}
                      </span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        {step === 'PLACED' && 'Kitchen notified'}
                        {step === 'PREPARING' && 'Chef started prep'}
                        {step === 'READY' && 'Left the kitchen'}
                        {step === 'SERVED' && 'At your table'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transaction Details (Items & Pricing) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-3">
            <Receipt size={16} className="text-gray-400" />
            <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">Transaction Details</h3>
          </div>

          <div className="space-y-3.5 divide-y divide-gray-50">
            {order.items.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0">
                <div className="flex justify-between text-sm items-start">
                  <div className="flex-1 pr-4">
                    <p className="font-bold text-gray-800 text-xs">
                      {item.menuItem.name}
                    </p>
                    {item.specialInstructions && (
                      <p className="text-[10px] text-red-500 italic mt-0.5">
                        *{item.specialInstructions}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-900">
                      {item.quantity} x {formatCurrency(item.price)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {formatCurrency(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 mt-4 pt-4 space-y-1.5 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST ({taxRate * 100}%)</span>
              <span>{formatCurrency(taxAmount)}</span>
            </div>
            
            <div className="flex justify-between text-sm font-extrabold text-gray-950 border-t border-dashed border-gray-200 pt-2 mt-2">
              <span>Estimated Total</span>
              <span>{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Order Notes</p>
            <p className="text-xs text-gray-700 italic">"{order.notes}"</p>
          </div>
        )}
      </div>

      {/* Sticky Bottom Actions */}
      <div className="p-4 bg-white border-t border-gray-150 shadow-lg sticky bottom-0 z-10 flex flex-col gap-2">
        <Link
          to={`/payment/${orderId}`}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/10 active:scale-95 transition cursor-pointer text-sm"
        >
          <CreditCard size={18} />
          {isPaid ? 'View Bill Receipt' : isPending ? 'Go to Payment (Bill Ready)' : 'Proceed to Payment / Bill'}
        </Link>
        <button
          onClick={() => navigate(`/menu/${order.table.slug || order.tableId}`)}
          className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-bold py-2.5 rounded-xl text-xs transition active:scale-95"
        >
          Add More Items / Return to Menu
        </button>
      </div>
    </div>
  );
}
