import { useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Receipt, Search, ExternalLink, Activity, Trash2, AlertTriangle, Calendar } from 'lucide-react';


interface BillHistoryItem {
  id: string;
  billNumber: string;
  total: number;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  createdAt: string;
  order: {
    notes: string | null;
    table: {
      tableNumber: number;
    };
  };
}

function getCustomerName(notes: string | null): string {
  if (!notes) return 'Guest';
  const match = notes.match(/^Name:\s*([^|]+)/);
  return match ? match[1].trim() : 'Guest';
}

export default function BillingHistoryPage() {
  const [bills, setBills] = useState<BillHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'past'>('today');

  // Merge Mode States
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedMergeIds, setSelectedMergeIds] = useState<string[]>([]);
  const [targetMergeId, setTargetMergeId] = useState<string>('');
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    const fetchBills = async () => {
      try {
        const res = await fetch('/api/bills', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setBills(data);
        }
      } catch (err) {
        console.error('Failed to fetch bills', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, []);

  const handleApprovePayment = async (billId: string) => {
    if (!window.confirm('Are you sure you want to approve this cash payment? This will mark the bill and the order as paid.')) {
      return;
    }

    try {
      const res = await fetch(`/api/bills/${billId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus: 'PAID',
          paymentMethod: 'CASH'
        }),
        credentials: 'include'
      });

      if (res.ok) {
        setBills(prev =>
          prev.map(b =>
            b.id === billId ? { ...b, paymentStatus: 'PAID', paymentMethod: 'CASH' } : b
          )
        );
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to approve payment');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while approving the payment');
    }
  };

  /** Delete a single bill record */
  const handleDeleteBill = async (billId: string, billNumber: string) => {
    if (!window.confirm(`Delete bill #${billNumber}? This will permanently remove the bill and its order from the database.`)) {
      return;
    }
    setDeletingId(billId);
    try {
      const res = await fetch(`/api/bills/${billId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        setBills(prev => prev.filter(b => b.id !== billId));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete bill');
      }
    } catch (err) {
      console.error(err);
      alert('Network error while deleting bill');
    } finally {
      setDeletingId(null);
    }
  };

  /** Delete all records older than 2 days */
  const handleCleanupOldRecords = async () => {
    if (!window.confirm('This will permanently delete all bills and orders older than 2 days. Continue?')) {
      return;
    }
    setCleaning(true);
    try {
      const res = await fetch('/api/bills/cleanup', {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        // Reload the list after cleanup
        const listRes = await fetch('/api/bills');
        if (listRes.ok) setBills(await listRes.json());
        alert(data.message || `Deleted ${data.deleted} old record(s).`);
      } else {
        alert(data.error || 'Failed to cleanup old records');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during cleanup');
    } finally {
      setCleaning(false);
    }
  };

  const handleToggleSelectMerge = (id: string) => {
    setSelectedMergeIds(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(x => x !== id);
        if (next.length < 2) setTargetMergeId('');
        return next;
      }
      if (prev.length >= 2) return prev;
      const next = [...prev, id];
      if (next.length === 2) {
        setTargetMergeId(next[0]);
      }
      return next;
    });
  };

  const handleExecuteMerge = async () => {
    if (selectedMergeIds.length !== 2) return;
    if (!targetMergeId) return;

    const sourceId = selectedMergeIds.find(id => id !== targetMergeId);
    if (!sourceId) return;

    const sourceBill = bills.find(b => b.id === sourceId);
    const targetBill = bills.find(b => b.id === targetMergeId);

    if (!sourceBill || !targetBill) return;

    if (!window.confirm(`Are you sure you want to merge Table ${sourceBill.order.table.tableNumber} bill into Table ${targetBill.order.table.tableNumber} bill? This action is permanent, items will be moved, and Table ${sourceBill.order.table.tableNumber} bill will be deleted.`)) {
      return;
    }

    setMerging(true);
    try {
      const res = await fetch('/api/bills/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceBillId: sourceId,
          targetBillId: targetMergeId
        }),
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        const updatedBill = data.mergedBill;

        setBills(prev =>
          prev
            .filter(b => b.id !== sourceId)
            .map(b => b.id === targetMergeId ? { ...b, ...updatedBill } : b)
        );

        setIsMergeMode(false);
        setSelectedMergeIds([]);
        setTargetMergeId('');
        alert('Bills merged successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to merge bills');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while merging the bills');
    } finally {
      setMerging(false);
    }
  };

  // Helper to check if a bill is created today in the local browser timezone
  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  };

  // Group and categorise today vs past
  const todayBills = bills.filter(b => isToday(b.createdAt));
  const pastBills = bills.filter(b => !isToday(b.createdAt));

  // Determine working bills based on tab
  const activeTabBills = activeTab === 'today' ? todayBills : pastBills;

  // Filter bills based on search query
  const filteredBills = activeTabBills.filter(b => 
    b.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.order.table.tableNumber.toString().includes(searchTerm) ||
    getCustomerName(b.order.notes).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group filtered bills date-wise (descending order)
  const groupBillsByDate = (billsList: BillHistoryItem[]) => {
    const groups: { [dateStr: string]: { dateLabel: string; bills: BillHistoryItem[]; dailyTotal: number } } = {};
    
    const sorted = [...billsList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    sorted.forEach(bill => {
      const d = new Date(bill.createdAt);
      const dateKey = d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      
      const isBillToday = isToday(bill.createdAt);
      const dateLabel = isBillToday 
        ? `Today (${dateKey})` 
        : d.toLocaleDateString('en-IN', {
            weekday: 'long',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });

      if (!groups[dateKey]) {
        groups[dateKey] = {
          dateLabel,
          bills: [],
          dailyTotal: 0
        };
      }
      
      groups[dateKey].bills.push(bill);
      if (bill.paymentStatus === 'PAID') {
        groups[dateKey].dailyTotal += bill.total;
      }
    });
    
    return groups;
  };

  const groupedBills = groupBillsByDate(filteredBills);

  // Revenue stats calculations
  const todayPaidRevenue = todayBills.filter(b => b.paymentStatus === 'PAID').reduce((acc, curr) => acc + curr.total, 0);
  const totalRevenue = bills.filter(b => b.paymentStatus === 'PAID').reduce((acc, curr) => acc + curr.total, 0);

  // Count records older than 2 days for the cleanup badge
  const [mountTime] = useState(() => Date.now());
  const twoDaysAgo = new Date(mountTime - 2 * 24 * 60 * 60 * 1000);
  const oldCount = bills.filter(b => new Date(b.createdAt) < twoDaysAgo).length;

  if (loading) {
    return <div className="p-8 flex justify-center bg-gray-50 min-h-screen"><Activity className="animate-spin text-green-600" size={32} /></div>;
  }

  return (
    <div className="p-6 md:p-8 animate-slide-up">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-serif mb-1">Billing Management</h1>
          <p className="text-gray-500">Monitor today's active orders and manage historical invoice records.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Clear old records button */}
          <button
            onClick={handleCleanupOldRecords}
            disabled={cleaning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition shadow-sm bg-red-50 text-red-700 border-red-200 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title={oldCount === 0 ? 'Purge old bills and orders older than 2 days' : `Delete ${oldCount} record(s) older than 2 days`}
          >
            {cleaning ? (
              <Activity className="animate-spin" size={14} />
            ) : (
              <AlertTriangle size={14} />
            )}
            {cleaning ? 'Clearing...' : `Clear Old Records${oldCount > 0 ? ` (${oldCount})` : ''}`}
          </button>

          <button
            onClick={() => {
              setIsMergeMode(!isMergeMode);
              setSelectedMergeIds([]);
              setTargetMergeId('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition shadow-sm ${
              isMergeMode 
                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {isMergeMode ? 'Cancel Merge' : 'Merge Bills'}
          </button>
          
          <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
            <div className="px-3 py-1 border-r border-gray-100 text-right">
               <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Today's Paid</div>
               <div className="text-sm font-bold text-emerald-600">{formatCurrency(todayPaidRevenue)}</div>
            </div>
            <div className="px-3 py-1 text-right">
               <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Total Revenue</div>
               <div className="text-sm font-bold text-emerald-600">{formatCurrency(totalRevenue)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab switch navigation */}
      <div className="flex border-b border-gray-200 mb-6 gap-2">
        <button
          onClick={() => {
            setActiveTab('today');
            setIsMergeMode(false);
          }}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all -mb-px ${
            activeTab === 'today'
              ? 'border-red-600 text-red-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <span>Today's Orders</span>
          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
            activeTab === 'today' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {todayBills.length}
          </span>
        </button>
        
        <button
          onClick={() => {
            setActiveTab('past');
            setIsMergeMode(false);
          }}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all -mb-px ${
            activeTab === 'past'
              ? 'border-red-600 text-red-600 font-bold'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <span>Past Bills History</span>
          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
            activeTab === 'past' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
          }`}>
            {pastBills.length}
          </span>
        </button>
      </div>

      {isMergeMode && (
        <div className="mb-6 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl shadow-sm animate-slide-up flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-emerald-950 font-medium">
            <h3 className="font-bold text-base mb-1">Bill Merge Assistant</h3>
            {activeTabBills.filter(b => b.paymentStatus !== 'PAID').length < 2 ? (
              <p className="text-amber-700 font-semibold">
                ⚠️ There are not enough unpaid bills in this section to merge. Please ensure at least two tables have active unpaid bills (status PENDING or AWAITING_CONFIRMATION).
              </p>
            ) : selectedMergeIds.length < 2 ? (
              <p className="text-emerald-700">Select exactly two unpaid bills from the list below ({selectedMergeIds.length}/2 selected).</p>
            ) : (
              <div>
                <p className="mb-2">Choose which table keeps the combined bill:</p>
                <div className="flex gap-4">
                  {selectedMergeIds.map(id => {
                    const bill = bills.find(b => b.id === id);
                    if (!bill) return null;
                    return (
                      <label key={id} className="inline-flex items-center gap-2 cursor-pointer font-bold bg-white px-3 py-2 rounded-lg border border-emerald-200">
                        <input
                          type="radio"
                          name="target-bill-selection"
                          checked={targetMergeId === id}
                          onChange={() => setTargetMergeId(id)}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Table {bill.order.table.tableNumber} (Bill {bill.billNumber})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-3 shrink-0">
            <button
              onClick={() => {
                setIsMergeMode(false);
                setSelectedMergeIds([]);
                setTargetMergeId('');
              }}
              className="px-4 py-2 border border-gray-200 rounded-xl bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteMerge}
              disabled={selectedMergeIds.length !== 2 || !targetMergeId || merging}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/10 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {merging ? (
                <>
                  <Activity className="animate-spin" size={16} /> Merging...
                </>
              ) : (
                'Execute Merge'
              )}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
             <input 
               type="text" 
               placeholder="Search by Bill No. or Table Number..." 
               className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
             />
           </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                {isMergeMode && <th className="px-6 py-4 font-semibold text-center w-20">Select</th>}
                <th className="px-6 py-4 font-semibold">Bill No.</th>
                <th className="px-6 py-4 font-semibold">Time</th>
                <th className="px-6 py-4 font-semibold">Table</th>
                <th className="px-6 py-4 font-semibold">Customer</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Method</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {Object.keys(groupedBills).length === 0 ? (
                <tr>
                  <td colSpan={isMergeMode ? 9 : 8} className="px-6 py-12 text-center text-gray-500">
                    <Receipt size={32} className="mx-auto mb-3 text-gray-300" />
                    No bills found.
                  </td>
                </tr>
              ) : (
                Object.entries(groupedBills).map(([dateKey, group]) => (
                  <Fragment key={dateKey}>
                    {/* Full-width Group Header Row */}
                    <tr className="bg-gray-50 border-y border-gray-200 font-semibold text-gray-800">
                      <td colSpan={isMergeMode ? 9 : 8} className="px-6 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar size={15} className="text-gray-400" />
                            <span className="font-bold text-gray-900 text-sm">{group.dateLabel}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-white border border-gray-200 text-gray-600 rounded-full">
                              {group.bills.length} {group.bills.length === 1 ? 'bill' : 'bills'}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                            Paid Revenue: {formatCurrency(group.dailyTotal)}
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Group Bills */}
                    {group.bills.map(bill => {
                      const isOld = new Date(bill.createdAt) < twoDaysAgo;
                      return (
                        <tr key={bill.id} className={`hover:bg-gray-50 transition ${isOld ? 'bg-red-50/30' : ''}`}>
                          {isMergeMode && (
                            <td className="px-6 py-4 text-center">
                              {bill.paymentStatus !== 'PAID' ? (
                                <input
                                  type="checkbox"
                                  checked={selectedMergeIds.includes(bill.id)}
                                  onChange={() => handleToggleSelectMerge(bill.id)}
                                  disabled={selectedMergeIds.length >= 2 && !selectedMergeIds.includes(bill.id)}
                                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                                />
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          )}
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {bill.billNumber}
                            {isOld && <span className="ml-2 text-[9px] font-bold text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Old</span>}
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {new Date(bill.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </td>
                          <td className="px-6 py-4 font-medium">Table {bill.order.table.tableNumber}</td>
                          <td className="px-6 py-4 font-medium text-gray-700">{getCustomerName(bill.order.notes)}</td>
                          <td className="px-6 py-4 font-bold text-right">{formatCurrency(bill.total)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              bill.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {bill.paymentStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center text-gray-500">
                             <div className="font-medium text-gray-900">{bill.paymentMethod || '-'}</div>
                             {bill.paymentReference && (
                                <div className="text-xs text-gray-400 mt-1">{bill.paymentReference}</div>
                             )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {bill.paymentStatus !== 'PAID' && (
                                <button
                                  onClick={() => handleApprovePayment(bill.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition"
                                >
                                  Bill Paid
                                </button>
                              )}
                              <Link 
                                to={`/bill/${bill.id}`}
                                className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-medium text-xs"
                              >
                                 View <ExternalLink size={14}/>
                              </Link>
                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteBill(bill.id, bill.billNumber)}
                                disabled={deletingId === bill.id}
                                title="Delete this bill permanently"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                              >
                                {deletingId === bill.id
                                  ? <Activity size={14} className="animate-spin" />
                                  : <Trash2 size={14} />
                                }
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {Object.keys(groupedBills).length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <Receipt size={32} className="mx-auto mb-3 text-gray-300" />
              No bills found.
            </div>
          ) : (
            Object.entries(groupedBills).map(([dateKey, group]) => (
              <div key={dateKey} className="flex flex-col">
                {/* Mobile Date Header */}
                <div className="bg-gray-50 px-4 py-3 border-y border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-gray-400" />
                    <span className="font-bold text-gray-900 text-xs">{group.dateLabel}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-white border border-gray-200 text-gray-500 rounded-full">
                      {group.bills.length}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                    {formatCurrency(group.dailyTotal)}
                  </span>
                </div>
                
                {/* Bills list */}
                <div className="divide-y divide-gray-100">
                  {group.bills.map(bill => {
                    const isOld = new Date(bill.createdAt) < twoDaysAgo;
                    return (
                      <div key={bill.id} className={`p-4 flex flex-col gap-3 relative ${isOld ? 'bg-red-50/30' : ''}`}>
                        {isMergeMode && bill.paymentStatus !== 'PAID' && (
                          <div className="absolute top-4 right-4 z-10 bg-white/95 p-1 px-2 rounded-lg border border-emerald-100 shadow-sm flex items-center gap-1.5 animate-slide-up">
                            <input
                              type="checkbox"
                              checked={selectedMergeIds.includes(bill.id)}
                              onChange={() => handleToggleSelectMerge(bill.id)}
                              disabled={selectedMergeIds.length >= 2 && !selectedMergeIds.includes(bill.id)}
                              className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                            />
                            <span className="text-[10px] font-bold text-emerald-800">Merge</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-gray-900 flex items-center gap-1.5">
                              #{bill.billNumber}
                              {isOld && <span className="text-[9px] font-bold text-red-500 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Old</span>}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(bill.createdAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                            bill.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {bill.paymentStatus}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm">
                          <div className="font-medium text-gray-700">
                            Table {bill.order.table.tableNumber}
                            <span className="text-xs text-gray-400 font-normal ml-1.5">
                              ({getCustomerName(bill.order.notes)})
                            </span>
                          </div>
                          <div className="font-bold text-gray-900">{formatCurrency(bill.total)}</div>
                        </div>
                        
                        <div className="flex justify-between items-end">
                          <div className="text-xs text-gray-500">
                            {bill.paymentMethod ? (
                              <span className="flex flex-col">
                                <span>{bill.paymentMethod}</span>
                                {bill.paymentReference && <span className="text-[10px] font-mono">{bill.paymentReference}</span>}
                              </span>
                            ) : '-'}
                          </div>
                          <div className="flex gap-2 items-center">
                            {bill.paymentStatus !== 'PAID' && (
                              <button
                                onClick={() => handleApprovePayment(bill.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition"
                              >
                                Bill Paid
                              </button>
                            )}
                            <Link 
                              to={`/bill/${bill.id}`}
                              className="flex items-center gap-1 text-red-600 font-bold text-xs bg-red-50 px-3 py-1.5 rounded-lg"
                            >
                               View Invoice <ExternalLink size={14}/>
                            </Link>
                            
                            {/* Delete button (mobile) */}
                            <button
                              onClick={() => handleDeleteBill(bill.id, bill.billNumber)}
                              disabled={deletingId === bill.id}
                              title="Delete this bill permanently"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition border border-gray-200 disabled:opacity-50"
                            >
                              {deletingId === bill.id
                                ? <Activity size={14} className="animate-spin" />
                                : <Trash2 size={14} />
                              }
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

