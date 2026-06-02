import { useState } from 'react';
import { OrderWithItems, MenuItem } from '@/types';
import { AlertTriangle, Search, Check } from 'lucide-react';

interface CustomerUnavailabilityModalProps {
  activeOrders: OrderWithItems[];
  menuItems: MenuItem[];
  onRefresh: () => void;
}

export function CustomerUnavailabilityModal({
  activeOrders,
  menuItems,
  onRefresh,
}: CustomerUnavailabilityModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Find all unavailable items across active orders
  const unavailableItems = activeOrders.flatMap(order => 
    order.items
      .filter(item => item.isUnavailable)
      .map(item => ({
        orderId: order.id,
        item,
      }))
  );

  if (unavailableItems.length === 0) return null;

  // Let's focus on the first unavailable item to replace
  const currentReplacement = unavailableItems[0];
  const { orderId, item: currentItem } = currentReplacement;

  // Find category ID of the current item in the full menu
  const dbMenuItem = menuItems.find(m => m.id === currentItem.menuItem.id);
  const categoryId = dbMenuItem?.categoryId;

  // Generate recommendations (same category, available, not already in the order)
  const orderedItemIds = new Set(activeOrders.flatMap(o => o.items.map(i => i.menuItem.id)));
  const recommendations = menuItems.filter(m => 
    m.available && 
    m.categoryId === categoryId && 
    !orderedItemIds.has(m.id)
  ).slice(0, 3);

  // Filter full menu search results
  const filteredSearch = searchQuery.trim() === ''
    ? []
    : menuItems.filter(m => 
        m.available && 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !orderedItemIds.has(m.id)
      );

  const handleSelectReplacement = async (replacementMenuItemId: string, replacementName: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${currentItem.id}/replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menuItemId: replacementMenuItemId }),
      });

      if (res.ok) {
        setSuccessMessage(`Successfully replaced with "${replacementName}"!`);
        setTimeout(() => {
          setSuccessMessage('');
          setSearchQuery('');
          onRefresh();
        }, 1500);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to replace item. Please check with your waiter.');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-red-100 flex flex-col max-h-[85vh] animate-scale-up">
        
        {/* Header */}
        <div className="bg-red-600 text-white px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <AlertTriangle size={18} className="animate-pulse" />
          </div>
          <div className="flex-1 text-left">
            <h3 className="font-extrabold text-sm leading-tight">Dish Unavailable</h3>
            <p className="text-[10px] text-red-100 mt-0.5">Please choose a replacement item</p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-left flex-1">
          {successMessage ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <Check size={24} strokeWidth={3} />
              </div>
              <p className="font-bold text-gray-900 text-sm">{successMessage}</p>
            </div>
          ) : (
            <>
              <div className="bg-red-50/50 border border-red-200/60 rounded-xl p-3.5 space-y-1.5">
                <p className="text-xs text-red-800 leading-relaxed font-semibold">
                  We apologize! The chef reported that this item from your table order is not available today:
                </p>
                <div className="inline-block bg-red-100 text-red-900 text-xs font-black px-2.5 py-1 rounded-lg border border-red-200">
                  {currentItem.menuItem.name}
                </div>
              </div>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recommended Alternatives</h4>
                  <div className="space-y-2">
                    {recommendations.map(rec => (
                      <button
                        key={rec.id}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleSelectReplacement(rec.id, rec.name)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-green-50 border border-gray-150 hover:border-green-300 rounded-xl transition cursor-pointer text-left group"
                      >
                        <div>
                          <p className="text-xs font-bold text-gray-800 group-hover:text-green-900">{rec.name}</p>
                          <p className="text-[10px] text-emerald-600 font-extrabold mt-0.5">₹{rec.price.toFixed(2)}</p>
                        </div>
                        <span className="text-[10px] font-black text-green-600 bg-white border border-green-200 group-hover:bg-green-500 group-hover:text-white px-2 py-1 rounded-lg transition">
                          Select
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search any item */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Or choose any other dish</h4>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search full menu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-400 font-medium shadow-sm"
                  />
                </div>

                {searchQuery.trim() !== '' && (
                  <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-150 rounded-xl p-1.5 bg-gray-50 shadow-inner">
                    {filteredSearch.length === 0 ? (
                      <p className="text-[10px] text-gray-450 py-3 text-center">No matching available dishes.</p>
                    ) : (
                      filteredSearch.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSelectReplacement(m.id, m.name)}
                          className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-gray-700 hover:bg-green-50 hover:text-green-800 transition flex justify-between items-center cursor-pointer"
                        >
                          <span>{m.name}</span>
                          <span className="text-emerald-600 font-black">₹{m.price.toFixed(2)}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
