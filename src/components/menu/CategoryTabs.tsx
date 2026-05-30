'use client';

import { useRef } from 'react';

interface Category {
  id: string;
  name: string;
}

interface Props {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (id: string) => void;
}

export function CategoryTabs({ categories, activeCategory, onSelectCategory }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSelect = (idx: number, id: string) => {
    onSelectCategory(id);
    // Rough scroll center
    if (scrollRef.current) {
        const item = scrollRef.current.children[idx] as HTMLElement;
        if (item) {
            scrollRef.current.scrollTo({
                left: item.offsetLeft - (scrollRef.current.offsetWidth / 2) + (item.offsetWidth / 2),
                behavior: 'smooth'
            });
        }
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 py-3 mt-4">
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto hide-scrollbar gap-3 px-4 pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {categories.map((cat, idx) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleSelect(idx, cat.id)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-all ${
                isActive 
                  ? 'bg-gray-900 text-white shadow-md' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
