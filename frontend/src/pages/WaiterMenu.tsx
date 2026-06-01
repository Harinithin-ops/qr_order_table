import { useEffect, useState } from 'react';
import { Activity, Search } from 'lucide-react';
import { MenuCategory } from '@/types';

export default function WaiterMenu() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [updatingAvailabilityId, setUpdatingAvailabilityId] = useState<string | null>(null);

  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Failed to load menu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const handleToggleAvailability = async (itemId: string, currentAvailable: boolean) => {
    setUpdatingAvailabilityId(itemId);
    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !currentAvailable })
      });

      if (res.ok) {
        // Update local state
        setCategories(prev => 
          prev.map(cat => ({
            ...cat,
            items: cat.items.map(item => 
              item.id === itemId ? { ...item, available: !currentAvailable } : item
            )
          }))
        );
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to update availability');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while updating availability');
    } finally {
      setUpdatingAvailabilityId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center min-h-[60vh] items-center">
        <Activity className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  // Flatten items and attach category name
  const allItems = categories.flatMap(cat => 
    cat.items.map(item => ({ ...item, categoryName: cat.name }))
  );

  const filteredItems = allItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || item.categoryId === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-3 sm:p-4 md:p-6 animate-slide-up max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-5 pb-4 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Menu Availability</h1>
        <p className="text-xs text-gray-500">Toggle dishes on/off. Pricing is admin-only.</p>
      </div>

      {/* Search + Category filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search food item…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm transition"
          />
        </div>
        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
              activeCategory === 'all'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <Search size={28} className="mx-auto text-gray-300 mb-3" />
          <h3 className="text-sm font-bold text-gray-900 mb-1">No items found</h3>
          <p className="text-gray-400 text-xs">Try a different search or category.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {filteredItems.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition">
              {/* Image / initials */}
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-10 h-10 rounded-xl object-cover border border-gray-100 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs uppercase shrink-0">
                  {item.name.slice(0, 2)}
                </div>
              )}

              {/* Name + category */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate leading-tight">{item.name}</p>
                <span className="text-[11px] text-gray-400 font-medium">{item.categoryName}</span>
              </div>

              {/* Availability toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-bold hidden sm:inline ${item.available ? 'text-amber-600' : 'text-gray-400'}`}>
                  {item.available ? 'Available' : 'Sold Out'}
                </span>
                <button
                  onClick={() => handleToggleAvailability(item.id, item.available)}
                  disabled={updatingAvailabilityId === item.id}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                    item.available ? 'bg-amber-500' : 'bg-gray-200'
                  } ${updatingAvailabilityId === item.id ? 'opacity-50 cursor-wait' : ''}`}
                >
                  <span className="sr-only">Toggle availability</span>
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      item.available ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
