import { useCart } from '@/hooks/useCart';
import { formatCurrency, TAX_RATE, getCategoryTimingStatus } from '@/lib/utils';
import { ShoppingBag, X, Plus, Minus, ChevronRight, AlertCircle, Lock } from 'lucide-react';
import { useState } from 'react';
import { MenuItemWithCategory } from '@/types';

interface Props {
  tableId: string;
  isOpen: boolean;
  onClose: () => void;
  onOrderPlaced: (orderId: string) => void;
  menuItems: MenuItemWithCategory[];
  customerId: string | null;
}

export function CartSheet({ tableId, isOpen, onClose, onOrderPlaced, menuItems, customerId }: Props) {
  const { items, updateQuantity, getTotalPrice, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');

  const subtotal = getTotalPrice();
  const gst = subtotal * TAX_RATE;
  const total = subtotal + gst;

  // Helper to get category timing status for a cart item
  const getCartItemTiming = (itemId: string) => {
    const menuItem = menuItems.find(mi => mi.id === itemId);
    if (!menuItem) return { isOpen: true, label: '' };
    return getCategoryTimingStatus(menuItem.category?.name || '');
  };

  const hasLockedItems = items.some(item => !getCartItemTiming(item.menuItemId).isOpen);

  const handlePlaceOrder = async () => {
    if (items.length === 0 || hasLockedItems) return;
    
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tableId,
          items,
          customerId: customerId || undefined,
          notes: (() => {
            const rawSession = localStorage.getItem(`kh_customer_session_${tableId}`);
            let customerPhone = null;
            if (rawSession) {
              try {
                customerPhone = JSON.parse(rawSession).phone;
              } catch {}
            }
            if (customerPhone) {
              return `Phone: ${customerPhone}${notes ? ` | Notes: ${notes}` : ''}`;
            }
            return notes || undefined;
          })(),
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to place order');
      }

      const order = await response.json();
      clearCart();
      setNotes('');
      onOrderPlaced(order.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl animate-slide-up max-h-[85vh] flex flex-col max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag /> Your Order
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
              <p>Your cart is empty</p>
              <button 
                onClick={onClose}
                className="mt-4 text-red-600 font-medium hover:underline"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Items List */}
              <div className="space-y-4">
                {items.map((item, idx) => {
                  const { isOpen: isItemOpen, label: timingLabel } = getCartItemTiming(item.menuItemId);
                  return (
                    <div key={`${item.menuItemId}-${idx}`} className="flex gap-3 border-b border-gray-50 pb-4">
                      <div className="w-16 h-16 rounded-md bg-gray-100 overflow-hidden flex-shrink-0 relative">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className={`w-full h-full object-cover ${!isItemOpen ? 'grayscale' : ''}`} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">No Image</div>
                        )}
                        {!isItemOpen && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                            <Lock size={16} />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <h4 className={`font-medium ${!isItemOpen ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {item.name}
                          </h4>
                          <span className={`font-semibold ${!isItemOpen ? 'text-gray-400' : 'text-gray-900'}`}>
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                        </div>
                        
                        {item.specialInstructions && (
                          <p className="text-xs text-red-600 mt-0.5 max-w-[200px] truncate">
                            Note: {item.specialInstructions}
                          </p>
                        )}

                        {!isItemOpen && timingLabel && (
                          <p className="text-[10px] text-red-500 font-bold bg-red-50/70 border border-red-100 rounded px-2 py-0.5 mt-1 inline-flex items-center gap-1 w-fit">
                            <Lock size={10} /> Locked (Only available {timingLabel})
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm text-gray-500">{formatCurrency(item.price)} each</span>
                          <div className="flex items-center border border-gray-200 rounded text-gray-700 bg-white">
                            <button 
                              onClick={() => updateQuantity(item.menuItemId, Math.max(0, item.quantity - 1))} 
                              className="px-2 py-1 hover:bg-gray-50 text-gray-500"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="px-3 font-medium text-sm">{item.quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)} 
                              className="px-2 py-1 hover:bg-gray-50 text-gray-500"
                              disabled={!isItemOpen}
                            >
                              <Plus size={14} className={!isItemOpen ? 'text-gray-300' : ''} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order Notes (Optional)</label>
                <textarea 
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-green-600 focus:ring-1 focus:ring-green-600"
                  placeholder="Any allergies or special requests for the entire order?"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={hasLockedItems}
                />
              </div>

              {/* Bill Summary */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {TAX_RATE > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Taxes ({TAX_RATE * 100}%)</span>
                    <span>{formatCurrency(gst)}</span>
                  </div>
                )}
                <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between font-bold text-lg text-gray-900">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              {hasLockedItems && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs flex gap-2 items-start border border-red-150 shadow-sm">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 animate-bounce" /> 
                  <div>
                    <span className="font-bold block mb-0.5">Order Blocked</span>
                    Some items in your cart are currently locked due to time restrictions. Please remove them to proceed.
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm flex gap-2 items-center">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action */}
        {items.length > 0 && (
          <div className="p-4 border-t border-gray-100 bg-white">
            <button 
              onClick={handlePlaceOrder}
              disabled={isSubmitting || hasLockedItems}
              className={`w-full text-white rounded-xl py-4 font-semibold text-lg transition-all flex justify-between items-center px-6 shadow-xl ${
                hasLockedItems 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed hover:bg-gray-300 shadow-none' 
                  : 'bg-gray-900 hover:bg-black active:scale-[0.99]'
              }`}
            >
              <span>{isSubmitting ? 'Placing Order...' : hasLockedItems ? 'Locked Items in Cart' : 'Place Order'}</span>
              {!isSubmitting && !hasLockedItems && (
                <span className="flex items-center gap-1">{formatCurrency(total)} <ChevronRight size={20} /></span>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

