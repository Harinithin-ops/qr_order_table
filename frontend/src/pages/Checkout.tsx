import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BillData, OrderWithItems } from '@/types';
import { useEventSource } from '@/hooks/useEventSource';
import { BillDocument } from '@/components/billing/BillPDF';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { formatCurrency, HOTEL_UPI_ID, HOTEL_NAME } from '@/lib/utils';
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
  HelpCircle,
  ShoppingBag,
  Loader2,
  Clock,
} from 'lucide-react';

export default function CheckoutPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  // unified bill (after checkout merges all orders)
  const [bill, setBill] = useState<(BillData & { order: OrderWithItems }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH' | null>(null);
  const [isClient, setIsClient] = useState(false);

  const [tableUuid, setTableUuid] = useState<string | null>(null);

  const { lastEvent } = useEventSource('/api/events');

  const handleCheckout = useCallback(async () => {
    if (!tableId) return;
    setError('');
    setLoading(true);
    try {
      const rawSession = localStorage.getItem(`kh_customer_session_${tableId}`);
      let email = null;
      if (rawSession) {
        try {
          email = JSON.parse(rawSession).email;
        } catch {}
      }

      const res = await fetch(`/api/tables/${tableId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to generate unified bill.');
        if (data.tableId) {
          setTableUuid(data.tableId);
        }
        return;
      }
      setBill(data);
      if (data.order?.tableId) {
        setTableUuid(data.order.tableId);
      }
      // After checkout succeeds, persist the bill ID so refreshing restores the bill
      sessionStorage.setItem(`kh_checkout_bill_${tableId}`, data.id);
      // After checkout succeeds, clear all per-order session keys and store the merged bill's orderId
      // so that the menu banners know there's now one unified order
      sessionStorage.removeItem(`kh_orders_${tableId}`);
      sessionStorage.setItem(`kh_orders_${tableId}`, JSON.stringify([data.orderId]));
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  // Re-fetch the bill if it already exists
  const refetchBill = useCallback(async (billId: string) => {
    const res = await fetch(`/api/bills/${billId}`);
    if (res.ok) {
      const data = await res.json();
      setBill(data);
      if (data.paymentMethod) setPaymentMethod(data.paymentMethod as any);
      if (data.order?.tableId) {
        setTableUuid(data.order.tableId);
      }
    } else {
      // If fetching the specific bill ID fails (e.g. 404 due to merge/deletion),
      // clear the invalid ID and run table checkout to recover/refresh the unified bill
      sessionStorage.removeItem(`kh_checkout_bill_${tableId}`);
      handleCheckout();
    }
  }, [tableId, handleCheckout]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // On mount: restore an existing bill from sessionStorage or run handleCheckout to fetch/lock
  useEffect(() => {
    if (!tableId) return;
    const savedBillId = sessionStorage.getItem(`kh_checkout_bill_${tableId}`);
    if (savedBillId) {
      refetchBill(savedBillId);
    } else {
      handleCheckout();
    }
  }, [tableId, refetchBill, handleCheckout]);

  // SSE: refresh bill on updates
  useEffect(() => {
    if (lastEvent?.type !== 'ORDER_UPDATE') return;
    const payload = lastEvent.data as { billId?: string; tableId?: string };
    
    // Check if the event matches this table (either by database UUID or by parameter slug/ID)
    const isTargetTable = (tableUuid && payload.tableId === tableUuid) || (payload.tableId === tableId);

    if (bill?.id) {
      if (payload.billId === bill.id || isTargetTable) {
        setTimeout(() => refetchBill(bill.id), 500);
      }
    } else if (isTargetTable) {
      setTimeout(() => handleCheckout(), 500);
    }
  }, [lastEvent, bill?.id, tableId, tableUuid, refetchBill, handleCheckout]);

  const handleSubmitPayment = async (method: 'UPI' | 'CASH', ref?: string) => {
    if (!bill?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bills/${bill.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: method, paymentReference: ref }),
      });
      if (res.ok) {
        await refetchBill(bill.id);
        setPaymentMethod(method);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to submit payment.');
    } finally {
      setSubmitting(false);
    }
  };

  // When paid, clear all session order data and the saved bill ID
  useEffect(() => {
    if (bill?.paymentStatus === 'PAID' && tableId) {
      sessionStorage.removeItem(`kh_orders_${tableId}`);
      sessionStorage.removeItem(`kh_order_${tableId}`);
      sessionStorage.removeItem(`kh_checkout_bill_${tableId}`);
    }
  }, [bill?.paymentStatus, tableId]);

  const isPaid = bill?.paymentStatus === 'PAID';
  const isAwaiting = bill?.paymentStatus === 'AWAITING_CONFIRMATION';

  const upiLink = bill
    ? `upi://pay?pa=${HOTEL_UPI_ID}&pn=${encodeURIComponent(HOTEL_NAME)}&am=${bill.total}&cu=INR&tn=Bill%20${bill.billNumber}`
    : '';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto shadow-xl flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center border-b border-gray-100 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 mr-3 transition"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900 leading-tight">Unified Checkout</h1>
          <p className="text-[10px] text-gray-400 font-semibold bg-gray-100 px-2 py-0.5 rounded-full inline-block mt-0.5">
            All Orders Combined
          </p>
        </div>
        <ShoppingBag size={20} className="text-red-500" />
      </div>

      <div className="p-4 space-y-5 flex-1">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-800 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Initiate Checkout */}
        {!bill && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center space-y-4 animate-slide-up">
            <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-500 animate-pulse">
              <Clock size={28} />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-gray-900">Awaiting Waiter Billing</h2>
              <p className="text-xs text-gray-500 mt-1 px-2 leading-relaxed">
                Your combined bill is being processed. Once the waiter generates it, you'll be able to make the payment here.
              </p>
            </div>

            <button
              onClick={() => navigate(-1)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl text-sm transition active:scale-95 shadow-md shadow-amber-500/10"
            >
              Back to Menu
            </button>
          </div>
        )}

        {/* Bill Summary (shown after checkout) */}
        {bill && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-50 pb-3">
              <Receipt size={15} className="text-gray-400" />
              <h3 className="text-xs font-extrabold text-gray-800 uppercase tracking-widest">
                Combined Bill Summary
              </h3>
              <span className="ml-auto text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                Bill No: {bill.billNumber}
              </span>
            </div>

            <div className="space-y-2.5 mb-4">
              {bill.order?.items?.map((item) => (
                <div key={item.id} className="flex justify-between text-xs">
                  <span className="text-gray-700">
                    <span className="font-bold mr-1.5 text-gray-900">{item.quantity}×</span>
                    {item.menuItem.name}
                  </span>
                  <span className="font-semibold text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-1.5 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(bill.subtotal)}</span>
              </div>
              {bill.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span>GST ({bill.subtotal > 0 ? ((bill.taxAmount / bill.subtotal) * 100).toFixed(0) : 2}%)</span>
                  <span>{formatCurrency(bill.taxAmount)}</span>
                </div>
              )}
              {bill.discount > 0 && (
                <div className="flex justify-between text-green-600 font-bold">
                  <span>Discount</span>
                  <span>−{formatCurrency(bill.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold text-gray-950 border-t border-dashed border-gray-200 pt-2 mt-2">
                <span>Total Payable</span>
                <span>{formatCurrency(bill.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment Method Selection */}
        {bill && !isPaid && !isAwaiting && !paymentMethod && (
          <div className="space-y-4 animate-slide-up">
            <h3 className="text-center font-extrabold text-gray-800 text-sm uppercase tracking-widest">
              Choose Payment Method
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => setPaymentMethod('UPI')}
                className="bg-white border-2 border-blue-50 hover:border-blue-500 p-5 rounded-2xl flex items-center gap-4 transition group text-left cursor-pointer"
              >
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                  <QrCode size={24} />
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
                  <CreditCard size={24} />
                </div>
                <div>
                  <div className="font-extrabold text-gray-900 text-sm">Pay at Counter</div>
                  <div className="text-xs text-gray-500 mt-0.5">Pay cash or swipe card at counter</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* UPI Scan to Pay */}
        {bill && !isPaid && !isAwaiting && paymentMethod === 'UPI' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center animate-slide-up space-y-5">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <button onClick={() => setPaymentMethod(null)} className="text-xs text-blue-600 font-bold hover:underline">
                &larr; Back
              </button>
              <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-1.5">
                <QrCode size={18} className="text-blue-600" /> Scan to Pay
              </h3>
              <div className="w-8" />
            </div>

            <div className="bg-white p-3 inline-block rounded-xl border-2 border-gray-100 shadow-sm">
              <QRCodeSVG value={upiLink} size={180} level="M" />
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between text-left">
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">UPI ID</p>
                <p className="text-xs font-mono font-extrabold text-gray-800">{HOTEL_UPI_ID}</p>
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(HOTEL_UPI_ID); alert('UPI ID copied!'); }}
                className="bg-white hover:bg-gray-50 text-blue-600 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
              >
                Copy
              </button>
            </div>

            <div className="text-left space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Select UPI App to Pay</p>
              <div className="grid grid-cols-2 gap-2">
                {[['G','Google Pay','blue'],['P','PhonePe','purple'],['Py','Paytm','cyan'],['O','Other App','green']].map(([letter, label, color]) => (
                  <a key={label} href={upiLink} className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition active:scale-95">
                    <span className={`w-6 h-6 rounded-full bg-${color}-50 flex items-center justify-center font-bold text-[10px] text-${color}-600`}>{letter}</span>
                    <span className="font-bold text-xs text-gray-700">{label}</span>
                  </a>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 text-left">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2.5">Enter Transaction Reference</p>
              <form
                onSubmit={(e) => { e.preventDefault(); handleSubmitPayment('UPI', reference); }}
                className="flex flex-col gap-3.5"
              >
                <input
                  type="text"
                  required
                  placeholder="UTR / Transaction Ref Number"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-center uppercase font-mono"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-extrabold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-md"
                >
                  {submitting ? 'Submitting...' : <><Send size={15} /> I have Paid</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Awaiting confirmation */}
        {bill && isAwaiting && (
          <div className={`${bill.paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-200' : 'bg-yellow-50 border-yellow-200'} rounded-2xl border p-6 text-center shadow-sm animate-slide-up space-y-4`}>
            <div className={`w-16 h-16 ${bill.paymentMethod === 'CASH' ? 'bg-emerald-100 text-emerald-600' : 'bg-yellow-100 text-yellow-600'} rounded-full flex items-center justify-center mx-auto`}>
              <Activity size={32} className="animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {bill.paymentMethod === 'CASH' ? 'Proceed to Counter' : 'Payment Under Review'}
            </h2>
            {bill.paymentMethod === 'CASH' ? (
              <p className="text-emerald-800 text-xs px-2 leading-relaxed">
                Please visit the counter to complete payment for your combined bill.
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

        {/* Paid - success */}
        {bill && isPaid && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center shadow-sm animate-slide-up space-y-5">
            <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-200">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900">Payment Successful!</h2>
              <p className="text-green-700 text-xs mt-1">Thank you for dining with {HOTEL_NAME}.</p>
            </div>
            {isClient && bill.order && (
              <PDFDownloadLink
                document={<BillDocument bill={bill} />}
                fileName={`${bill.billNumber}.pdf`}
                className="w-full bg-white text-gray-950 font-bold border-2 border-gray-950 py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition active:scale-[0.98]"
              >
                {({ loading: pdfLoading }) => pdfLoading ? 'Generating Receipt...' : <><FileDown size={18} /> Download Receipt</>}
              </PDFDownloadLink>
            )}
            <Link
              to={`/menu/${tableId}`}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl block text-sm active:scale-[0.98] transition-transform"
            >
              Order Something Else / Go back
            </Link>
          </div>
        )}
      </div>

      <div className="p-4 text-center">
        <p className="text-[10px] text-gray-400 flex items-center justify-center gap-1">
          <HelpCircle size={10} /> Need help? Ask your waiter or go to the cash counter.
        </p>
      </div>
    </div>
  );
}
