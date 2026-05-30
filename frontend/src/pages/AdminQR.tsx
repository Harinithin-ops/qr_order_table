import { useEffect, useState } from 'react';
import { Activity, Download, ExternalLink, Trash2, Plus, X } from 'lucide-react';
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
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
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

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    
    const num = parseInt(newTableNumber, 10);
    if (isNaN(num) || num <= 0) {
      setModalError('Please enter a valid table number');
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNumber: num })
      });
      
      if (res.ok) {
        const newTable = await res.json();
        setTables(prev => [...prev, newTable].sort((a, b) => a.tableNumber - b.tableNumber));
        setShowAddModal(false);
        setNewTableNumber('');
      } else {
        const errData = await res.json();
        setModalError(errData.error || 'Failed to create table');
      }
    } catch (err) {
      console.error(err);
      setModalError('An error occurred while creating the table');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTable = async (id: string, tableNumber: number) => {
    if (!window.confirm(`Are you sure you want to delete Table ${tableNumber}? This will permanently delete the table and all associated orders/bills.`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/tables/${id}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        setTables(prev => prev.filter(t => t.id !== id));
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete table');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while deleting the table');
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Activity className="animate-spin text-green-600" size={32} /></div>;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-slide-up">
      <div className="mb-8 border-b border-gray-200 pb-6 flex justify-between items-end">
        <div>
           <Link to="/dashboard" className="text-gray-500 font-medium text-sm hover:underline mb-2 inline-block">&larr; Back to Dashboard</Link>
           <h1 className="text-3xl font-bold text-gray-900 font-serif">Table QR Codes</h1>
           <p className="text-gray-500 mt-1">Download and print QR codes to place on tables.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {tables.map(table => (
           <div key={table.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden text-center flex flex-col hover:shadow-md transition duration-200">
             {/* Card Header with table number and delete action */}
             <div className="bg-gray-900 text-white p-3.5 border-b border-gray-800 flex justify-between items-center">
                <div className="text-left">
                   <h3 className="font-bold text-base">Table {table.tableNumber}</h3>
                   <p className="text-[10px] text-gray-400">{HOTEL_NAME}</p>
                </div>
                <button
                   onClick={() => handleDeleteTable(table.id, table.tableNumber)}
                   className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-gray-800 transition"
                   title="Delete Table"
                >
                   <Trash2 size={16} />
                </button>
             </div>
             
             <div className="p-6 flex-1 flex flex-col items-center justify-center bg-gray-50/50">
                <div className="bg-white p-2.5 rounded-2xl shadow-sm border border-gray-100 mb-4">
                   <img src={`/api/qr/${table.slug}`} alt={`QR for Table ${table.tableNumber}`} className="w-44 h-44" />
                </div>
                <p className="text-[11px] text-gray-400">Consumers will scan this to view menu & order.</p>
             </div>
             
             <div className="p-4 border-t border-gray-100 bg-white flex gap-2">
                 <button 
                   onClick={() => downloadQR(table.slug, table.tableNumber)}
                   className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition flex items-center justify-center gap-1.5 text-sm"
                 >
                   <Download size={15}/> Download
                 </button>
                 <Link 
                   to={`/menu/${table.slug}`}
                   target="_blank"
                   className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition flex items-center justify-center gap-1.5 text-sm"
                 >
                   Open <ExternalLink size={15}/>
                 </Link>
             </div>
           </div>
        ))}
        
        {/* Add New Table Button */}
        <button 
          onClick={() => {
            setModalError('');
            setShowAddModal(true);
          }}
          className="border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-red-500 hover:border-red-300 transition duration-200 cursor-pointer min-h-[330px] p-6 text-center w-full focus:outline-none"
        >
           <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-50 transition">
             <Plus className="w-6 h-6"/>
           </div>
           <p className="font-semibold text-base text-gray-700">Add New Table</p>
           <p className="text-xs text-gray-400 mt-1">Create QR code for a new table</p>
        </button>
      </div>

      {/* Add Table Dialog/Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-gray-100 animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-900">Add New Table</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label htmlFor="table-number" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Table Number
                </label>
                <input
                  id="table-number"
                  type="number"
                  placeholder="e.g. 5"
                  required
                  min="1"
                  value={newTableNumber}
                  onChange={(e) => {
                    setNewTableNumber(e.target.value);
                    setModalError('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
                  disabled={submitting}
                />
              </div>

              {modalError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100">
                  {modalError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition flex items-center justify-center"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Activity className="animate-spin text-white" size={16} />
                  ) : (
                    'Create QR'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
