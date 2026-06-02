import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BillData, OrderWithItems, MenuItem, MenuCategory } from '@/types';
import { BillDocument } from '@/components/billing/BillPDF';
import {
  FileDown,
  Printer,
  Activity,
  Home,
  CheckCircle2,
  Plus,
  Search,
  Tag,
  Link2,
  Copy,
  Check,
} from 'lucide-react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function BillPage() {
  const { id } = useParams<{ id: string }>();
  const [bill, setBill] = useState<(BillData & { order: OrderWithItems }) | null>(null);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  
  // Extra item form state
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [extraQty, setExtraQty] = useState(1);
  const [extraPrice, setExtraPrice] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Discount state
  const [discountInput, setDiscountInput] = useState('0');
  const [copiedPayUrl, setCopiedPayUrl] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const fetchData = async () => {
      try {
        const [billRes, menuRes] = await Promise.all([
          fetch(`/api/bills/${id}`),
          fetch('/api/menu')
        ]);

        if (billRes.ok) {
          const data = await billRes.json();
          setBill(data);
          setDiscountInput(data.discount.toString());
        }

        if (menuRes.ok) {
          const menuData = await menuRes.json();
          setMenuCategories(menuData);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleMarkPaid = async (method: string) => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/bills/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: 'PAID', paymentMethod: method })
      });
      if (res.ok) {
        const updatedBill = await res.json();
        setBill(prev => prev ? { ...prev, ...updatedBill } : null);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleAddExtraItem = async () => {
    if (!selectedItem) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/bills/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuItemId: selectedItem.id,
          quantity: extraQty,
          price: extraPrice
        })
      });
      if (res.ok) {
        const updatedBill = await res.json();
        setBill(updatedBill);
        setSelectedItem(null);
        setSearchTerm('');
        setExtraQty(1);
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyDiscount = async () => {
    setProcessing(true);
    try {
      const res = await fetch(`/api/bills/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discount: Number(discountInput) })
      });
      if (res.ok) {
        const updatedBill = await res.json();
        setBill(updatedBill);
      }
    } finally {
      setProcessing(false);
    }
  };

  const allItems = menuCategories.flatMap(cat => cat.items);
  const filteredItems = searchTerm 
    ? allItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 5)
    : [];

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Activity className="animate-spin text-gray-500" /></div>;
  if (!bill) return <div className="text-center p-10 font-bold text-xl min-h-screen bg-gray-50">Bill not found</div>;

  const isPaid = bill.paymentStatus === 'PAID';
  const isAwaiting = bill.paymentStatus === 'AWAITING_CONFIRMATION';

  const copyCustomerPayUrl = async () => {
    try {
      const url = `${window.location.origin}/pay/${bill.id}`;
      await navigator.clipboard.writeText(url);
      setCopiedPayUrl(true);
      setTimeout(() => setCopiedPayUrl(false), 2000);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex flex-col md:flex-row gap-8 items-start justify-center">
      {/* Bill Preview / Actions */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden self-center md:self-start animate-slide-up">
        <div className="bg-gray-900 p-6 flex items-center justify-between">
          <h1 className="text-white font-serif font-bold text-xl">Bill No: {bill.billNumber}</h1>
          {isPaid && <span className="bg-green-500 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-1"><CheckCircle2 size={16}/> PAID</span>}
        </div>

        <div className="p-6">
          {/* Bill Table Summary */}
          <div className="mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Billing Details</p>
                <p className="text-sm font-medium text-gray-900 mt-1">Table {bill.order.table.tableNumber} • {formatDate(bill.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Total Payable</p>
                <p className="text-2xl font-black text-gray-900 leading-tight">{formatCurrency(bill.total)}</p>
              </div>
            </div>

            {/* Itemized List */}
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2">
              {bill.order.items.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600"><span className="font-bold">{item.quantity}x</span> {item.menuItem.name}</span>
                  <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 mt-2 pt-2 space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatCurrency(bill.subtotal)}</span>
                </div>
                {bill.taxAmount > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>GST ({bill.subtotal > 0 ? ((bill.taxAmount / bill.subtotal) * 100).toFixed(0) : 2}%)</span>
                    <span>{formatCurrency(bill.taxAmount)}</span>
                  </div>
                )}
                {bill.discount > 0 && (
                  <div className="flex justify-between text-xs font-bold text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(bill.discount)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 mb-8">
            {/* Add Extra Item Section */}
            {!isPaid && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <h3 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Plus size={14}/> Add Extra Item (Post-Service)
                </h3>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16}/>
                  <input 
                    type="text"
                    placeholder="Search menu item..."
                    className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {filteredItems.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 z-10 overflow-hidden">
                      {filteredItems.map(item => (
                        <button 
                          key={item.id}
                          onClick={() => {
                            setSelectedItem(item);
                            setExtraPrice(item.price);
                            setSearchTerm('');
                          }}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 transition border-b border-gray-50 last:border-0"
                        >
                          {item.name} <span className="text-gray-400 ml-2">({formatCurrency(item.price)})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedItem && (
                  <div className="bg-white p-3 rounded-lg border border-green-200 animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm font-bold text-gray-900 mb-2">{selectedItem.name}</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Quantity</label>
                        <input 
                          type="number" 
                          min="1"
                          className="w-full border border-gray-200 rounded p-1.5 text-sm"
                          value={extraQty}
                          onChange={(e) => setExtraQty(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Rate (Manual)</label>
                        <input 
                          type="number"
                          className="w-full border border-gray-200 rounded p-1.5 text-sm font-bold text-red-600"
                          value={extraPrice}
                          onChange={(e) => setExtraPrice(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button 
                        disabled={processing}
                        onClick={handleAddExtraItem}
                        className="flex-1 bg-gray-900 text-white py-2 rounded font-bold text-sm hover:bg-black transition disabled:opacity-50"
                       >
                        Add to Bill
                       </button>
                       <button 
                        onClick={() => setSelectedItem(null)}
                        className="px-3 border border-gray-200 text-gray-400 rounded hover:bg-gray-50"
                       >
                        Cancel
                       </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Discount Section */}
            {!isPaid && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                <h3 className="text-xs font-bold text-green-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Tag size={14}/> Discounts & Offs
                </h3>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-green-600 font-bold text-sm">₹</span>
                    <input 
                      type="number"
                      placeholder="Discount amount"
                      className="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 font-bold text-green-700"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                    />
                  </div>
                  <button 
                    disabled={processing}
                    onClick={handleApplyDiscount}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            {!isPaid && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Link2 size={14} /> Customer pay link
                </h3>
                <p className="text-xs text-blue-800/90 mb-3">
                  Share this link so the guest can pay with UPI or Google Pay on their phone and submit their
                  reference number.
                </p>
                <div className="flex gap-2 items-stretch">
                  <code className="flex-1 text-[11px] bg-white border border-blue-200 rounded-lg px-2 py-2 text-blue-950 break-all">
                    {typeof window !== 'undefined'
                      ? `${window.location.origin}/pay/${bill.id}`
                      : `/pay/${bill.id}`}
                  </code>
                  <button
                    type="button"
                    onClick={copyCustomerPayUrl}
                    className="shrink-0 bg-blue-600 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 hover:bg-blue-700 transition"
                  >
                    {copiedPayUrl ? <Check size={14} /> : <Copy size={14} />}
                    {copiedPayUrl ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {isAwaiting && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">UPI — awaiting confirmation</h3>
                <p className="text-sm text-gray-800">
                  Customer reference:{' '}
                  <span className="font-mono font-bold text-amber-950">{bill.paymentReference || '—'}</span>
                </p>
                <p className="text-xs text-amber-900/90">
                  Verify the amount in your UPI statement, then confirm below. The customer will see paid status
                  and can download the receipt.
                </p>
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleMarkPaid('UPI')}
                  className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 flex items-center justify-center gap-2 font-semibold"
                >
                  <CheckCircle2 size={18} /> Confirm UPI payment received
                </button>
              </div>
            )}

            <h3 className="font-bold text-sm text-gray-400 uppercase tracking-wider">Payment Actions</h3>
            {!isPaid ? (
              <div className="grid grid-cols-2 gap-3">
                <button disabled={processing} onClick={() => handleMarkPaid('CASH')} className="border border-gray-300 rounded-lg p-3 font-semibold hover:border-gray-900 hover:bg-gray-50 transition flex justify-center bg-white">Cash</button>
                <button disabled={processing} onClick={() => handleMarkPaid('UPI')} className="border border-gray-300 rounded-lg p-3 font-semibold hover:border-gray-900 hover:bg-gray-50 transition flex justify-center bg-white">UPI (manual)</button>
                <button disabled={processing} onClick={() => handleMarkPaid('CARD')} className="col-span-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg p-3 font-semibold hover:bg-blue-100 transition flex justify-center">Card / POS</button>
              </div>
            ) : (
                <div className="bg-gray-50 p-4 rounded-lg flex items-center gap-3 border border-gray-100">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600"><CheckCircle2 size={24}/></div>
                  <div>
                    <p className="font-bold text-gray-900">Payment Successful</p>
                    <p className="text-sm text-gray-500">Paid via {bill.paymentMethod || 'Unknown'}</p>
                  </div>
                </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-6 space-y-3">
            {isClient && (
              <PDFDownloadLink 
                document={<BillDocument bill={bill} />} 
                fileName={`${bill.billNumber}.pdf`}
                className="w-full bg-gray-900 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-black transition font-semibold"
              >
                {({ loading }) => loading ? 'Generating PDF...' : <><FileDown size={18}/> Download PDF Receipt</>}
              </PDFDownloadLink>
            )}
            
            <Link to="/dashboard" className="w-full border border-gray-200 text-gray-700 font-medium py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-gray-50 transition font-semibold">
              <Home size={18} /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Actual PDF Viewer on Desktop */}
      <div className="hidden lg:block w-full max-w-2xl bg-white shadow-xl rounded-xl h-[800px] overflow-hidden border border-gray-200">
        <div className="bg-gray-100 p-3 border-b border-gray-200 flex items-center gap-2 text-sm font-medium text-gray-600">
           <Printer size={16}/> Print Preview
        </div>
        {isClient && (
          <PDFViewer width="100%" height="100%" showToolbar={false} className="border-none">
            <BillDocument bill={bill} />
          </PDFViewer>
        )}
      </div>
    </div>
  );
}
