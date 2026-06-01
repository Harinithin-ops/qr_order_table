import { useEffect, useState, useCallback } from 'react';
import { useEventSource } from '@/hooks/useEventSource';
import { WaiterAlerts } from '@/components/dashboard/WaiterAlerts';

import {
  ClipboardList, ChevronDown, ChevronUp, Plus, Receipt,
  CheckCircle2, Activity, Utensils, CreditCard, Banknote,
  AlertCircle, Package, X
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface MenuItem { id: string; name: string; price: number; }
interface OrderItem { id: string; quantity: number; price: number; menuItem: MenuItem; }
interface TableInfo { id: string; tableNumber: number; }
interface Order {
  id: string;
  status: string;
  total: number;
  notes: string | null;
  createdAt: string;
  tableId: string;
  table: TableInfo;
  items: OrderItem[];
}
interface CustomItem { name: string; price: number; quantity: number; }
interface Bill {
  id: string;
  billNumber: string;
  orderId: string;
  subtotal: number;
  taxAmount: number;
  discount: number;
  total: number;
  paymentStatus: string;
  paymentMethod: string | null;
  customItems: string; // JSON string
  order: Order & { table: TableInfo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n: number) => `₹${n.toFixed(2)}`;
const parseCustomItems = (raw: string): CustomItem[] => {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
};

const STATUS_COLORS: Record<string, string> = {
  PLACED:   'bg-blue-50 text-blue-700 border-blue-200',
  PREPARING:'bg-amber-50 text-amber-700 border-amber-200',
  READY:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  SERVED:   'bg-purple-50 text-purple-700 border-purple-200',
  PENDING:  'bg-orange-50 text-orange-700 border-orange-200',
};

// ─────────────────────────────────────────────────────────────────────────────
// Bill Modal
// ─────────────────────────────────────────────────────────────────────────────
function BillModal({
  tableNumber,
  orders,
  bill,
  onGenerateBill,
  onClose,
  onPaid,
  onUpdated,
  generating,
  onRefresh,
}: {
  tableNumber: number;
  orders: Order[];
  bill: Bill | null;
  onGenerateBill: () => void;
  onClose: () => void;
  onPaid: () => void;
  onUpdated: (b: Bill) => void;
  generating: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [customItems, setCustomItems] = useState<CustomItem[]>(bill ? parseCustomItems(bill.customItems) : []);
  const [currentBill, setCurrentBill] = useState<Bill | null>(bill);

  useEffect(() => {
    setCurrentBill(bill);
    setCustomItems(bill ? parseCustomItems(bill.customItems) : []);
  }, [bill]);

  // Add extra item form
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [addingItem, setAddingItem] = useState(false);
  const [addError, setAddError] = useState('');

  // Cancel item state
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBill && orders.length === 0) return;
    setAddError('');
    const price = parseFloat(itemPrice);
    const qty = Math.max(1, parseInt(itemQty, 10) || 1);
    if (!itemName.trim()) { setAddError('Item name is required'); return; }
    if (isNaN(price) || price <= 0) { setAddError('Enter a valid price'); return; }

    setAddingItem(true);
    try {
      const url = currentBill
        ? `/api/waiter/bills/${currentBill.id}/custom-item`
        : `/api/waiter/orders/${orders[0].id}/custom-item`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: itemName.trim(), price, quantity: qty }),
        credentials: 'include',
      });
      if (res.ok) {
        if (currentBill) {
          const updated: Bill = await res.json();
          setCurrentBill(updated);
          setCustomItems(parseCustomItems(updated.customItems));
          onUpdated(updated);
        } else {
          await onRefresh();
        }
        setItemName('');
        setItemPrice('');
        setItemQty('1');
      } else {
        const e = await res.json().catch(() => ({}));
        setAddError(e.error || 'Failed to add item');
      }
    } catch {
      setAddError('Network error');
    } finally {
      setAddingItem(false);
    }
  };

  const handleCancelItem = async (itemId: string) => {
    setCancellingId(itemId);
    try {
      const res = await fetch(`/api/waiter/order-items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        await onRefresh();
      } else {
        const e = await res.json().catch(() => ({}));
        alert(e.error || 'Failed to cancel item');
      }
    } catch {
      alert('Network error');
    } finally {
      setCancellingId(null);
    }
  };

  const handleMarkPaid = async () => {
    if (!currentBill) return;
    setPayError('');
    setPaying(true);
    try {
      const res = await fetch(`/api/waiter/bills/${currentBill.id}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod }),
        credentials: 'include',
      });
      if (res.ok) {
        onPaid();
      } else {
        const e = await res.json().catch(() => ({}));
        setPayError(e.error || 'Failed to mark as paid');
      }
    } catch {
      setPayError('Network error');
    } finally {
      setPaying(false);
    }
  };

  const orderItems = currentBill ? currentBill.order.items : orders.flatMap(o => o.items);
  const isPaid = currentBill ? currentBill.paymentStatus === 'PAID' : false;
  const subtotal = currentBill ? currentBill.subtotal : orders.reduce((sum, o) => sum + o.total, 0);
  const taxAmount = currentBill ? currentBill.taxAmount : subtotal * 0.02;
  const discount = currentBill ? currentBill.discount : 0;
  const total = currentBill ? currentBill.total : subtotal + taxAmount;

  return (
    /* Full-screen overlay */
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center">
      {/* 
        Mobile  → full-width panel sliding up from bottom (no border-radius top on mobile)
        Tablet+ → centered card with max-width and rounded corners
      */}
      <div className="
        w-full md:max-w-xl
        bg-white
        flex flex-col
        h-[95dvh] md:h-auto md:max-h-[90vh]
        rounded-t-2xl md:rounded-2xl
        shadow-2xl
        overflow-hidden
      ">

        {/* ── Sticky Header ───────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-3.5 bg-amber-500 text-white">
          {/* Back button */}
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 transition active:scale-95"
            aria-label="Go back"
          >
            <ChevronDown size={20} className="rotate-90" />
          </button>

          {/* Bill info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-tight">
              {currentBill ? `Bill #${currentBill.billNumber}` : 'Draft Bill'}
            </p>
            <p className="text-[11px] text-amber-100">
              Table {tableNumber}
              {isPaid && (
                <span className="ml-2 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                  PAID ✓
                </span>
              )}
            </p>
          </div>

          {/* Total chip */}
          <div className="shrink-0 bg-white/20 rounded-xl px-3 py-1.5 text-right">
            <p className="text-[10px] text-amber-100 leading-none">Total</p>
            <p className="font-black text-base leading-tight">{fmt(total)}</p>
          </div>
        </div>

        {/* ── Scrollable Body ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 py-4 space-y-4 max-w-xl mx-auto">

            {/* Cash Payment Request Alert */}
            {currentBill && !isPaid && currentBill.paymentStatus === 'AWAITING_CONFIRMATION' && currentBill.paymentMethod === 'CASH' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-3 shadow-sm animate-pulse">
                <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-left text-emerald-800 text-sm font-medium">
                  Cash payment of {fmt(total)} requested. Please verify and confirm.
                </div>
              </div>
            )}

            {/* Ordered Items */}
            <section>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Ordered Items
              </h3>
              <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
                {orderItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="shrink-0 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md">
                        {item.quantity}×
                      </span>
                      <span className="text-sm text-gray-800 truncate">{item.menuItem?.name || 'Unknown Item'}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-sm font-semibold text-gray-700">
                        {fmt(item.price * item.quantity)}
                      </span>
                      {!currentBill && (
                        <button
                          type="button"
                          onClick={() => handleCancelItem(item.id)}
                          disabled={cancellingId === item.id}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition active:scale-90 disabled:opacity-50"
                          title="Cancel Item"
                        >
                          {cancellingId === item.id ? (
                            <Activity size={14} className="animate-spin text-red-500" />
                          ) : (
                            <X size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Extra Items (if any) */}
            {currentBill && customItems.length > 0 && (
              <section>
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Extra Items Added
                </h3>
                <div className="bg-white border border-purple-100 rounded-xl divide-y divide-gray-50 overflow-hidden">
                  {customItems.map((ci, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0 text-xs font-bold text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md">
                          {ci.quantity}×
                        </span>
                        <span className="text-sm text-gray-800 truncate">{ci.name}</span>
                        <span className="shrink-0 text-[9px] font-bold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded uppercase">
                          Extra
                        </span>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-gray-750 ml-3">
                        {fmt(ci.price * ci.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Add Extra Item */}
            {!isPaid && orders.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Add Item</h3>
                <form onSubmit={handleAddItem} className="space-y-2">
                  {addError && <p className="text-xs text-red-600">{addError}</p>}
                  <input
                    type="text"
                    placeholder="Item name (e.g. Mineral Water)"
                    value={itemName}
                    onChange={e => { setItemName(e.target.value); setAddError(''); }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                    disabled={addingItem}
                  />
                  {/* Price + Qty + Add button — responsive row */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold pointer-events-none">₹</span>
                      <input
                        type="number"
                        placeholder="Price"
                        min="1"
                        step="0.01"
                        value={itemPrice}
                        onChange={e => setItemPrice(e.target.value)}
                        className="w-full pl-7 pr-2 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                        disabled={addingItem}
                      />
                    </div>
                    <input
                      type="number"
                      placeholder="Qty"
                      min="1"
                      value={itemQty}
                      onChange={e => setItemQty(e.target.value)}
                      className="w-16 px-2 py-2.5 border border-gray-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                      disabled={addingItem}
                    />
                    <button
                      type="submit"
                      disabled={addingItem}
                      className="shrink-0 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition flex items-center gap-1 disabled:opacity-60 active:scale-95"
                    >
                      {addingItem ? <Activity size={14} className="animate-spin" /> : <Plus size={14} />}
                      Add
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* Bill Totals */}
            <section className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-semibold">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>GST (2%)</span>
                  <span className="font-semibold">{fmt(taxAmount)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span className="font-semibold">−{fmt(discount)}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center px-4 py-3 bg-amber-50 border-t border-amber-100">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-black text-xl text-amber-600">{fmt(total)}</span>
              </div>
            </section>

            {payError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 flex items-center gap-1.5">
                <AlertCircle size={12} className="shrink-0" /> {payError}
              </p>
            )}

            {/* Spacer so footer doesn't cover last element */}
            <div className="h-2" />
          </div>
        </div>

        {/* ── Sticky Footer ───────────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-4 border-t border-gray-100 bg-white space-y-2.5">
          {!currentBill ? (
            <>
              <button
                onClick={onGenerateBill}
                disabled={generating}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition active:scale-95 shadow-md shadow-amber-500/20 disabled:opacity-60"
              >
                {generating ? (
                  <><Activity size={16} className="animate-spin" /> Generating…</>
                ) : (
                  <><Receipt size={16} /> Generate Bill</>
                )}
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Back to Queue
              </button>
            </>
          ) : isPaid ? (
            <>
              <div className="flex items-center justify-center gap-2 py-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-bold text-sm">
                <CheckCircle2 size={18} />
                Bill is Paid — {currentBill.paymentMethod}
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleMarkPaid}
                disabled={paying}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition active:scale-95 shadow-md shadow-emerald-500/20 disabled:opacity-60"
              >
                {paying ? (
                  <><Activity size={16} className="animate-spin" /> Processing…</>
                ) : (
                  <><CheckCircle2 size={16} /> Confirm & Mark Paid (Cash)</>
                )}
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-650 hover:bg-gray-50 transition"
              >
                Back to Queue
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table Order Group Card
// ─────────────────────────────────────────────────────────────────────────────
function TableGroup({
  tableNumber,
  orders,
  bill,
  onGenerateBill,
  onOpenBill,
  generating,
  onUpdateOrderStatus,
  updatingStatusOrderId,
}: {
  tableNumber: number;
  orders: Order[];
  bill: Bill | null;
  onGenerateBill: () => void;
  onOpenBill: () => void;
  generating: boolean;
  onUpdateOrderStatus: (orderId: string, status: string) => Promise<void>;
  updatingStatusOrderId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const totalItems = orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);
  const grandTotal = orders.reduce((s, o) => s + o.total, 0);
  const hasPending = orders.some(o => o.status === 'PENDING');
  const isPaid = bill?.paymentStatus === 'PAID';

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      isPaid ? 'border-emerald-200 opacity-60' : hasPending ? 'border-orange-200' : 'border-gray-100'
    }`}>
      {/* Table Header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/50 transition"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm ${
            isPaid ? 'bg-emerald-100 text-emerald-700' :
            hasPending ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {tableNumber}
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-900 text-sm">Table {tableNumber}</p>
            <p className="text-[11px] text-gray-500">
              {orders.length} order{orders.length !== 1 ? 's' : ''} · {totalItems} item{totalItems !== 1 ? 's' : ''} · {fmt(grandTotal)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isPaid && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full">PAID</span>
          )}
          {!isPaid && bill && bill.paymentStatus === 'AWAITING_CONFIRMATION' && bill.paymentMethod === 'CASH' && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 rounded-full animate-pulse">CASH REQUESTED</span>
          )}
          {!isPaid && bill && bill.paymentStatus === 'AWAITING_CONFIRMATION' && bill.paymentMethod === 'UPI' && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 rounded-full">UPI SUBMITTED</span>
          )}
          {!isPaid && bill && bill.paymentStatus === 'PENDING' && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200 rounded-full">BILL READY</span>
          )}
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Orders list */}
      {expanded && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          {orders.map(order => (
            <div key={order.id} className="px-4 py-3.5 bg-white">
              {/* Order Header / Metadata */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                    #{order.id.slice(-5).toUpperCase()}
                  </span>
                  {order.notes && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md max-w-[140px] truncate">
                      {order.notes.replace(/^Name:\s*/i, '')}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {order.status}
                </span>
              </div>

              {/* Clean Dish List (visible and clear on mobile) */}
              <div className="space-y-1.5 mt-2">
                {order.items.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-gray-50/70 border border-gray-100/50 rounded-xl px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md shrink-0">
                        {item.quantity}×
                      </span>
                      <span className="text-gray-700 truncate">{item.menuItem.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 ml-2">
                      {fmt(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Order Footer & Actions */}
              <div className="mt-3 flex items-center justify-between gap-3 pt-2.5 border-t border-dashed border-gray-100">
                <span className="text-xs text-gray-500 font-medium">
                  Total: <span className="font-bold text-gray-800">{fmt(order.total)}</span>
                </span>
                
                {order.status !== 'SERVED' && order.status !== 'PAID' ? (
                  <button
                    onClick={() => onUpdateOrderStatus(order.id, 'SERVED')}
                    disabled={updatingStatusOrderId === order.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold text-[11px] rounded-lg transition active:scale-95 shadow-sm shadow-emerald-500/10"
                  >
                    {updatingStatusOrderId === order.id ? (
                      <Activity size={12} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                    Confirm Served
                  </button>
                ) : (
                  <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" /> Served
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Action Bar */}
          <div className="px-4 py-3 bg-gray-50/50 flex items-center gap-2">
            {!bill ? (
              <button
                onClick={onGenerateBill}
                disabled={generating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition active:scale-95 shadow-sm shadow-amber-500/20 disabled:opacity-60"
              >
                {generating ? (
                  <><Activity size={13} className="animate-spin" /> Generating…</>
                ) : (
                  <><Receipt size={13} /> Generate Bill</>
                )}
              </button>
            ) : (
              <button
                onClick={onOpenBill}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-bold text-xs rounded-xl transition active:scale-95 shadow-sm ${
                  isPaid
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : bill.paymentStatus === 'AWAITING_CONFIRMATION' && bill.paymentMethod === 'CASH'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20 animate-pulse'
                      : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                }`}
              >
                <Receipt size={13} />
                {isPaid
                  ? 'View Bill (Paid)'
                  : bill.paymentStatus === 'AWAITING_CONFIRMATION' && bill.paymentMethod === 'CASH'
                    ? `Confirm Cash Payment · ${fmt(bill.total)}`
                    : `View & Pay Bill · ${fmt(bill.total)}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function WaiterQueue() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const { lastEvent } = useEventSource('/api/events');

  // Active table number for modal
  const [activeTableNumber, setActiveTableNumber] = useState<number | null>(null);
  // Which table is generating a bill
  const [generatingFor, setGeneratingFor] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [ordRes, billRes] = await Promise.all([
        fetch('/api/orders', { credentials: 'include' }),
        fetch('/api/waiter/bills', { credentials: 'include' }),
      ]);
      if (ordRes.ok) setOrders(await ordRes.json());
      if (billRes.ok) setBills(await billRes.json());
    } catch (e) {
      console.error('WaiterQueue fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!lastEvent) return;
    if (['NEW_ORDER', 'ORDER_UPDATE', 'PAYMENT_SUBMITTED', 'TABLES_UPDATE'].includes(lastEvent.type)) {
      void fetchData();
    }
  }, [lastEvent, fetchData]);

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingStatusId(orderId);
    // Optimistic local state update
    setOrders(curr => curr.map(o => o.id === orderId ? { ...o, status } : o));
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error('Failed to update status:', e);
      await fetchData();
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Group active (non-PAID, non-CANCELLED) orders by table
  const activeOrders = orders.filter(o => !['PAID', 'CANCELLED'].includes(o.status));
  const tableGroups = activeOrders.reduce<Record<number, Order[]>>((acc, order) => {
    const tn = order.table.tableNumber;
    if (!acc[tn]) acc[tn] = [];
    acc[tn].push(order);
    return acc;
  }, {});
  const sortedTables = Object.keys(tableGroups)
    .map(Number)
    .sort((a, b) => a - b);

  // Map orderId → bill
  const billByOrderId = bills.reduce<Record<string, Bill>>((acc, b) => {
    acc[b.orderId] = b;
    return acc;
  }, {});

  // For a table group, find the bill for any order in that group
  const getBillForTable = (tableOrders: Order[]): Bill | null => {
    for (const o of tableOrders) {
      if (billByOrderId[o.id]) return billByOrderId[o.id];
    }
    return null;
  };

  const handleGenerateBill = async (tableNumber: number, tableOrders: Order[]) => {
    setGeneratingFor(tableNumber);
    try {
      // Generate bill for the first order in the group (others get merged later by the system)
      const targetOrder = tableOrders[0];
      const res = await fetch('/api/waiter/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: targetOrder.id }),
        credentials: 'include',
      });
      if (res.ok) {
        const newBill: Bill = await res.json();
        setBills(prev => {
          const exists = prev.find(b => b.id === newBill.id);
          return exists ? prev.map(b => b.id === newBill.id ? newBill : b) : [...prev, newBill];
        });
        await fetchData();
      }
    } catch (e) {
      console.error('Failed to generate bill:', e);
    } finally {
      setGeneratingFor(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Activity className="animate-spin text-amber-500 mx-auto" size={36} />
          <p className="text-gray-500 text-sm font-medium">Loading order queue…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-3 sm:p-4 md:p-6 animate-slide-up">
        <WaiterAlerts lastEvent={lastEvent} />

        {/* Header */}
        <div className="flex items-center justify-between mb-5 gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList size={20} className="text-amber-500" />
              Order Queue
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Active orders grouped by table — generate bills and collect payments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              sortedTables.length > 0
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-gray-50 text-gray-500 border-gray-200'
            }`}>
              {sortedTables.length} Active Table{sortedTables.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Content */}
        {sortedTables.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
            <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-300 mb-4">
              <Package size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No Active Orders</h3>
            <p className="text-gray-500 text-sm">
              New orders from customers will appear here in real-time.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTables.map(tableNumber => {
              const tableOrders = tableGroups[tableNumber];
              const bill = getBillForTable(tableOrders);
              return (
                <TableGroup
                  key={tableNumber}
                  tableNumber={tableNumber}
                  orders={tableOrders}
                  bill={bill}
                  generating={generatingFor === tableNumber}
                  onGenerateBill={() => setActiveTableNumber(tableNumber)}
                  onOpenBill={() => setActiveTableNumber(tableNumber)}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                  updatingStatusOrderId={updatingStatusId}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Bill Modal (Rendered outside the animate-slide-up div to escape stacking context) */}
      {activeTableNumber !== null && (() => {
        const tableOrders = tableGroups[activeTableNumber] || [];
        const bill = getBillForTable(tableOrders);
        return (
          <BillModal
            tableNumber={activeTableNumber}
            orders={tableOrders}
            bill={bill}
            onClose={() => setActiveTableNumber(null)}
            onGenerateBill={() => handleGenerateBill(activeTableNumber, tableOrders)}
            onPaid={async () => {
              setActiveTableNumber(null);
              await fetchData();
            }}
            onUpdated={updatedBill => {
              setBills(prev => prev.map(b => b.id === updatedBill.id ? updatedBill : b));
            }}
            generating={generatingFor === activeTableNumber}
            onRefresh={fetchData}
          />
        );
      })()}
    </>
  );
}
