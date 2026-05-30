import { useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';

interface Props {
  tableId: string; // The slug like 'table-1'
}

export function WaiterCallButton({ tableId }: Props) {
  const [calling, setCalling] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleCall = async () => {
    if (calling || success) return;
    
    setCalling(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/call-waiter`, { method: 'POST' });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 5000); // Reset after 5s
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCalling(false);
    }
  };

  return (
    <button 
      onClick={handleCall}
      disabled={calling || success}
      className={`fixed right-4 md:right-[calc(50vw-224px+16px)] bottom-24 p-3 rounded-full shadow-lg z-20 flex items-center justify-center transition-all ${
        success ? 'bg-green-500 text-white w-12 h-12' : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 w-12 h-12'
      }`}
      aria-label="Call Waiter"
    >
      {success ? <CheckCircle2 size={24} /> : <Bell size={24} className={calling ? 'animate-pulse' : ''} />}
    </button>
  );
}
