import { Link } from 'react-router-dom';
import { Shield, Utensils, QrCode } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full animate-slide-up">
        <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-200">
          <Utensils size={26} className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">QR Table Menu</h1>
        <p className="text-gray-500 mb-8">Scan a QR code on your table to view the menu and order.</p>
        
        <div className="space-y-3">
          <Link 
            to="/menu/table-1" 
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors text-center shadow-sm"
          >
            <QrCode size={18} />
            Simulate Table 1 Scan
          </Link>
          
          <Link 
            to="/login" 
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-colors text-center shadow-sm"
          >
            <Shield size={18} />
            Admin Dashboard
          </Link>

          <Link 
            to="/waiter-login" 
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors text-center shadow-sm"
          >
            <Utensils size={18} />
            Waiter Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
