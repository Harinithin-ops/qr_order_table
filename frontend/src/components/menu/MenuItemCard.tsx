import { useCart } from '@/hooks/useCart';
import { MenuItemWithCategory } from '@/types';
import { formatCurrency, getCategoryTimingStatus } from '@/lib/utils';
import { Flame, Star, Plus, Minus, Lock, Clock } from 'lucide-react';

interface Props {
  item: MenuItemWithCategory;
}

export function MenuItemCard({ item }: Props) {
  const { addItem, items, updateQuantity } = useCart();

  // Aggregate total quantity for this item across all cart entries
  const cartQuantity = items
    .filter((i) => i.menuItemId === item.id)
    .reduce((acc, curr) => acc + curr.quantity, 0);

  const { isOpen, label: timingLabel } = getCategoryTimingStatus(item.category?.name || '');
  const isLocked = !isOpen;

  const handleAdd = () => {
    if (!item.available || isLocked) return;
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      image: item.image || undefined,
    });
  };

  const handleIncrement = () => {
    if (isLocked) return;
    const cartItem = items.find((i) => i.menuItemId === item.id);
    if (cartItem) {
      updateQuantity(cartItem.menuItemId, cartItem.quantity + 1);
    } else {
      handleAdd();
    }
  };

  const handleDecrement = () => {
    if (isLocked) return;
    const cartItem = items.find((i) => i.menuItemId === item.id);
    if (cartItem && cartItem.quantity > 0) {
      updateQuantity(cartItem.menuItemId, cartItem.quantity - 1);
    }
  };

  return (
    <div
      className={`flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 transition-all ${
        !item.available ? 'opacity-50' : isLocked ? 'opacity-70 bg-gray-50/10' : ''
      }`}
    >
      {/* Veg / Non-Veg dot indicator */}
      <span
        className={`flex-shrink-0 w-4 h-4 rounded-sm border-2 flex items-center justify-center ${
          item.tags.includes('non-veg')
            ? 'border-red-600'
            : 'border-green-600'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            item.tags.includes('non-veg') ? 'bg-red-600' : 'bg-green-600'
          }`}
        />
      </span>

      {/* Item details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-gray-900 text-sm leading-tight">
            {item.name}
          </span>
          {item.tags.includes('bestseller') && (
            <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-200">
              <Star size={8} fill="currentColor" />
              BEST
            </span>
          )}
          {item.tags.includes('spicy') && (
            <span className="inline-flex items-center bg-red-50 text-red-500 text-[9px] font-bold px-1 py-0.5 rounded border border-red-100">
              <Flame size={8} />
            </span>
          )}
          {!item.available && (
            <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
              OUT OF STOCK
            </span>
          )}
          {isLocked && (
            <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-250 inline-flex items-center gap-0.5">
              <Lock size={8} />
              LOCKED
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-1">
          {item.description}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span className="text-sm font-bold text-gray-800">
            {formatCurrency(item.price)}
          </span>
          {isLocked && timingLabel && (
            <span className="inline-flex items-center gap-1 bg-red-50 text-red-500 text-[9px] font-semibold px-2 py-0.5 rounded border border-red-150 transition-all">
              <Clock size={8} />
              Only {timingLabel}
            </span>
          )}
        </div>
      </div>

      {/* Add / Quantity Controls */}
      <div className="flex-shrink-0">
        {!item.available ? null : isLocked ? (
          <span className="inline-flex items-center gap-1 bg-gray-150 border border-gray-200 text-gray-400 font-bold text-xs px-2.5 py-1.5 rounded-lg shadow-sm">
            <Lock size={12} />
            Locked
          </span>
        ) : cartQuantity === 0 ? (
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 bg-white border border-green-500 text-red-600 font-bold text-sm px-3 py-1.5 rounded-lg shadow-sm hover:bg-green-50 active:scale-95 transition-transform"
          >
            <Plus size={14} />
            ADD
          </button>
        ) : (
          <div className="flex items-center bg-red-600 text-white rounded-lg overflow-hidden shadow-sm">
            <button
              onClick={handleDecrement}
              className="px-2 py-1.5 hover:bg-red-700 active:bg-red-800 transition-colors"
            >
              <Minus size={14} />
            </button>
            <span className="px-2 font-bold text-sm min-w-[20px] text-center">
              {cartQuantity}
            </span>
            <button
              onClick={handleIncrement}
              className="px-2 py-1.5 hover:bg-red-700 active:bg-red-800 transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

