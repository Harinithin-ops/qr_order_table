import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useEventSource } from '@/hooks/useEventSource';
import { getStatusColor, ORDER_FLOW } from '@/lib/utils';
import {
  Check,
  Clock,
  ChefHat,
  CheckCircle2,
  DollarSign,
  Receipt,
  Smartphone,
  HandPlatter,
} from 'lucide-react';
import { OrderWithItems } from '@/types';

interface Props {
  orderId: string;
  /** Menu URL segment (table id or slug); required to confirm receipt. */
  tableId: string;
  onCompleted?: () => void;
}

export function OrderTracker({ orderId, tableId, onCompleted }: Props) {
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [markingReceived, setMarkingReceived] = useState(false);
  const [markReceivedError, setMarkReceivedError] = useState('');
  const { lastEvent } = useEventSource('/api/events');

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      }
    } catch (e) {
      console.error(e);
    }
  }, [orderId]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      fetchOrder();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchOrder]);

  useEffect(() => {
    if (order?.status === 'PAID') {
      const timer = setTimeout(() => {
        if (onCompleted) onCompleted();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [order?.status, onCompleted]);

  useEffect(() => {
    if (lastEvent?.type !== 'ORDER_UPDATE') return;
    const payload = lastEvent.data as { orderId?: string };
    if (payload.orderId !== orderId) return;
    const t = window.setTimeout(() => {
      fetchOrder();
    }, 0);
    return () => clearTimeout(t);
  }, [lastEvent, orderId, fetchOrder]);

  const handleMarkReceived = async () => {
    setMarkReceivedError('');
    setMarkingReceived(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/mark-received`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMarkReceivedError(typeof data.error === 'string' ? data.error : 'Could not update. Try again.');
        return;
      }
      await fetchOrder();
    } catch {
      setMarkReceivedError('Network error. Please try again.');
    } finally {
      setMarkingReceived(false);
    }
  };

  if (!order) return null;

  const currentIdx = ORDER_FLOW.indexOf(order.status);

  const getIcon = (status: string) => {
    switch (status) {
      case 'PLACED':
        return <Clock size={16} />;
      case 'ACCEPTED':
        return <Check size={16} />;
      case 'PREPARING':
        return <ChefHat size={16} />;
      case 'READY':
        return <CheckCircle2 size={16} />;
      case 'SERVED':
        return <CheckCircle2 size={16} />;
      case 'PAID':
        return <DollarSign size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const isCompleted = ['SERVED', 'PAID'].includes(order.status);
  const billId = order.bill?.id;
  const awaitingUpi = order.bill?.paymentStatus === 'AWAITING_CONFIRMATION';

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Clock className="text-green-600" size={18} /> Order Tracker
        </h3>
        {isCompleted && (
          <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">
            {order.status === 'PAID' ? 'Paid & Completed' : 'Served'}
          </span>
        )}
        {order.status === 'PENDING' && (
          <span
            className={`text-xs font-bold px-2 py-1 rounded text-white shadow-sm ${getStatusColor(order.status)}`}
          >
            Bill ready
          </span>
        )}
      </div>

      <div className="relative pt-2 pb-6 px-2">
        <div className="absolute top-6 left-[10%] right-[10%] h-1 bg-gray-100 -z-10 rounded"></div>

        <div
          className="absolute top-6 left-[10%] h-1 bg-green-600 -z-10 rounded transition-all duration-500"
          style={{ width: `${Math.max(0, (currentIdx / (ORDER_FLOW.length - 2)) * 80)}%` }}
        ></div>

        <div className="flex justify-between relative">
          {['PLACED', 'PREPARING', 'READY'].map((status) => {
            const stepIdx = ORDER_FLOW.indexOf(status);
            const isPast = currentIdx >= stepIdx;
            const isCurrent =
              currentIdx === stepIdx || (status === 'READY' && order.status === 'SERVED');

            return (
              <div key={status} className="flex flex-col items-center gap-2 relative">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isPast
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-white border-gray-200 text-gray-400'
                  } ${isCurrent ? 'ring-4 ring-green-100' : ''}`}
                >
                  {getIcon(status)}
                </div>
                <span className={`text-[10px] font-bold ${isPast ? 'text-gray-900' : 'text-gray-400'}`}>
                  {status === 'PLACED' ? 'Sent' : status === 'PREPARING' ? 'Cooking' : 'Ready'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {order.status === 'READY' && (
        <div className="mt-2 pt-4 border-t border-green-100 text-center space-y-3">
          <p className="text-sm font-medium text-gray-800 px-1">Has your order been brought to the table?</p>
          {markReceivedError && (
            <p className="text-xs text-red-600 px-2" role="alert">
              {markReceivedError}
            </p>
          )}
          <button
            type="button"
            disabled={markingReceived}
            onClick={handleMarkReceived}
            className="w-full bg-green-600 text-white px-6 py-3 rounded-full font-bold shadow-md flex items-center justify-center gap-2 hover:bg-green-700 transition disabled:opacity-60"
          >
            <HandPlatter size={18} />
            {markingReceived ? 'Saving…' : "I've received my order"}
          </button>
          <p className="text-[11px] text-gray-500 px-2">
            After you confirm, you can request payment when your bill is ready from the staff.
          </p>
        </div>
      )}

      {order.status === 'SERVED' && (
        <div className="mt-2 pt-4 border-t border-gray-100 text-center animate-slide-up">
          <p className="text-sm text-gray-500 mb-3">Hope you enjoyed the meal!</p>
          <p className="text-xs text-gray-500 px-1 mb-3">
            When you are ready to leave, your server will generate your bill. Keep this page open — a
            &quot;Pay online&quot; button will appear here as soon as your bill is ready.
          </p>
        </div>
      )}

      {order.status === 'PENDING' && (
        <div className="mt-2 pt-4 border-t border-gray-100 text-center animate-slide-up bg-green-50 -mx-4 -mb-4 px-4 py-6 rounded-b-xl border-t border-green-200">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-red-600">
            <Receipt size={24} />
          </div>
          <p className="text-lg font-bold text-gray-900 mb-1">Your Bill is Ready!</p>

          {awaitingUpi && billId ? (
            <>
              <p className="text-sm text-gray-600 mb-4 px-2">
                We received your payment reference. The restaurant is confirming it — this usually takes a
                moment.
              </p>
              <Link
                to={`/checkout/${tableId}`}
                className="bg-amber-600 text-white px-6 py-3 rounded-full font-bold shadow-lg w-full flex items-center justify-center gap-2 hover:bg-amber-700 transition"
              >
                <Smartphone size={18} /> View payment status
              </Link>
            </>
          ) : billId ? (
            <>
              <p className="text-sm text-gray-600 mb-4 px-2">
                Pay from your phone with UPI, Google Pay, PhonePe, or any UPI app. You will get a digital
                receipt here after payment is confirmed.
              </p>
              <Link
                to={`/checkout/${tableId}`}
                className="bg-red-600 text-white px-6 py-3 rounded-full font-bold shadow-lg w-full flex items-center justify-center gap-2 hover:bg-red-700 transition"
              >
                <Smartphone size={18} /> Pay online (UPI / GPay)
              </Link>
            </>
          ) : (
            <p className="text-sm text-gray-600 px-2">Loading your bill…</p>
          )}
        </div>
      )}
    </div>
  );
}
