import { useEffect, useState, useCallback } from 'react';
import { useEventSource } from '@/hooks/useEventSource';
import { WaiterAlerts } from '@/components/dashboard/WaiterAlerts';
import {
  ClipboardList, ChevronDown, ChevronUp, Receipt, X, Plus,
  CheckCircle2, Activity, Utensils, CreditCard, Banknote,
  Trash2, AlertCircle, Package,
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
  bill,
  onClose,
  onPaid,
  onUpdated,
}: {
  bill: Bill;
  onClose: () => void;
  onPaid: () => void;
  onUpdated: (b: Bill) => void;
}) {
  const [customItems, setCustomItems] = useState<CustomItem[]>(parseCustomItems(bill.customItems));
  const [currentBill, setCurrentBill] = useState<Bill>(bill);

  // Add extra item form
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [addingItem, setAddingItem] = useState(false);
  const [addError, setAddError] = useState('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    const price = parseFloat(itemPrice);
    const qty = Math.max(1, parseInt(itemQty, 10) || 1);
    if (!itemName.trim()) { setAddError('Item name is required'); return; }
    if (isNaN(price) || price <= 0) { setAddError('Enter a valid price'); return; }

    setAddingItem(true);
    try {
      const res = await fetch(`/api/waiter/bills/${currentBill.id}/custom-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: itemName.trim(), price, quantity: qty }),
        credentials: 'include',
      });
      if (res.ok) {
        const updated: Bill = await res.json();
        setCurrentBill(updated);
        setCustomItems(parseCustomItems(updated.customItems));
        onUpdated(updated);
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

  const handleMarkPaid = async () => {
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

  const orderItems = currentBill.order.items;
  const isPaid = currentBill.paymentStatus === 'PAID';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-amber-500 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Receipt size={18} />
            <div>
              <p className="font-bold text-sm">Bill #{currentBill.billNumber}</p>
              <p className="text-[11px] text-amber-100">Table {currentBill.order.table.tableNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Order Items */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Ordered Items</h3>
            <div className="space-y-2">
              {orderItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md min-w-[24px] text-center">
                      {item.quantity}×
                    </span>
                    <span className="text-sm font-medium text-gray-800">{item.menuItem.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{fmt(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Items */}
          {customItems.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Extra Items Added</h3>
              <div className="space-y-2">
                {customItems.map((ci, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-md min-w-[24px] text-center">
                        {ci.quantity}×
                      </span>
                      <span className="text-sm font-medium text-gray-800">{ci.name}</span>
                      <span className="text-[10px] text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded font-bold">EXTRA</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{fmt(ci.price * ci.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Extra Item */}
          {!isPaid && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Plus size={12} /> Add Extra Item
              </h3>
              <form onSubmit={handleAddItem} className="space-y-3">
                {addError && (
                  <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <AlertCircle size={12} /> {addError}
                  </p>
                )}
                <input
                  type="text"
                  placeholder="Item name (e.g. Mineral Water)"
                  value={itemName}
                  onChange={e => { setItemName(e.target.value); setAddError(''); }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  disabled={addingItem}
                />
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">₹</span>
                    <input
                      type="number"
                      placeholder="Price"
                      min="1"
                      step="0.01"
                      value={itemPrice}
                      onChange={e => setItemPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      disabled={addingItem}
                    />
                  </div>
                  <input
                    type="number"
                    placeholder="Qty"
                    min="1"
                    value={itemQty}
                    onChange={e => setItemQty(e.target.value)}
                    className="w-20 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-center"
                    disabled={addingItem}
                  />
                  <button
                    type="submit"
                    disabled={addingItem}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition flex items-center gap-1 disabled:opacity-60"
                  >
                    {addingItem ? <Activity size={14} className="animate-spin" /> : <Plus size={14} />}
                    Add
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold">{fmt(currentBill.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>GST (2%)</span>
              <span className="font-semibold">{fmt(currentBill.taxAmount)}</span>
            </div>
            {currentBill.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span className="font-semibold">-{fmt(currentBill.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span>
              <span className="text-amber-600 text-lg">{fmt(currentBill.total)}</span>
            </div>
          </div>

          {/* Payment Method */}
          {!isPaid && (
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Payment Method</h3>
              <div className="grid grid-cols-2 gap-3">
                {(['CASH', 'UPI'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition ${
                      paymentMethod === m
                        ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-amber-300'
                    }`}
                  >
                    {m === 'CASH' ? <Banknote size={16} /> : <CreditCard size={16} />}
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {payError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <AlertCircle size={12} /> {payError}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-gray-100 bg-white shrink-0">
          {isPaid ? (
            <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 font-bold text-sm">
              <CheckCircle2 size={16} /> Bill is Paid — {currentBill.paymentMethod}
            </div>
          ) : (
            <button
              onClick={handleMarkPaid}
              disabled={paying}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-sm transition active:scale-95 shadow-md shadow-emerald-500/20 disabled:opacity-60"
            >
              {paying ? (
                <><Activity size={16} className="animate-spin" /> Processing…</>
              ) : (
                <><CheckCircle2 size={16} /> Mark as Paid ({fmt(currentBill.total)})</>
              )}
            </button>
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
}: {
  tableNumber: number;
  orders: Order[];
  bill: Bill | null;
  onGenerateBill: () => void;
  onOpenBill: () => void;
  generating: boolean;
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
          {!isPaid && bill && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-50 text-orange-600 border border-orange-200 rounded-full">BILL READY</span>
          )}
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Orders list */}
      {expanded && (
        <div className="border-t border-gray-100">
          {orders.map(order => (
            <div key={order.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-mono">#{order.id.slice(-5).toUpperCase()}</span>
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
              <p className="text-xs text-gray-500 leading-relaxed">
                {order.items.map(i => `${i.quantity}× ${i.menuItem.name}`).join(' · ')}
              </p>
              <p className="text-xs font-bold text-gray-700 mt-1 text-right">{fmt(order.total)}</p>
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
                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                }`}
              >
                <Receipt size={13} />
                {isPaid ? 'View Bill (Paid)' : `View & Pay Bill · ${fmt(bill.total)}`}
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
  const { lastEvent } = useEventSource('/api/events');

  // Active bill modal
  const [activeBill, setActiveBill] = useState<Bill | null>(null);
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
        setActiveBill(newBill);
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
    <div className="p-4 md:p-6 animate-slide-up">
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
                onGenerateBill={() => handleGenerateBill(tableNumber, tableOrders)}
                onOpenBill={() => setActiveBill(bill)}
              />
            );
          })}
        </div>
      )}

      {/* Bill Modal */}
      {activeBill && (
        <BillModal
          bill={activeBill}
          onClose={() => setActiveBill(null)}
          onPaid={async () => {
            setActiveBill(null);
            await fetchData();
          }}
          onUpdated={updatedBill => {
            setBills(prev => prev.map(b => b.id === updatedBill.id ? updatedBill : b));
            setActiveBill(updatedBill);
          }}
        />
      )}
    </div>
  );
}
