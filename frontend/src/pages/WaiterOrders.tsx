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
  Lock,
  Trash2,
  Plus,
  Minus,
  Search,
  AlertTriangle,
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
  onEditOrder,
  completing,
}: {
  order: OrderWithItems;
  onMarkComplete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onEditOrder: (order: OrderWithItems) => void;
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
            <li key={item.id} className={`flex justify-between items-start text-sm p-1 rounded-lg ${item.isUnavailable ? 'bg-red-50 border border-red-250 px-2 py-1.5' : ''}`}>
              <div>
                <span className="font-semibold text-gray-900">{item.quantity}×</span>{' '}
                <span className={`text-gray-800 ${item.isUnavailable ? 'text-red-700 font-bold' : ''}`}>{item.menuItem?.name || 'Unknown Item'}</span>
                {item.isUnavailable && (
                  <span className="ml-2 inline-flex items-center gap-0.5 bg-red-100 text-red-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                    Unavailable
                  </span>
                )}
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
          {order.status !== 'PAID' && order.status !== 'CANCELLED' && (
            <button
              onClick={() => onEditOrder(order)}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition shrink-0 flex items-center gap-1 border border-amber-200"
            >
              Edit Items
            </button>
          )}

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
interface Table {
  id: string;
  tableNumber: number;
  slug: string;
  active: boolean;
  callingWaiter: boolean;
  assignedWaiter?: {
    id: string;
    username: string;
    email: string;
  } | null;
}

export default function WaiterOrders() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{ tableNumber: number | null; method: string | null } | null>(null);
  const { lastEvent } = useEventSource('/api/events');

  const [tables, setTables] = useState<Table[]>([]);
  const [savedTables, setSavedTables] = useState<string[]>([]); // What's in DB
  const [pendingTables, setPendingTables] = useState<string[]>([]); // Local selection (not yet saved)
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [selectionError, setSelectionError] = useState('');
  const [submittingAssignment, setSubmittingAssignment] = useState(false);

  // States for Edit Order Modal
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<OrderWithItems | null>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceSearchQuery, setReplaceSearchQuery] = useState('');
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Derived: did local selection differ from saved?
  const hasUnsavedChanges = JSON.stringify([...pendingTables].sort()) !== JSON.stringify([...savedTables].sort());

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders', { credentials: 'include' });
      if (res.ok) setOrders(await res.json());
    } catch (e) {
      console.error('Failed to fetch orders:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/tables');
      if (res.ok) setTables(await res.json());
    } catch (e) {
      console.error('Failed to fetch tables:', e);
    }
  };

  const fetchUserRole = async () => {
    try {
      const res = await fetch('/api/auth/check', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCurrentUsername(data.username || '');
      }
    } catch (e) {
      console.error('Failed to fetch user role:', e);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) setMenuItems(await res.json());
    } catch (e) {
      console.error('Failed to fetch menu:', e);
    }
  };

  useEffect(() => {
    void fetchOrders();
    void fetchTables();
    void fetchUserRole();
    void fetchMenu();
  }, []);

  useEffect(() => {
    if (selectedOrderForEdit) {
      setEditItems(selectedOrderForEdit.items.map(item => ({
        id: item.id,
        menuItemId: item.menuItem.id,
        name: item.menuItem.name,
        price: item.price,
        quantity: item.quantity,
        isUnavailable: !!item.isUnavailable,
        specialInstructions: item.specialInstructions || ''
      })));
      setSearchQuery('');
      setReplaceSearchQuery('');
      setReplacingIndex(null);
      void fetchMenu();
    }
  }, [selectedOrderForEdit]);

  const handleUpdateLocalQty = (index: number, offset: number) => {
    setEditItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, quantity: Math.max(1, item.quantity + offset) };
      }
      return item;
    }));
  };

  const handleToggleLocalUnavailable = (index: number) => {
    setEditItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return { ...item, isUnavailable: !item.isUnavailable };
      }
      return item;
    }));
  };

  const handleRemoveLocalItem = (index: number) => {
    setEditItems(prev => prev.filter((_, idx) => idx !== index));
    if (replacingIndex === index) {
      setReplacingIndex(null);
    } else if (replacingIndex !== null && replacingIndex > index) {
      setReplacingIndex(replacingIndex - 1);
    }
  };

  const handleAddLocalItem = (menuItem: any) => {
    setEditItems(prev => {
      const existingIdx = prev.findIndex(item => item.menuItemId === menuItem.id);
      if (existingIdx >= 0) {
        return prev.map((item, idx) => {
          if (idx === existingIdx) {
            return { ...item, quantity: item.quantity + 1 };
          }
          return item;
        });
      } else {
        return [
          ...prev,
          {
            menuItemId: menuItem.id,
            name: menuItem.name,
            price: menuItem.price,
            quantity: 1,
            isUnavailable: false,
            specialInstructions: ''
          }
        ];
      }
    });
    setSearchQuery('');
  };

  const handleReplaceLocalItem = (index: number, replacementItem: any) => {
    setEditItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        return {
          ...item,
          menuItemId: replacementItem.id,
          name: replacementItem.name,
          price: replacementItem.price,
          isUnavailable: false
        };
      }
      return item;
    }));
    setReplacingIndex(null);
    setReplaceSearchQuery('');
  };

  const handleSaveChanges = async () => {
    if (!selectedOrderForEdit) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/waiter/orders/${selectedOrderForEdit.id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: editItems }),
      });
      if (res.ok) {
        setSelectedOrderForEdit(null);
        void fetchOrders();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save changes.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error saving changes.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter lists
  const filteredMenuItems = menuItems.filter(item => 
    item.available &&
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !editItems.some(ei => ei.menuItemId === item.id)
  );

  const filteredReplacementItems = menuItems.filter(item => 
    item.available &&
    item.name.toLowerCase().includes(replaceSearchQuery.toLowerCase()) &&
    !editItems.some(ei => ei.menuItemId === item.id)
  );

  const localTotal = editItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  // Sync pendingTables + savedTables when tables or username changes (e.g. fresh page load)
  useEffect(() => {
    if (currentUsername) {
      const assignedToMe = tables
        .filter(t => t.assignedWaiter?.username.toLowerCase() === currentUsername.toLowerCase())
        .map(t => t.id);
      setSavedTables(assignedToMe);
      // Only overwrite pending if we haven't touched anything yet
      setPendingTables(prev => {
        // If pending is empty or equals what was just loaded, sync it too
        if (prev.length === 0 || JSON.stringify([...prev].sort()) === JSON.stringify([...assignedToMe].sort())) {
          return assignedToMe;
        }
        return prev;
      });
    }
  }, [tables, currentUsername]);

  useEffect(() => {
    if (!lastEvent) return;
    if (!['NEW_ORDER', 'ORDER_UPDATE', 'PAYMENT_SUBMITTED', 'TABLES_UPDATE'].includes(lastEvent.type)) return;

    if (lastEvent.type === 'TABLES_UPDATE') {
      void fetchTables();
      return;
    }

    void fetchOrders();

    if (lastEvent.type === 'NEW_ORDER') {
      const targetTableId = lastEvent.data?.tableId;
      if (typeof targetTableId === 'string' && savedTables.includes(targetTableId)) {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          void audio.play().catch(() => {});
        } catch { /* ignore */ }
      }
    }

    if (lastEvent.type === 'PAYMENT_SUBMITTED' || (lastEvent.type === 'ORDER_UPDATE' && lastEvent.data.status === 'PAID')) {
      const targetTableId = lastEvent.data?.tableId;
      // Only display payment notices and play payment sounds if the table is maintained by this waiter
      if (typeof targetTableId === 'string' && !savedTables.includes(targetTableId)) {
        return;
      }

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
  }, [lastEvent, savedTables]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Toggles a table selection locally — does NOT call the API yet */
  const handleToggleTable = (tableId: string) => {
    setSelectionError('');
    setPendingTables(prev => {
      if (prev.includes(tableId)) {
        return prev.filter(id => id !== tableId);
      }
      if (prev.length >= 5) {
        setSelectionError("You can't select more than 5 tables.");
        return prev;
      }
      return [...prev, tableId];
    });
  };

  /** Commits the pending selection to the database */
  const handleSaveTables = async () => {
    if (pendingTables.length < 2) {
      setSelectionError('Please select at least 2 tables before saving.');
      return;
    }
    if (pendingTables.length > 5) {
      setSelectionError("You can't select more than 5 tables.");
      return;
    }

    setSubmittingAssignment(true);
    setSelectionError('');
    try {
      const res = await fetch('/api/tables/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tableIds: pendingTables }),
      });
      if (res.ok) {
        const updated = await res.json() as Table[];
        setTables(updated);
        // Sync savedTables to reflect what's now in the DB
        const myTables = updated
          .filter(t => t.assignedWaiter?.username.toLowerCase() === currentUsername.toLowerCase())
          .map(t => t.id);
        setSavedTables(myTables);
        setPendingTables(myTables);
      } else {
        const err = await res.json();
        setSelectionError(err.error || 'Failed to save table assignment.');
      }
    } catch (e) {
      console.error(e);
      setSelectionError('Network error saving assignments.');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  /** Advance order to any status */
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
        credentials: 'include',
        body: JSON.stringify({ status: 'SERVED' }),
      });
    } catch (e) {
      console.error(e);
      fetchOrders();
    } finally {
      setCompletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Activity className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  // Filter active live orders by SAVED (committed) tables
  const activeOrders = orders.filter(
    o => !['SERVED', 'PENDING', 'PAID', 'CANCELLED'].includes(o.status) &&
         savedTables.includes(o.tableId)
  );
  const readyCount = activeOrders.filter(o => o.status === 'READY').length;

  return (
    <div className="p-3 sm:p-4 md:p-6 animate-slide-up">
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

      {/* Beautiful Table Selection Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5 animate-slide-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Utensils size={18} className="text-amber-500" />
              Waiter Table Assignments
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select between <strong>2 and 5 tables</strong>, then click <strong>Save</strong> to lock them in. Tables assigned to other waiters are locked.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Unsaved indicator */}
            {hasUnsavedChanges && (
              <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-1 rounded-lg animate-pulse">
                Unsaved changes
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              pendingTables.length >= 2 && pendingTables.length <= 5
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {pendingTables.length} / 5 selected
            </span>
          </div>
        </div>

        {selectionError && (
          <div className="mb-4 px-4 py-3 text-xs font-bold text-red-800 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 animate-bounce">
            <Bell size={12} className="text-red-500 shrink-0" />
            {selectionError}
          </div>
        )}

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-3">
          {tables.map(table => {
            const isPending = pendingTables.includes(table.id);
            const isSaved = savedTables.includes(table.id);
            const isAssignedToOther = table.assignedWaiter && 
              table.assignedWaiter.username.toLowerCase() !== currentUsername.toLowerCase();

            // Show "changed" ring if pending differs from saved for this table
            const isToggled = isPending !== isSaved;

            return (
              <button
                key={table.id}
                type="button"
                disabled={isAssignedToOther || submittingAssignment}
                onClick={() => handleToggleTable(table.id)}
                className={`p-2.5 sm:p-3.5 rounded-xl font-bold text-center border transition-all duration-250 active:scale-95 flex flex-col items-center justify-center gap-1 sm:gap-1.5 shadow-sm relative overflow-hidden ${
                  isPending
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20 font-black'
                    : isAssignedToOther
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-55'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
                } ${isToggled ? 'ring-2 ring-orange-400 ring-offset-1' : ''}`}
              >
                <span className="text-[9px] sm:text-[10px] uppercase tracking-wider opacity-85">T</span>
                <span className="text-base sm:text-lg font-black leading-none">{table.tableNumber}</span>
                {isPending && (
                  <span className="absolute top-1.5 right-1.5 text-white bg-white/20 p-0.5 rounded-full">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
                {isAssignedToOther && (
                  <div className="flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded bg-gray-200/50 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                    <Lock size={8} className="shrink-0" />
                    <span className="truncate max-w-[50px]">{table.assignedWaiter?.username}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Save Button */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            {pendingTables.length < 2
              ? 'Select at least 2 tables to save'
              : pendingTables.length > 5
                ? 'Too many tables — max 5'
                : hasUnsavedChanges
                  ? 'Your selection has unsaved changes'
                  : <span className="text-green-600 font-semibold">✓ Tables saved</span>
            }
          </p>
          <button
            type="button"
            onClick={handleSaveTables}
            disabled={
              submittingAssignment ||
              pendingTables.length < 2 ||
              pendingTables.length > 5 ||
              !hasUnsavedChanges
            }
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition active:scale-95 ${
              submittingAssignment || pendingTables.length < 2 || pendingTables.length > 5 || !hasUnsavedChanges
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20'
            }`}
          >
            {submittingAssignment ? (
              <><Activity size={16} className="animate-spin" /> Saving…</>
            ) : (
              <><Check size={16} strokeWidth={2.5} /> Save My Tables ({pendingTables.length})</>
            )}
          </button>
        </div>
      </div>

      {/* Table Selection Guide Banner if invalid count */}
      {savedTables.length < 2 && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col items-start gap-3 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-600">
              <Activity size={24} className="animate-spin" />
            </div>
            <div>
              <h3 className="font-bold text-amber-900 text-sm">Table Maintenance Mode</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Select 2–5 tables above and click <strong>Save My Tables</strong> to start managing orders.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ready-to-serve banner */}
      {readyCount > 0 && savedTables.length >= 2 && (
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
      {savedTables.length >= 2 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-gray-900 mb-0.5">Live Orders</h1>
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
      )}

      {/* Orders Grid */}
      {savedTables.length < 2 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
          <div className="mx-auto w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 mb-4">
            <Utensils size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Live Orders Locked</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Please select at least 2 tables in the assignments panel above to start viewing and maintaining orders.
          </p>
        </div>
      ) : activeOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-300">
          <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-4">
            <BellOff size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No active orders</h3>
          <p className="text-gray-500">New orders from your selected tables will appear here instantly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {activeOrders.map(order => (
            <WaiterOrderCard
              key={order.id}
              order={order}
              onMarkComplete={handleMarkComplete}
              onUpdateStatus={handleUpdateStatus}
              onEditOrder={setSelectedOrderForEdit}
              completing={completingId === order.id}
            />
          ))}
        </div>
      )}

      {/* ── Edit Order Modal ─────────────────────────────────────── */}
      {selectedOrderForEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100 animate-scale-up">
            
            {/* Header */}
            <div className="bg-amber-600 text-white px-6 py-5 flex items-center justify-between shadow-sm">
              <div>
                <h3 className="font-black text-lg">Edit Order Items</h3>
                <p className="text-xs text-amber-100 mt-0.5 font-medium">
                  Table {selectedOrderForEdit.table.tableNumber} • ID: {selectedOrderForEdit.id.substring(0, 8)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderForEdit(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Scroll Area */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              
              {/* Active Items list */}
              <div>
                <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Current Ordered Items</h4>
                {editItems.length === 0 ? (
                  <p className="text-sm text-gray-500 italic py-4 text-center">No items in order. Order will be cancelled upon saving.</p>
                ) : (
                  <div className="space-y-3">
                    {editItems.map((item, idx) => {
                      const isItemUnavailable = item.isUnavailable;
                      return (
                        <div
                          key={item.id || idx}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition-all ${
                            isItemUnavailable
                              ? 'bg-red-50 border-red-200'
                              : 'bg-gray-55 border-gray-150 hover:bg-gray-100/75'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-sm ${isItemUnavailable ? 'text-red-700' : 'text-gray-900'}`}>
                                {item.name}
                              </span>
                              {isItemUnavailable && (
                                <span className="bg-red-100 text-red-800 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5 animate-pulse">
                                  <AlertTriangle size={8} /> Unavailable
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 font-medium">
                              Price: {item.price ? `₹${item.price.toFixed(2)}` : '₹0.00'}
                              {item.specialInstructions && (
                                <span className="text-amber-600 ml-2 italic font-semibold">
                                  *{item.specialInstructions}
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                            {/* Quantity Adjustment */}
                            <div className="flex items-center bg-white rounded-xl border border-gray-200 shadow-sm p-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateLocalQty(idx, -1)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition active:scale-90 cursor-pointer"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-8 text-center font-extrabold text-sm text-gray-800">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateLocalQty(idx, 1)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition active:scale-90 cursor-pointer"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            {/* Actions: Toggle Availability / Replace / Delete */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleLocalUnavailable(idx)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                                  isItemUnavailable
                                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                                    : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                                }`}
                              >
                                {isItemUnavailable ? 'Available' : 'Unavailable'}
                              </button>

                              {isItemUnavailable && (
                                <button
                                  type="button"
                                  onClick={() => setReplacingIndex(idx)}
                                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 transition cursor-pointer"
                                >
                                  Replace
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRemoveLocalItem(idx)}
                                className="p-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 rounded-xl transition border border-gray-250 hover:border-red-200 cursor-pointer"
                                aria-label="Remove item"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inline replacement selection if replacingIndex is set */}
              {replacingIndex !== null && (
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-2xl animate-slide-up space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="text-xs font-extrabold text-blue-900 uppercase">
                      Select Replacement for "{editItems[replacingIndex]?.name}"
                    </h5>
                    <button
                      type="button"
                      onClick={() => setReplacingIndex(null)}
                      className="text-xs font-bold text-gray-500 hover:underline cursor-pointer"
                    >
                      Cancel Replacement
                    </button>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search dishes to replace..."
                      value={replaceSearchQuery}
                      onChange={(e) => setReplaceSearchQuery(e.target.value)}
                      className="w-full bg-white border border-gray-250 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-medium shadow-sm"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1 bg-white rounded-xl border border-gray-200 p-2 shadow-inner">
                    {filteredReplacementItems.length === 0 ? (
                      <p className="text-xs text-gray-400 py-3 text-center">No available matching dishes.</p>
                    ) : (
                      filteredReplacementItems.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleReplaceLocalItem(replacingIndex, item)}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-gray-750 hover:bg-blue-50 hover:text-blue-800 transition flex justify-between items-center cursor-pointer"
                        >
                          <span>{item.name}</span>
                          <span className="text-emerald-600 font-extrabold">₹{item.price.toFixed(2)}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Add New Item section */}
              {replacingIndex === null && (
                <div className="p-4 bg-gray-55 border border-gray-200 rounded-2xl space-y-3">
                  <h4 className="text-xs font-black text-gray-450 uppercase tracking-wider">Add New Dish</h4>
                  
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search menu to add dish..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-gray-250 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium shadow-sm"
                    />
                  </div>

                  {searchQuery.trim() !== '' && (
                    <div className="max-h-48 overflow-y-auto space-y-1 bg-white rounded-xl border border-gray-200 p-2 shadow-inner">
                      {filteredMenuItems.length === 0 ? (
                        <p className="text-xs text-gray-400 py-3 text-center">No active matching dishes found.</p>
                      ) : (
                        filteredMenuItems.map(item => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-amber-50 transition border border-transparent hover:border-amber-100"
                          >
                            <div>
                              <p className="text-xs font-bold text-gray-800">{item.name}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">₹{item.price.toFixed(2)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddLocalItem(item)}
                              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-extrabold flex items-center gap-1 active:scale-95 transition cursor-pointer"
                            >
                              <Plus size={11} strokeWidth={3} /> Add
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Footer Summary & Actions */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-left">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Estimated Total</span>
                <span className="text-xl font-black text-gray-950">₹{localTotal.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForEdit(null)}
                  className="px-5 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 text-sm font-semibold active:scale-95 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveChanges}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer ${
                    isSaving
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/10'
                  }`}
                >
                  {isSaving ? (
                    <><Activity size={16} className="animate-spin" /> Saving…</>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
