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
  Sliders,
  Bluetooth,
  Usb
} from 'lucide-react';
import { formatCurrency, formatDate, HOTEL_NAME, HOTEL_ADDRESS, HOTEL_PHONE, HOTEL_GST } from '@/lib/utils';
import { QRCodeSVG } from 'qrcode.react';

// ESC/POS builder helper to construct binary receipt commands for thermal printers
class EscPosBuilder {
  private buffer: number[] = [];

  initialize() {
    // ESC @ - Initialize printer (clears buffers and resets settings)
    this.buffer.push(0x1B, 0x40);
    return this;
  }

  write(text: string) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    this.buffer.push(...Array.from(bytes));
    return this;
  }

  writeLine(text: string) {
    return this.write(text + '\n');
  }

  alignCenter() {
    this.buffer.push(0x1B, 0x61, 1);
    return this;
  }

  alignLeft() {
    this.buffer.push(0x1B, 0x61, 0);
    return this;
  }

  alignRight() {
    this.buffer.push(0x1B, 0x61, 2);
    return this;
  }

  bold(on: boolean) {
    this.buffer.push(0x1B, 0x45, on ? 1 : 0);
    return this;
  }

  doubleSize(on: boolean) {
    this.buffer.push(0x1B, 0x21, on ? 0x30 : 0);
    return this;
  }

  lineFeed(lines = 1) {
    this.buffer.push(0x1B, 0x64, lines);
    return this;
  }

  cut() {
    // GS V 66 0
    this.buffer.push(0x1D, 0x56, 66, 0);
    return this;
  }

  getBuffer() {
    return new Uint8Array(this.buffer);
  }
}

// Writes bytes in 20-byte chunks to comply with BLE GATT MTU payload constraints
const writeDataInChunks = async (characteristic: any, data: Uint8Array) => {
  const chunkSize = 20;
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    await characteristic.writeValue(chunk);
    // 15ms buffer delay to clear the BLE write queue
    await new Promise(resolve => setTimeout(resolve, 15));
  }
};

// Compiles ESC/POS commands into a single buffer
const compileReceipt = (bill: any, showGST: boolean): Uint8Array => {
  const escpos = new EscPosBuilder();
  
  // Always initialize thermal printer first
  escpos.initialize();
  
  escpos.alignCenter();
  escpos.bold(true);
  escpos.doubleSize(true);
  escpos.writeLine(HOTEL_NAME);
  escpos.doubleSize(false);
  escpos.bold(false);
  
  escpos.writeLine(HOTEL_ADDRESS);
  escpos.writeLine(`Phone: ${HOTEL_PHONE}`);
  if (showGST) {
    escpos.writeLine(`GSTIN: ${HOTEL_GST}`);
  }
  
  escpos.writeLine('--------------------------------');
  
  escpos.alignLeft();
  escpos.writeLine(`BILL NO: ${bill.billNumber}`);
  escpos.writeLine(`TABLE  : Table ${bill.order.table.tableNumber}`);
  escpos.writeLine(`DATE   : ${formatDate(bill.createdAt).split(',')[0]}`);
  escpos.writeLine(`STATUS : ${bill.paymentStatus}`);
  
  escpos.writeLine('--------------------------------');
  escpos.writeLine('QTY  ITEM                 TOTAL');
  
  for (const item of bill.order.items) {
    const qtyStr = String(item.quantity).padEnd(5, ' ');
    const nameStr = item.menuItem.name.substring(0, 16).padEnd(16, ' ');
    const totalVal = formatCurrency(item.price * item.quantity).replace('₹', 'Rs ');
    const totalStr = totalVal.padStart(11, ' ');
    escpos.writeLine(`${qtyStr}${nameStr}${totalStr}`);
  }
  
  escpos.writeLine('--------------------------------');
  
  const formatVal = (label: string, value: number) => {
    const valStr = formatCurrency(value).replace('₹', 'Rs ');
    return `${label.padEnd(20, ' ')}${valStr.padStart(12, ' ')}`;
  };
  
  escpos.writeLine(formatVal('Subtotal:', bill.subtotal));
  if (showGST) {
    escpos.writeLine(formatVal(`GST (${bill.subtotal > 0 ? ((bill.taxAmount / bill.subtotal) * 100).toFixed(0) : 2}%):`, bill.taxAmount));
  }
  if (bill.discount > 0) {
    escpos.writeLine(formatVal('Discount:', bill.discount));
  }
  
  escpos.bold(true);
  escpos.writeLine(formatVal('TOTAL:', bill.total));
  escpos.bold(false);
  
  escpos.writeLine('--------------------------------');
  escpos.alignCenter();
  escpos.bold(true);
  escpos.writeLine('THANK YOU! VISIT AGAIN');
  escpos.bold(false);
  
  escpos.lineFeed(4);
  escpos.cut();
  
  return escpos.getBuffer();
};

