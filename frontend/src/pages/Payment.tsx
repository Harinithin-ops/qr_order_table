import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { OrderWithItems, BillData } from '@/types';
import { useEventSource } from '@/hooks/useEventSource';
import { BillDocument } from '@/components/billing/BillPDF';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { formatCurrency, HOTEL_UPI_ID, HOTEL_NAME, formatDate } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { 
  ArrowLeft, 
  CreditCard, 
  Receipt, 
  CheckCircle2, 
  QrCode, 
  Send, 
  FileDown, 
  Activity, 
  AlertTriangle,
  HelpCircle
} from 'lucide-react';

export default function CustomerPaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reference, setReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH' | null>(null);
  const [isClient, setIsClient] = useState(false);

  // SSE updates for live state sync
  const { lastEvent } = useEventSource('/api/events');

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
        if (data.bill) {
          if (data.bill.paymentMethod) {
            setPaymentMethod(data.bill.paymentMethod as any);
          }
        }
      }
    } catch (e) {
      console.error('Error fetching order:', e);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    setIsClient(true);
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (lastEvent?.type !== 'ORDER_UPDATE') return;
    const payload = lastEvent.data as { orderId?: string };
    if (payload.orderId !== orderId) return;

    const timer = setTimeout(() => {
      fetchOrder();
    }, 500);
    return () => clearTimeout(timer);
  }, [lastEvent, orderId, fetchOrder]);

  const handleCloseOrder = async () => {
    if (!orderId) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/generate-bill`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchOrder();
      } else {
        alert('Failed to generate bill. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error generating bill.');
    } finally {
      setClosing(false);
    }
  };

  const handleSubmitPayment = async (method: 'UPI' | 'CASH', ref?: string) => {
    if (!order?.bill?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bills/${order.bill.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentMethod: method,
          paymentReference: ref 
        })
      });
      if (res.ok) {
        await fetchOrder();
        setPaymentMethod(method);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to submit payment details.');
    } finally {
      setSubmitting(false);
    }
  };

  // Clear session order ID when payment is fully complete
  useEffect(() => {
    if (order?.bill?.paymentStatus === 'PAID' && order.table?.slug) {
      sessionStorage.removeItem(`kh_order_${order.table.slug}`);
      sessionStorage.removeItem(`kh_order_${order.tableId}`);
    }
  }, [order?.bill?.paymentStatus, order?.table?.slug, order?.tableId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Activity className="animate-spin text-green-600" size={40} />
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

  const hasBill = !!order.bill;
  const bill = order.bill;
  const isPaid = bill?.paymentStatus === 'PAID';
  const isAwaiting = bill?.paymentStatus === 'AWAITING_CONFIRMATION';

  // Calculate temporary totals if bill is not yet generated
  const taxRate = 0.02; // Standard 2% GST
  const subtotal = order.total;
  const taxAmount = subtotal * taxRate;
  const totalAmount = subtotal + taxAmount;

  // UPI deep link
  const upiLink = bill ? `upi://pay?pa=${HOTEL_UPI_ID}&pn=${encodeURIComponent(HOTEL_NAME)}&aid=uGICAgKCs-PbMfg&am=${bill.total}&cu=INR&tn=Bill%20${bill.billNumber}` : '';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto shadow-xl flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button 
          onClick={() => navigate(`/track/${orderId}`)}
          className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 mr-3 transition"
          aria-label="Back to tracking"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900 leading-tight">Checkout</h1>
          <p className="text-[10px] text-gray-400 font-semibold bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
            Table {order.table.tableNumber}
          </p>
        </div>
      </div>

      <div className="p-4 space-y-6 flex-1">
        {/* Bill Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Receipt size={15} className="text-gray-400" /> Order Summary
          </h3>
          
          <div className="space-y-3 mb-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-xs">
                <span className="text-gray-600">
                  <span className="font-bold mr-2 text-gray-800">{item.quantity}x</span> 
                  {item.menuItem.name}
                </span>
                <span className="font-semibold text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(hasBill ? bill.subtotal : subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST ({hasBill && bill.subtotal > 0 ? ((bill.taxAmount / bill.subtotal) * 100).toFixed(0) : (taxRate * 100)}%)</span>
              <span>{formatCurrency(hasBill ? bill.taxAmount : taxAmount)}</span>
            </div>
            {hasBill && bill.discount > 0 && (
              <div className="flex justify-between text-xs font-bold text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(bill.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-gray-950 border-t border-dashed border-gray-200 pt-2 mt-2">
              <span>Total Payable</span>
              <span>{formatCurrency(hasBill ? bill.total : totalAmount)}</span>
            </div>
          </div>
        </div>

        {/* WORKFLOW PHASE 1: Open / Close Order Screen */}
        {!hasBill && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4 animate-slide-up text-center">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500">
              <AlertTriangle size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-gray-900 text-base">Ready to Pay?</h4>
              <p className="text-xs text-gray-500 px-2 leading-relaxed">
                Closing the order locks your current table items and creates your final invoice. You won't be able to add more dishes to this order.
              </p>
            </div>

            <button
              onClick={handleCloseOrder}
              disabled={closing}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/10 active:scale-95 transition-transform cursor-pointer text-sm"
            >
              {closing ? 'Generating Bill...' : 'Close Order & Proceed to Bill'}
            </button>
            
            <button
              onClick={() => navigate(`/menu/${order.table.slug || order.tableId}`)}
              className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 py-2.5 rounded-xl text-xs font-bold transition active:scale-95"
            >
              Keep Ordering
            </button>
          </div>
        )}

        {/* WORKFLOW PHASE 2: Closed Order - Select Payment Method */}
        {hasBill && !isPaid && !isAwaiting && !paymentMethod && (
          <div className="space-y-4 animate-slide-up">
            <h3 className="text-center font-extrabold text-gray-800 text-sm uppercase tracking-widest">Choose Payment Method</h3>
            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => setPaymentMethod('UPI')}
                className="bg-white border-2 border-blue-50 hover:border-blue-500 p-5 rounded-2xl flex items-center gap-4 transition group text-left cursor-pointer"
              >
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                  <QrCode size={24}/>
                </div>
                <div>
                  <div className="font-extrabold text-gray-900 text-sm">Pay Online (UPI)</div>
                  <div className="text-xs text-gray-500 mt-0.5">GPay, PhonePe, Paytm, etc.</div>
                </div>
              </button>

              <button 
                onClick={() => handleSubmitPayment('CASH')}
                disabled={submitting}
                className="bg-white border-2 border-emerald-50 hover:border-emerald-500 p-5 rounded-2xl flex items-center gap-4 transition group text-left cursor-pointer"
              >
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                  <CreditCard size={24}/>
                </div>
                <div>
                  <div className="font-extrabold text-gray-900 text-sm">Pay at Counter</div>
                  <div className="text-xs text-gray-500 mt-0.5">Pay cash or swipe card at counter</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* WORKFLOW PHASE 3: UPI Verification screen */}
        {hasBill && !isPaid && !isAwaiting && paymentMethod === 'UPI' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center animate-slide-up space-y-5">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <button 
                onClick={() => setPaymentMethod(null)}
                className="text-xs text-blue-600 font-bold hover:underline"
              >
                &larr; Back
              </button>
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                <QrCode size={18} className="text-blue-600"/> Scan to Pay
              </h3>
              <div className="w-8"></div>
            </div>
            
            <div className="bg-white p-3 inline-block rounded-xl border-2 border-gray-100 shadow-sm">
              <QRCodeSVG value={upiLink} size={180} level="M" />
            </div>
            
            {/* UPI ID Display & Copy */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between text-left">
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">UPI ID</p>
                <p className="text-xs font-mono font-extrabold text-gray-800">{HOTEL_UPI_ID}</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(HOTEL_UPI_ID);
                  alert('UPI ID copied!');
                }}
                className="bg-white hover:bg-gray-50 text-blue-600 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
              >
                Copy
              </button>
            </div>

            {/* Payment App Links */}
            <div className="text-left space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select UPI App to Pay</p>
              <div className="grid grid-cols-2 gap-2">
                <a href={upiLink} className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition active:scale-95">
                  <span className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center font-bold text-[10px] text-blue-600">G</span>
                  <span className="font-bold text-xs text-gray-700">Google Pay</span>
                </a>
                <a href={upiLink} className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition active:scale-95">
                  <span className="w-6 h-6 rounded-full bg-purple-50 flex items-center justify-center font-bold text-[10px] text-purple-600">P</span>
                  <span className="font-bold text-xs text-gray-700">PhonePe</span>
                </a>
                <a href={upiLink} className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition active:scale-95">
                  <span className="w-6 h-6 rounded-full bg-cyan-50 flex items-center justify-center font-bold text-[10px] text-cyan-600">Py</span>
                  <span className="font-bold text-xs text-gray-700">Paytm</span>
                </a>
                <a href={upiLink} className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition active:scale-95">
                  <span className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center font-bold text-[10px] text-green-600">O</span>
                  <span className="font-bold text-xs text-gray-700">Other App</span>
                </a>
              </div>
            </div>
            
            <div className="border-t border-gray-100 pt-4 text-left">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2.5">Enter Transaction Reference</p>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitPayment('UPI', reference);
                }} 
                className="flex flex-col gap-3.5"
              >
                <input 
                  type="text" 
                  required
                  placeholder="UTR / Transaction Ref Number" 
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-center uppercase font-mono"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                />
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-extrabold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-md"
                >
                  {submitting ? 'Submitting...' : <><Send size={15}/> I have Paid</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* WORKFLOW PHASE 4: Cash confirmation / Pending status */}
        {hasBill && isAwaiting && (
          <div className={`${bill.paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-200' : 'bg-yellow-50 border-yellow-200'} rounded-2xl border p-6 text-center shadow-sm animate-slide-up space-y-4`}>
            <div className={`w-16 h-16 ${bill.paymentMethod === 'CASH' ? 'bg-emerald-100 text-emerald-600' : 'bg-yellow-100 text-yellow-600'} rounded-full flex items-center justify-center mx-auto mb-2`}>
              <Activity size={32} className="animate-pulse" />
            </div>
            
            <h2 className="text-lg font-bold text-gray-900">
              {bill.paymentMethod === 'CASH' ? 'Proceed to Counter' : 'Payment Under Review'}
            </h2>
            
            {bill.paymentMethod === 'CASH' ? (
              <p className="text-emerald-800 text-xs px-2 leading-relaxed">
                Please visit the counter with your Table Number <span className="font-bold underline">({order.table.tableNumber})</span> to complete the payment.
              </p>
            ) : (
              <p className="text-gray-600 text-xs px-2 leading-relaxed">
                Reference: <span className="font-bold uppercase font-mono">{bill.paymentReference}</span>
              </p>
            )}

            <div className="p-3 bg-white/60 rounded-xl border border-dashed border-gray-200 text-[11px] text-gray-500">
              The cashier has been notified. This page will update once the payment is confirmed.
            </div>
          </div>
        )}

        {/* WORKFLOW PHASE 5: Paid Successful receipt view */}
        {hasBill && isPaid && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center shadow-sm animate-slide-up space-y-5">
            <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-200">
              <CheckCircle2 size={32} />
            </div>
            
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Payment Successful!</h2>
              <p className="text-green-700 text-xs mt-1">Thank you for dining with {HOTEL_NAME}.</p>
            </div>
            
            {isClient && (
              <PDFDownloadLink 
                document={<BillDocument bill={{ ...bill, order }} />} 
                fileName={`${bill.billNumber}.pdf`}
                className="w-full bg-white text-gray-950 font-bold border-2 border-gray-950 py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition active:scale-[0.98]"
              >
                {({ loading }) => loading ? 'Generating Receipt...' : <><FileDown size={18}/> Download Receipt</>}
              </PDFDownloadLink>
            )}

            <Link 
              to={`/menu/${order.table.slug || order.tableId}`}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl block text-sm active:scale-[0.98] transition-transform"
            >
              Order Something Else / Go back
            </Link>
          </div>
        )}
      </div>

      {/* Static help message at bottom */}
      <div className="p-4 text-center">
        <p className="text-[10px] text-gray-400 flex items-center justify-center gap-1">
          <HelpCircle size={10} /> Need help? Ask your waiter or go to the cash counter.
        </p>
      </div>
    </div>
  );
}
