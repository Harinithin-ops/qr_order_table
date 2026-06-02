import { BellRing, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SSEEvent } from '@/types';

interface WaiterAlertsProps {
  lastEvent: SSEEvent | null;
}

export function WaiterAlerts({ lastEvent }: WaiterAlertsProps) {
  const [alerts, setAlerts] = useState<{tableId: string; tableNumber: number; time: Date}[]>([]);

  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'WAITER_CALL') {
      const data = lastEvent.data as { tableId: string; tableNumber: number };
      setAlerts(prev => {
        // Only add if not already calling
        if (!prev.find(a => a.tableId === data.tableId)) {
          return [...prev, { ...data, time: new Date() }];
        }
        return prev;
      });
      // Try to play sound
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.log('Audio autoplay blocked', e));
      } catch (e) {
        console.error('Audio initialization failed:', e);
      }
    } else if (lastEvent.type === 'WAITER_DISMISS') {
        const data = lastEvent.data as { tableId: string };
        setAlerts(prev => prev.filter(a => a.tableId !== data.tableId));
    }
  }, [lastEvent]);

  const handleDismiss = async (tableId: string) => {
    // Optimistic remove
    setAlerts(prev => prev.filter(a => a.tableId !== tableId));
    
    // API call
    try {
      await fetch(`/api/tables/${tableId}/call-waiter`, { method: 'DELETE' });
    } catch (e) {
      console.error('Failed to dismiss alert', e);
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:top-4 md:left-auto md:right-4 z-50 flex flex-col gap-2 max-w-sm w-auto">
      {alerts.map(alert => (
        <div key={alert.tableId} className="bg-red-500 text-white p-3 md:p-4 rounded-xl shadow-2xl flex items-center justify-between border-l-4 border-red-900 animate-slide-up">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center animate-pulse shrink-0">
              <BellRing size={18} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm md:text-lg truncate">Table {alert.tableNumber} Calling</div>
              <div className="text-[10px] md:text-xs text-red-100">Needs assistance</div>
            </div>
          </div>
          
          <button 
            onClick={() => handleDismiss(alert.tableId)}
            className="p-2 hover:bg-black/10 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>
      ))}
    </div>
  );
}
