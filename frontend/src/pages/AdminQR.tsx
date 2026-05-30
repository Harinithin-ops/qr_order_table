import { useEffect, useState } from 'react';
import { Activity, Download, ExternalLink } from 'lucide-react';
import { HOTEL_NAME } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface Table {
  id: string;
  tableNumber: number;
  slug: string;
}

export default function AdminQR() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch('/api/tables');
        if (res.ok) {
          const data = await res.json();
          setTables(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTables();
  }, []);

  const downloadQR = (slug: string, tableNumber: number) => {
    const link = document.createElement('a');
    link.href = `/api/qr/${slug}`;
    link.download = `Table-${tableNumber}-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-8 flex justify-center"><Activity className="animate-spin text-green-600" size={32} /></div>;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8 border-b border-gray-200 pb-6 flex justify-between items-end">
        <div>
           <Link to="/dashboard" className="text-gray-500 font-medium text-sm hover:underline mb-2 inline-block">&larr; Back to Dashboard</Link>
           <h1 className="text-3xl font-bold text-gray-900 font-serif">Table QR Codes</h1>
           <p className="text-gray-500 mt-1">Download and print QR codes to place on tables.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map(table => (
           <div key={table.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden text-center flex flex-col">
             <div className="bg-gray-900 text-white p-3 border-b border-gray-800">
                <h3 className="font-bold text-lg">Table {table.tableNumber}</h3>
                <p className="text-xs text-gray-400">{HOTEL_NAME}</p>
             </div>
             
             <div className="p-6 flex-1 flex flex-col items-center justify-center bg-gray-50">
                <div className="bg-white p-2 rounded-xl shadow-sm mb-4">
                   <img src={`/api/qr/${table.slug}`} alt={`QR for Table ${table.tableNumber}`} className="w-48 h-48" />
                </div>
                <p className="text-xs text-gray-400">Consumers will scan this to order.</p>
             </div>
             
             <div className="p-4 border-t border-gray-100 flex gap-2">
                <button 
                  onClick={() => downloadQR(table.slug, table.tableNumber)}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition flex items-center justify-center gap-2"
                >
                  <Download size={16}/> Download
                </button>
                <Link 
                  to={`/menu/${table.slug}`}
                  target="_blank"
                  className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
                >
                  Open <ExternalLink size={16}/>
                </Link>
             </div>
           </div>
        ))}
        
        {/* Add New Table Placeholder */}
        <div className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 hover:border-gray-400 transition cursor-pointer min-h-[350px]">
           <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4"><PlusIcon className="w-8 h-8"/></div>
           <p className="font-semibold text-lg">Add New Table</p>
           <p className="text-sm">Expand your restaurant</p>
        </div>
      </div>
    </div>
  );
}

function PlusIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
  );
}
