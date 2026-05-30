import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/utils';
import { ShoppingBag } from 'lucide-react';

interface Props {
  onClick: () => void;
}

export function CartButton({ onClick }: Props) {
  const { getTotalItems, getTotalPrice } = useCart();
  const totalItems = getTotalItems();

  if (totalItems === 0) return null;

  return (
    <div className="fixed bottom-6 left-0 right-0 px-4 z-30 animate-slide-up">
      <button 
        onClick={onClick}
        className="w-full max-w-md mx-auto bg-gray-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:bg-black transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingBag />
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-gray-900">
              {totalItems}
            </span>
          </div>
          <div className="text-left">
            <div className="text-sm text-gray-300 font-medium">View Cart</div>
            <div className="font-bold">{totalItems} {totalItems === 1 ? 'item' : 'items'}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 font-bold text-lg">
          {formatCurrency(getTotalPrice())}
        </div>
      </button>
    </div>
  );
}
