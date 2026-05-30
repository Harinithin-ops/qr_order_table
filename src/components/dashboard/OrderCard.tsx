import { formatCurrency, formatDate, getStatusColor, ORDER_FLOW } from '@/lib/utils';
import { OrderWithItems } from '@/types';
import { Clock, ChefHat, Check, Receipt, CreditCard, XCircle } from 'lucide-react';

interface Props {
  order: OrderWithItems;
  onUpdateStatus: (id: string, status: string) => void;
  onRequestBill?: (id: string) => void;
}

export function OrderCard({ order, onUpdateStatus, onRequestBill }: Props) {
  const currentIdx = ORDER_FLOW.indexOf(order.status);
  const nextStatus = currentIdx >= 0 && currentIdx < ORDER_FLOW.length - 1 ? ORDER_FLOW[currentIdx + 1] : null;

  return (
    <div className={`bg-white rounded-xl shadow-sm border-l-4 ${getStatusColor(order.status).replace('bg-', 'border-')} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
        <div>
          <span className="font-bold text-gray-900 border border-gray-200 bg-white px-2 py-0.5 rounded text-sm shadow-sm">
            Table {order.table.tableNumber}
          </span>
          <span className="text-xs text-gray-400 ml-2">{formatDate(order.createdAt)}</span>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-bold text-white shadow-sm ${getStatusColor(order.status)}`}>
          {order.status}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1">
        <ul className="space-y-3">
          {order.items.map(item => (
            <li key={item.id} className="flex justify-between items-start text-sm">
              <div>
                <span className="font-semibold text-gray-900">{item.quantity}x</span> {item.menuItem.name}
                {item.specialInstructions && (
                  <p className="text-xs text-red-600 mt-0.5 max-w-[200px] bg-green-50 px-1 rounded inline-block">
                    {item.specialInstructions}
                  </p>
                )}
              </div>
              <span className="text-gray-500 font-medium">{formatCurrency(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>

        {order.notes && (
          <div className="mt-4 p-2 bg-yellow-50 text-yellow-800 text-sm rounded border border-yellow-200">
            <strong>Notes:</strong> {order.notes}
          </div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="p-3 md:p-4 bg-gray-50 border-t border-gray-100 flex flex-nowrap items-center justify-between gap-2">
        <div className="font-bold text-gray-900 text-base md:text-lg shrink-0">
          {formatCurrency(order.total)}
        </div>
        
        <div className="flex gap-1.5 md:gap-2 items-center overflow-x-auto">
          {order.status !== 'PAID' && order.status !== 'CANCELLED' && (
            <button
              onClick={() => {
                if(window.confirm('Cancel this order and remove it from the dashboard?')) onUpdateStatus(order.id, 'CANCELLED');
              }}
              className="text-red-500 hover:bg-red-50 p-1.5 md:p-2 rounded transition shrink-0"
              title="Cancel Order"
            >
              <XCircle size={18} />
            </button>
          )}

          {order.status === 'SERVED' && onRequestBill ? (
            order.bill?.paymentStatus === 'AWAITING_CONFIRMATION' ? (
              <a
                href={`/bill/${order.bill.id}`}
                className={`${order.bill.paymentMethod === 'CASH' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-3 md:px-4 py-1.5 md:py-2 rounded shadow text-xs md:text-sm font-medium flex flex-col items-center gap-0.5 animate-pulse shrink-0`}
              >
                <span className="flex items-center gap-1.5">
                  <CreditCard size={14} /> <span className="whitespace-nowrap">Confirm {order.bill.paymentMethod}</span>
                </span>
              </a>
            ) : (
              <button 
                onClick={() => onRequestBill(order.id)}
                className="bg-gray-900 text-white px-3 md:px-4 py-1.5 md:py-2 rounded shadow text-xs md:text-sm font-medium hover:bg-black flex items-center gap-1.5 shrink-0"
              >
                <Receipt size={14} /> Bill
              </button>
            )
          ) : nextStatus ? (
            <button 
              onClick={() => onUpdateStatus(order.id, nextStatus)}
              className="bg-red-600 text-white px-3 md:px-4 py-1.5 md:py-2 rounded shadow text-xs md:text-sm font-medium hover:bg-red-700 transition whitespace-nowrap shrink-0"
            >
              Mark {nextStatus}
            </button>
          ) : order.status === 'PAID' ? (
            <span className="text-green-600 font-bold flex items-center gap-1 text-xs md:text-sm whitespace-nowrap"><Check size={14}/> Completed</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
