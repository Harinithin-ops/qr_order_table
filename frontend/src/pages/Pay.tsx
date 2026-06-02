import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BillData, OrderWithItems } from '@/types';
import { BillDocument } from '@/components/billing/BillPDF';
import { FileDown, Activity, CheckCircle2, QrCode, Link as LinkIcon, Send } from 'lucide-react';
import { PDFDownloadLink, pdf } from '@react-pdf/renderer';
import { formatCurrency, HOTEL_UPI_ID, HOTEL_NAME } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { useEventSource } from '@/hooks/useEventSource';

export default function CustomerPayPage() {
  const { billId } = useParams<{ billId: string }>();
  const [bill, setBill] = useState<(BillData & { order: OrderWithItems }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [reference, setReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH' | null>(null);
  
  // Use SSE to listen for admin confirming payment
  const { lastEvent } = useEventSource('/api/events');

  const fetchBill = async () => {
    try {
      const res = await fetch(`/api/bills/${billId}`);
      if (res.ok) {
        const data = await res.json();
        setBill(data);
        if (data.paymentMethod) setPaymentMethod(data.paymentMethod as any);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    fetchBill();
  }, [billId]);

  useEffect(() => {
    // Refresh bill if there is an update
    if (lastEvent?.type === 'ORDER_UPDATE' && bill && lastEvent.data.orderId === bill.orderId) {
      fetchBill();
    }
  }, [lastEvent, bill?.orderId]);

  const handleSubmitPayment = async (method: 'UPI' | 'CASH', ref?: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bills/${billId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentMethod: method,
          paymentReference: ref 
        })
      });
      if (res.ok) {
        const updatedBill = await res.json();
        setBill(updatedBill);
        setPaymentMethod(method);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isPaid = bill?.paymentStatus === 'PAID';
  const isAwaiting = bill?.paymentStatus === 'AWAITING_CONFIRMATION';

  // Automatically trigger PDF receipt download on customer phone when payment succeeds
  useEffect(() => {
    if (isPaid && bill) {
      const triggerAutoDownload = async () => {
        try {
          const blob = await pdf(<BillDocument bill={bill} />).toBlob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${bill.billNumber}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } catch (err) {
          console.error('Automatic bill download failed:', err);
        }
      };
      const t = setTimeout(triggerAutoDownload, 800);
      return () => clearTimeout(t);
    }
  }, [isPaid, bill?.id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Activity className="animate-spin text-green-600" size={40} /></div>;
  if (!bill) return <div className="text-center p-10 font-bold text-xl min-h-screen bg-gray-50">Bill not found</div>;
  
  // UPI Deep link standard format
  const upiLink = `upi://pay?pa=${HOTEL_UPI_ID}&pn=${encodeURIComponent(HOTEL_NAME)}&aid=uGICAgKCs-PbMfg&am=${bill.total}&cu=INR&tn=Bill%20${bill.billNumber}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 max-w-md mx-auto shadow-xl">
      <div className="bg-gray-900 text-white p-6 rounded-b-3xl shadow-md text-center">
        <h1 className="text-2xl font-serif font-bold mb-1">{HOTEL_NAME}</h1>
        <p className="text-gray-400 text-sm">Bill No: {bill.billNumber}</p>
      </div>

      <div className="p-4 space-y-6">
        {/* Bill Summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex justify-between items-end mb-4 border-b border-gray-100 pb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider font-bold">Total Payable</p>
              <p className="text-3xl font-black text-gray-900 leading-none mt-1">{formatCurrency(bill.total)}</p>
            </div>
          </div>
          
          <div className="space-y-2 mb-4">
            {bill.order.items.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  <span className="font-bold mr-2">{item.quantity}x</span> 
                  {item.menuItem.name}
                </span>
                <span className="font-medium text-gray-900">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          
          <div className="border-t border-gray-100 pt-3 space-y-1">
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

        {/* Payment Selection */}
        {!isPaid && !isAwaiting && !paymentMethod && (
           <div className="space-y-4 animate-slide-up">
              <h3 className="text-center font-bold text-gray-700">Choose Payment Method</h3>
              <div className="grid grid-cols-1 gap-4">
                 <button 
                   onClick={() => setPaymentMethod('UPI')}
                   className="bg-white border-2 border-blue-50 hover:border-blue-500 p-5 rounded-2xl flex items-center gap-4 transition group"
                 >
                   <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition">
                      <QrCode size={24}/>
                   </div>
                   <div className="text-left">
                      <div className="font-bold text-gray-900">Online UPI</div>
                      <div className="text-xs text-gray-500">GPay, PhonePe, Paytm, etc.</div>
                   </div>
                 </button>

                 <button 
                   onClick={() => handleSubmitPayment('CASH')}
                   disabled={submitting}
                   className="bg-white border-2 border-emerald-50 hover:border-emerald-500 p-5 rounded-2xl flex items-center gap-4 transition group"
                 >
                   <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition">
                      <Activity size={24}/>
                   </div>
                   <div className="text-left">
                      <div className="font-bold text-gray-900">Pay at Counter</div>
                      <div className="text-xs text-gray-500">Cash or Card at counter</div>
                   </div>
                 </button>
              </div>
           </div>
        )}

        {/* UPI Payment Workflow */}
        {!isPaid && !isAwaiting && paymentMethod === 'UPI' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <button 
                onClick={() => setPaymentMethod(null)}
                className="text-xs text-blue-600 font-bold"
              >
                &larr; Change Method
              </button>
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <QrCode size={18} className="text-green-600"/> Scan to Pay
              </h3>
              <div className="w-8"></div>
            </div>
            
            <div className="bg-white p-3 inline-block rounded-xl border-2 border-gray-100 mb-4">
              <QRCodeSVG value={upiLink} size={180} level="M" />
            </div>
            
            {/* UPI ID Display & Copy */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4 flex items-center justify-between text-left">
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">UPI ID</p>
                <p className="text-xs font-mono font-bold text-gray-800">{HOTEL_UPI_ID}</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(HOTEL_UPI_ID);
                  alert('UPI ID copied to clipboard!');
                }}
                className="bg-white hover:bg-gray-50 text-blue-600 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
              >
                Copy
              </button>
            </div>

            {/* Payment App Links */}
            <div className="space-y-3 mb-6 text-left">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select UPI App to Pay</p>
              <div className="grid grid-cols-2 gap-2">
                <a 
                  href={upiLink} 
                  className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition active:scale-95"
                >
                   <span className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center font-bold text-[10px] text-blue-600">G</span>
                   <span className="font-semibold text-xs text-gray-700">Google Pay</span>
                </a>
                <a 
                  href={upiLink} 
                  className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition active:scale-95"
                >
                   <span className="w-6 h-6 rounded-full bg-purple-50 flex items-center justify-center font-bold text-[10px] text-purple-600">P</span>
                   <span className="font-semibold text-xs text-gray-700">PhonePe</span>
                </a>
                <a 
                  href={upiLink} 
                  className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition active:scale-95"
                >
                   <span className="w-6 h-6 rounded-full bg-cyan-50 flex items-center justify-center font-bold text-[10px] text-cyan-600">Py</span>
                   <span className="font-semibold text-xs text-gray-700">Paytm</span>
                </a>
                <a 
                  href={upiLink} 
                  className="flex items-center gap-2 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition active:scale-95"
                >
                   <span className="w-6 h-6 rounded-full bg-green-50 flex items-center justify-center font-bold text-[10px] text-green-600">O</span>
                   <span className="font-semibold text-xs text-gray-700">Other App</span>
                </a>
              </div>
            </div>
            
            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Step 2: Enter Reference Number</p>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitPayment('UPI', reference);
                }} 
                className="flex flex-col gap-3"
              >
                <input 
                  type="text" 
                  required
                  placeholder="Paste UTR / Transaction ID" 
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 text-center uppercase font-mono"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                />
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 font-semibold"
                >
                  {submitting ? 'Submitting...' : <><Send size={16}/> I have Paid</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {isAwaiting && (
          <div className={`${bill.paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-200' : 'bg-yellow-50 border-yellow-200'} rounded-2xl border p-6 text-center shadow-sm animate-slide-up`}>
            <div className={`w-16 h-16 ${bill.paymentMethod === 'CASH' ? 'bg-emerald-100 text-emerald-600' : 'bg-yellow-100 text-yellow-600'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <Activity size={32} className="animate-pulse" />
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {bill.paymentMethod === 'CASH' ? 'Proceed to Counter' : 'Payment Under Review'}
            </h2>
            
            {bill.paymentMethod === 'CASH' ? (
              <p className="text-emerald-800 text-sm mb-4">
                Please visit the counter with your Table Number <span className="font-bold underline">({bill.order.table.tableNumber})</span> to complete the payment.
              </p>
            ) : (
              <p className="text-gray-600 text-sm mb-4">
                Reference: <span className="font-bold uppercase font-mono">{bill.paymentReference}</span>
              </p>
            )}

            <div className="p-3 bg-white/50 rounded-lg border border-dashed border-gray-200 text-xs text-gray-500">
              The cashier has been notified. This page will update once the payment is confirmed.
            </div>
          </div>
        )}

        {isPaid && (
          <div className="bg-green-50 rounded-2xl border border-green-200 p-6 text-center animate-slide-up">
            <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Payment Successful!</h2>
            <p className="text-green-700 text-sm mb-6">Thank you for dining with {HOTEL_NAME}.</p>
            
            {isClient && (
              <PDFDownloadLink 
                document={<BillDocument bill={bill} />} 
                fileName={`${bill.billNumber}.pdf`}
                className="w-full bg-white text-gray-900 font-bold border-2 border-gray-900 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition"
              >
                {({ loading }) => loading ? 'Generating Receipt...' : <><FileDown size={18}/> Download Receipt</>}
              </PDFDownloadLink>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
