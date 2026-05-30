import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">QR Table Menu</h1>
        <p className="text-gray-500 mb-8">Scan a QR code on your table to view the menu and order.</p>
        
        <div className="space-y-4">
          <Link 
            href="/menu/table-1" 
            className="block w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            Simulate Table 1 Scan
          </Link>
          
          <Link 
            href="/login" 
            className="block w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
          >
            Admin Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