export default function BillMachinePage() {
  const [bills, setBills] = useState<(BillData & { order: OrderWithItems })[]>([]);
  const [selectedBill, setSelectedBill] = useState<(BillData & { order: OrderWithItems }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom print options
  const [showGST, setShowGST] = useState(true);
  const [showQR, setShowQR] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Bluetooth Printer states
  const [btDevice, setBtDevice] = useState<any>(null);
  const [btCharacteristic, setBtCharacteristic] = useState<any>(null);
  const [btConnecting, setBtConnecting] = useState(false);
  const [btError, setBtError] = useState('');

  // USB Printer states
  const [usbDevice, setUsbDevice] = useState<any>(null);
  const [usbEndpoint, setUsbEndpoint] = useState<any>(null);
  const [usbInterfaceNumber, setUsbInterfaceNumber] = useState<number | null>(null);
  const [usbConnecting, setUsbConnecting] = useState(false);
  const [usbError, setUsbError] = useState('');

  const isBluetoothSupported = typeof window !== 'undefined' && 'bluetooth' in (navigator as any);
  const isUsbSupported = typeof window !== 'undefined' && 'usb' in (navigator as any);

  const connectBluetooth = async () => {
    setBtConnecting(true);
    setBtError('');
    try {
      // Prompt standard BLE serial characteristics or accept all
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard Printer service
          '0000e7e7-0000-1000-8000-00805f9b34fb', // Custom BLE SPP
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', // TVS BLE characteristic
        ]
      });

      console.log('Connecting to GATT Server...');
      const server = await device.gatt!.connect();

      console.log('Discovering Services...');
      const services = await server.getPrimaryServices();
      
      let writeChar = null;
      for (const service of services) {
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        }
        if (writeChar) break;
      }

      if (!writeChar) {
        throw new Error('No writable characteristic found on this device. Make sure it is a printer.');
      }

      device.addEventListener('gattserverdisconnected', () => {
        setBtDevice(null);
        setBtCharacteristic(null);
      });

      setBtDevice(device);
      setBtCharacteristic(writeChar);
    } catch (err: any) {
      console.error(err);
      setBtError(err.message || 'Failed to connect to printer.');
    } finally {
      setBtConnecting(false);
    }
  };

  const disconnectBluetooth = () => {
    if (btDevice && btDevice.gatt.connected) {
      btDevice.gatt.disconnect();
    }
    setBtDevice(null);
    setBtCharacteristic(null);
  };

  const printViaBluetooth = async () => {
    if (!selectedBill || !btCharacteristic) return;

    try {
      const buffer = compileReceipt(selectedBill, showGST);
      await writeDataInChunks(btCharacteristic, buffer);
      alert('Printed successfully via Bluetooth!');
    } catch (err: any) {
      console.error(err);
      alert('Print failed: ' + (err.message || err));
    }
  };

  const connectUsb = async () => {
    setUsbConnecting(true);
    setUsbError('');
    try {
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      await device.open();
      
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }
      
      // Look for interface and bulk OUT endpoint
      let endpoint = null;
      let interfaceNumber = 0;
      
      for (const config of device.configurations) {
        for (const iface of config.interfaces) {
          for (const alternate of iface.alternates) {
            const endpoints = alternate.endpoints;
            for (const ep of endpoints) {
              if (ep.direction === 'out' && ep.type === 'bulk') {
                endpoint = ep;
                interfaceNumber = iface.interfaceNumber;
                break;
              }
            }
            if (endpoint) break;
          }
          if (endpoint) break;
        }
        if (endpoint) break;
      }
      
      if (!endpoint) {
        throw new Error('No writable Bulk Out endpoint found on this USB device. Make sure it is a printer.');
      }
      
      await device.claimInterface(interfaceNumber);
      
      setUsbDevice(device);
      setUsbEndpoint(endpoint);
      setUsbInterfaceNumber(interfaceNumber);
    } catch (err: any) {
      console.error(err);
      setUsbError(err.message || 'Failed to connect to USB printer.');
    } finally {
      setUsbConnecting(false);
    }
  };

  const disconnectUsb = async () => {
    if (usbDevice) {
      try {
        if (usbInterfaceNumber !== null) {
          await usbDevice.releaseInterface(usbInterfaceNumber);
        }
        await usbDevice.close();
      } catch (err) {
        console.error('Error disconnecting USB:', err);
      }
    }
    setUsbDevice(null);
    setUsbEndpoint(null);
    setUsbInterfaceNumber(null);
  };

  const printViaUsb = async () => {
    if (!selectedBill || !usbDevice || !usbEndpoint) return;
    try {
      const buffer = compileReceipt(selectedBill, showGST);
      await usbDevice.transferOut(usbEndpoint.endpointNumber, buffer);
      alert('Printed successfully via USB!');
    } catch (err: any) {
      console.error(err);
      alert('Print failed: ' + (err.message || err));
    }
  };

  // Listen for USB device disconnects
  useEffect(() => {
    if (!isUsbSupported) return;
    
    const handleDisconnect = (event: any) => {
      if (usbDevice && event.device === usbDevice) {
        setUsbDevice(null);
        setUsbEndpoint(null);
        setUsbInterfaceNumber(null);
      }
    };
    
    (navigator as any).usb.addEventListener('disconnect', handleDisconnect);
    return () => {
      (navigator as any).usb.removeEventListener('disconnect', handleDisconnect);
    };
  }, [usbDevice, isUsbSupported]);

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
        #print-area {
          font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        }
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
            zoom: 0.9; /* Set scale to 90% by default for proper thermal printer alignment */
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

        {/* Printer Connection Status */}
        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* Bluetooth Connection */}
          {!isBluetoothSupported ? (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
              <AlertCircle size={14} /> BT not supported
            </div>
          ) : btDevice ? (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl shadow-sm text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-emerald-800">BT: {btDevice.name || 'Connected'}</span>
              <button 
                onClick={disconnectBluetooth}
                className="text-[10px] font-bold text-red-600 hover:text-red-800 ml-1 hover:underline cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectBluetooth}
              disabled={btConnecting}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-xl text-xs shadow-md shadow-blue-600/10 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {btConnecting ? (
                <>
                  <Activity className="animate-spin" size={14} /> Connecting BT...
                </>
              ) : (
                <>
                  <Bluetooth size={14} /> Connect BT
                </>
              )}
            </button>
          )}

          {/* USB Connection */}
          {!isUsbSupported ? (
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
              <AlertCircle size={14} /> USB not supported
            </div>
          ) : usbDevice ? (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-xl shadow-sm text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-semibold text-emerald-800">USB: {usbDevice.productName || 'Connected'}</span>
              <button 
                onClick={disconnectUsb}
                className="text-[10px] font-bold text-red-600 hover:text-red-800 ml-1 hover:underline cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectUsb}
              disabled={usbConnecting}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-2 rounded-xl text-xs shadow-md shadow-purple-600/10 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {usbConnecting ? (
                <>
                  <Activity className="animate-spin" size={14} /> Connecting USB...
                </>
              ) : (
                <>
                  <Usb size={14} /> Connect USB
                </>
              )}
            </button>
          )}

          {btError && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-2 rounded-lg">
              BT Error: {btError}
            </span>
          )}
          {usbError && (
            <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 p-2 rounded-lg">
              USB Error: {usbError}
            </span>
          )}
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
                 {btDevice && (
                   <button
                     onClick={printViaBluetooth}
                     className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 active:scale-95 transition-transform cursor-pointer"
                   >
                     <Bluetooth size={18} /> Print via Bluetooth
                   </button>
                 )}

                 {usbDevice && (
                   <button
                     onClick={printViaUsb}
                     className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-600/10 active:scale-95 transition-transform cursor-pointer"
                   >
                     <Usb size={18} /> Print via USB
                   </button>
                 )}

                 <button
                   onClick={handlePrint}
                   className={`w-full font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer ${
                     btDevice || usbDevice 
                       ? 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm'
                       : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/10'
                   }`}
                 >
                   <Printer size={18} /> Print Receipt (TVS)
                 </button>

                 <button
                  onClick={() => copyPayLink(selectedBill.id)}
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm shadow-sm transition active:scale-95 mb-4"
                >
                  {copiedLink ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                  {copiedLink ? 'Pay URL Copied!' : 'Copy Customer Pay Link'}
                </button>

                {/* USB Printer Connection Guide */}
                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 mt-4 space-y-2">
                  <h4 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-amber-700" /> TVS Printer Setup Guide
                  </h4>
                  <ul className="text-[10px] text-amber-900 space-y-1.5 list-disc pl-3.5 leading-relaxed">
                    <li>
                      <strong className="text-amber-950">Option A: Spooler Mode (Plug & Play)</strong>: Simply click <strong className="text-amber-950">"Print Receipt (TVS)"</strong>. It will open the system print prompt where you can select your TVS printer and print instantly.
                    </li>
                    <li>
                      <strong className="text-amber-950">Option B: WebUSB Mode (Direct USB)</strong>: Click <strong className="text-amber-950">"Connect USB"</strong> to connect directly from Chrome. 
                      <br />
                      <em className="text-amber-800">Note: On Windows, you must use <strong>Zadig</strong> to change the TVS driver to generic <strong>WinUSB</strong>, or Chrome will block the connection.</em>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Live Receipt Preview (Simulating 80mm roll print) */}
            <div className="md:col-span-7 flex flex-col items-center">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-2">Thermal Receipt Preview</p>
              
              {/* Receipt Body */}
              <div 
                id="print-area" 
                className="w-[80mm] min-h-[300px] bg-white border border-gray-300 shadow-md p-5 text-black font-sans text-[11px] leading-relaxed select-text"
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
                      <span>GST ({selectedBill.subtotal > 0 ? ((selectedBill.taxAmount / selectedBill.subtotal) * 100).toFixed(0) : 2}%):</span>
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
