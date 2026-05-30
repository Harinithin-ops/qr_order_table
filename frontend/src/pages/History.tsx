import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Receipt, Search, ExternalLink, Activity } from 'lucide-react';

interface BillHistoryItem {
  id: string;
  billNumber: string;
  total: number;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  createdAt: string;
  order: {
    table: {
      tableNumber: number;
    };
  };
}

export default function BillingHistoryPage() {
  const [bills, setBills] = useState<BillHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchBills = async () => {
      try {
        const res = await fetch('/api/bills');
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
        })
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

  const filteredBills = bills.filter(b => 
    b.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.order.table.tableNumber.toString().includes(searchTerm)
  );

  const totalRevenue = bills.filter(b => b.paymentStatus === 'PAID').reduce((acc, curr) => acc + curr.total, 0);

  if (loading) {
    return <div className="p-8 flex justify-center bg-gray-50 min-h-screen"><Activity className="animate-spin text-green-600" size={32} /></div>;
  }

  return (
    <div className="p-6 md:p-8 animate-slide-up">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-serif mb-1">Billing History</h1>
          <p className="text-gray-500">View and manage past invoices and completed orders.</p>
        </div>
        
        <div className="bg-white px-6 py-3 rounded-xl shadow-sm border border-gray-200 text-right">
           <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total Paid Revenue</div>
           <div className="text-xl font-bold text-emerald-600">{formatCurrency(totalRevenue)}</div>
        </div>
      </div>

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
                <th className="px-6 py-4 font-semibold">Bill No.</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Table</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Method</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <Receipt size={32} className="mx-auto mb-3 text-gray-300" />
                    No bills found.
                  </td>
                </tr>
              ) : (
                filteredBills.map(bill => (
                  <tr key={bill.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-gray-900">{bill.billNumber}</td>
                    <td className="px-6 py-4 text-gray-500">{formatDate(bill.createdAt)}</td>
                    <td className="px-6 py-4 font-medium">Table {bill.order.table.tableNumber}</td>
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
                            Approve Cash
                          </button>
                        )}
                        <Link 
                          to={`/bill/${bill.id}`}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-medium text-xs"
                        >
                           View <ExternalLink size={14}/>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredBills.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <Receipt size={32} className="mx-auto mb-3 text-gray-300" />
              No bills found.
            </div>
          ) : (
            filteredBills.map(bill => (
              <div key={bill.id} className="p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-900">#{bill.billNumber}</div>
                    <div className="text-xs text-gray-400">{formatDate(bill.createdAt)}</div>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    bill.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {bill.paymentStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="font-medium text-gray-700">Table {bill.order.table.tableNumber}</div>
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
                  <div className="flex gap-2">
                    {bill.paymentStatus !== 'PAID' && (
                      <button
                        onClick={() => handleApprovePayment(bill.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition"
                      >
                        Approve Cash
                      </button>
                    )}
                    <Link 
                      to={`/bill/${bill.id}`}
                      className="flex items-center gap-1 text-red-600 font-bold text-xs bg-red-50 px-3 py-1.5 rounded-lg"
                    >
                       View Invoice <ExternalLink size={14}/>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
