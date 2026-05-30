import { useEffect, useState } from 'react';
import { BillData, OrderWithItems } from '@/types';
import { 
  Printer, 
  Activity, 
  Search, 
  Receipt, 
  CheckCircle, 
  AlertCircle, 
  Copy, 
  Check, 
  Sliders 
} from 'lucide-react';
import { formatCurrency, formatDate, HOTEL_NAME, HOTEL_ADDRESS, HOTEL_PHONE, HOTEL_GST } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

export default function BillMachinePage() {
  const [bills, setBills] = useState<(BillData & { order: OrderWithItems })[]>([]);
  const [selectedBill, setSelectedBill] = useState<(BillData & { order: OrderWithItems }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom print options
  const [showGST, setShowGST] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const fetchBills = async () => {
      try {
        const res = await fetch('/api/bills');
        if (res.ok) {
          const data = await res.json();
          setBills(data);
          if (data.length > 0) {
            // Select the most recent bill by default
            setSelectedBill(data[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch bills', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBills();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const copyPayLink = async (billId: string) => {
    try {
      const url = `${window.location.origin}/pay/${billId}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredBills = bills.filter(b => 
    b.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.order.table.tableNumber.toString().includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="p-8 flex justify-center bg-gray-50 min-h-screen items-center">
        <Activity className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-slide-up max-w-6xl mx-auto">
      {/* Stylesheet specifically for printing the thermal receipt roll */}
      <style>{`
        @media print {
          /* Hide everything on the page */
          body * {
            visibility: hidden;
            background: none !important;
          }
          /* Show only the thermal receipt container */
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm; /* Standard 3-inch/80mm thermal roll width */
            margin: 0;
            padding: 4mm;
            border: none;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          @page {
            size: auto;
            margin: 0mm;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-serif mb-1 flex items-center gap-2">
            <Printer className="text-red-600" size={24} /> Bill Machine Dashboard
          </h1>
          <p className="text-gray-500 text-sm">Select orders to print professional thermal receipts.</p>
        </div>

        {/* Printer Status */}
        <div className="flex items-center gap-2.5 bg-white border border-gray-200 px-4 py-2.5 rounded-xl shadow-sm self-start md:self-auto text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-semibold text-gray-700">TVS RP 3230</span>
          <span className="text-gray-400 font-medium">|</span>
          <span className="text-gray-500 font-bold text-xs uppercase tracking-wider">Ready (System Printer)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Recent Bills List */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-[650px]">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search by Bill No. or Table..." 
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-sm bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-150">
            {filteredBills.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                <Receipt size={36} className="mx-auto mb-2 text-gray-300" />
                No bills found.
              </div>
            ) : (
              filteredBills.map(bill => {
                const isSelected = selectedBill?.id === bill.id;
                const isPaid = bill.paymentStatus === 'PAID';
                
                return (
                  <button
                    key={bill.id}
                    onClick={() => setSelectedBill(bill)}
                    className={`w-full text-left p-4 transition flex justify-between items-start ${
                      isSelected ? 'bg-red-50/70 border-l-4 border-red-600' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-gray-900 text-sm">#{bill.billNumber}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Table {bill.order.table.tableNumber} • {formatDate(bill.createdAt)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        {isPaid ? (
                          <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-bold border border-green-100 flex items-center gap-0.5">
                            <CheckCircle size={10} /> Paid
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100 flex items-center gap-0.5">
                            <AlertCircle size={10} /> Unpaid
                          </span>
                        )}
                        <span className="text-xs font-mono text-gray-400">({bill.order.items.length} items)</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-gray-900 text-base">{formatCurrency(bill.total)}</div>
                      <div className="text-[10px] text-gray-400 mt-1 uppercase font-bold tracking-wider">Total</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Printing Toggles & Live Preview */}
        {selectedBill ? (
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Control Panel */}
            <div className="md:col-span-5 bg-white border border-gray-200 p-5 rounded-2xl shadow-sm space-y-5">
              <h3 className="font-bold text-gray-800 text-sm border-b border-gray-150 pb-2 flex items-center gap-1.5">
                <Sliders size={16} className="text-gray-500" /> Print Settings
              </h3>
              
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showGST} 
                    onChange={e => setShowGST(e.target.checked)}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-semibold text-gray-700">Include GST/Tax</span>
                    <p className="text-[10px] text-gray-400">Shows GST (2%) breakdown</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={showQR} 
                    onChange={e => setShowQR(e.target.checked)}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-semibold text-gray-700">Include UPI Pay QR</span>
                    <p className="text-[10px] text-gray-400">Appends scanning code for online payments</p>
                  </div>
                </label>
              </div>

              <div className="border-t border-gray-150 pt-4 space-y-3">
                <button
                  onClick={handlePrint}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/10 active:scale-95 transition-transform"
                >
                  <Printer size={18} /> Print Receipt (TVS)
                </button>

                <button
                  onClick={() => copyPayLink(selectedBill.id)}
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm transition active:scale-95"
                >
                  {copiedLink ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                  {copiedLink ? 'Pay URL Copied!' : 'Copy Customer Pay Link'}
                </button>
              </div>
            </div>

            {/* Live Receipt Preview (Simulating 80mm roll print) */}
            <div className="md:col-span-7 flex flex-col items-center">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Thermal Receipt Preview</p>
              
              {/* Receipt Body */}
              <div 
                id="print-area" 
                className="w-[80mm] min-h-[300px] bg-white border border-gray-300 shadow-md p-5 text-black font-mono text-[11px] leading-relaxed select-text"
              >
                {/* Header */}
                <div className="text-center font-bold space-y-1 mb-4">
                  <div className="text-base uppercase tracking-widest">{HOTEL_NAME}</div>
                  <div className="text-[9px] font-normal leading-normal">{HOTEL_ADDRESS}</div>
                  <div className="text-[9px] font-normal">Phone: {HOTEL_PHONE}</div>
                  {showGST && <div className="text-[9px] font-normal">GSTIN: {HOTEL_GST}</div>}
                </div>

                {/* Dotted separator */}
                <div className="text-center border-t border-dashed border-black/80 my-2"></div>

                {/* Details */}
                <div className="space-y-1 text-[10px] mb-3">
                  <div className="flex justify-between">
                    <span>BILL NO: {selectedBill.billNumber}</span>
                    <span className="font-bold">TABLE: {selectedBill.order.table.tableNumber}</span>
                  </div>
                  <div>DATE: {formatDate(selectedBill.createdAt)}</div>
                  <div>STATUS: <span className="font-bold uppercase">{selectedBill.paymentStatus}</span></div>
                </div>

                {/* Dotted separator */}
                <div className="text-center border-t border-dashed border-black/80 my-2"></div>

                {/* Items Table */}
                <div className="mb-4">
                  {/* Table Header */}
                  <div className="flex font-bold mb-1.5 text-[10px]">
                    <span className="w-12">QTY</span>
                    <span className="flex-1">ITEM NAME</span>
                    <span className="w-16 text-right">TOTAL</span>
                  </div>
                  
                  {/* Table Body */}
                  <div className="space-y-1 text-[10px]">
                    {selectedBill.order.items.map(item => (
                      <div key={item.id} className="flex">
                        <span className="w-12">{item.quantity}</span>
                        <span className="flex-1 truncate">{item.menuItem.name}</span>
                        <span className="w-16 text-right">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dotted separator */}
                <div className="text-center border-t border-dashed border-black/80 my-2"></div>

                {/* Totals */}
                <div className="space-y-1 text-[10px] text-right ml-auto w-40">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(selectedBill.subtotal)}</span>
                  </div>
                  
                  {showGST && (
                    <div className="flex justify-between">
                      <span>GST ({selectedBill.taxRate * 100}%):</span>
                      <span>{formatCurrency(selectedBill.taxAmount)}</span>
                    </div>
                  )}

                  {selectedBill.discount > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>Discount:</span>
                      <span>-{formatCurrency(selectedBill.discount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-extrabold border-t border-dashed border-black pt-1 mt-1 text-xs">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(selectedBill.total)}</span>
                  </div>
                </div>

                {/* Dotted separator */}
                <div className="text-center border-t border-dashed border-black/80 my-3"></div>

                {/* QR Code section */}
                {showQR && (
                  <div className="text-center space-y-2 mb-4 flex flex-col items-center">
                    <p className="text-[9px] text-gray-500">Scan to pay online or view e-bill</p>
                    <div className="bg-white p-1 rounded border border-gray-200">
                      <QRCodeSVG 
                        value={`${window.location.origin}/pay/${selectedBill.id}`} 
                        size={80} 
                        level="M" 
                      />
                    </div>
                  </div>
                )}

                {/* Footer Message */}
                <div className="text-center font-bold text-[9px] uppercase tracking-wider mt-4">
                  Thank you! Visit again
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center text-gray-400">
            <Receipt size={48} className="mx-auto mb-3 text-gray-300 animate-pulse" />
            Please select a bill from the left list to load the preview.
          </div>
        )}
      </div>
    </div>
  );
}
