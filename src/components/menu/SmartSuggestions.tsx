'use client';

import { useCart } from '@/hooks/useCart';
import { MenuItemWithCategory } from '@/types';
import { MenuItemCard } from './MenuItemCard';
import { Sparkles } from 'lucide-react';

interface Props {
  menuItems: MenuItemWithCategory[];
}

export function SmartSuggestions({ menuItems }: Props) {
  const { items } = useCart();
  
  if (items.length === 0) return null;

  // Gather all suggested IDs from items in cart
  const suggestedIds = new Set<string>();
  items.forEach(cartItem => {
    const fullItem = menuItems.find(m => m.id === cartItem.menuItemId);
    fullItem?.suggestedItemIds.forEach((id: string) => suggestedIds.add(id));
  });

  // Filter out items already in cart
  const cartItemIds = new Set(items.map(i => i.menuItemId));
  const validSuggestions = Array.from(suggestedIds)
    .filter(id => !cartItemIds.has(id))
    .map(id => menuItems.find(m => m.id === id))
    .filter((item): item is MenuItemWithCategory => item !== undefined && item.available)
    .slice(0, 3); // Max 3 suggestions

  if (validSuggestions.length === 0) return null;

  return (
    <div className="bg-green-50/50 rounded-2xl p-4 border border-green-100 mb-6 animate-slide-up">
      <h3 className="font-bold text-red-800 flex items-center gap-2 mb-3">
        <Sparkles size={16} /> Goes well with your order
      </h3>
      <div className="space-y-3">
        {validSuggestions.map(item => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
