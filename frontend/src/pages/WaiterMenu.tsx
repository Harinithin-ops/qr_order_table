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
    <div className="p-4 md:p-6 animate-slide-up max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 border-b border-gray-150 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manage Menu Availability</h1>
          <p className="text-xs text-gray-500 mt-0.5">Toggle dish availability. Pricing edits are restricted to admin only.</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Category filtering */}
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
              activeCategory === 'all'
                ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/10'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/10'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search food item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm transition"
          />
        </div>
      </div>

      {/* Menu Items Table */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-3">
            <Search size={24} />
          </div>
          <h3 className="text-base font-bold text-gray-900 mb-1">No items found</h3>
          <p className="text-gray-500 text-xs">Try adjusting your search query or filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-100 font-bold">
                  <th className="px-6 py-4">Dish</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-center">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/30 transition">
                    {/* Item details */}
                    <td className="px-6 py-4 max-w-sm">
                      <div className="flex items-center gap-4">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-11 h-11 rounded-xl object-cover border border-gray-150 bg-gray-50 shadow-sm"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs uppercase border border-gray-250 shadow-sm">
                            {item.name.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-gray-900 leading-tight mb-1">{item.name}</h4>
                          <p className="text-xs text-gray-400 line-clamp-1">{item.description}</p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4 text-gray-500 font-medium">
                      <span className="bg-gray-100 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-700">
                        {item.categoryName}
                      </span>
                    </td>

                    {/* Availability Toggle */}
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center justify-center">
                        <button
                          onClick={() => handleToggleAvailability(item.id, item.available)}
                          disabled={updatingAvailabilityId === item.id}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            item.available ? 'bg-amber-500 shadow-sm shadow-amber-500/20' : 'bg-gray-200'
                          } ${updatingAvailabilityId === item.id ? 'opacity-50 cursor-wait' : ''}`}
                        >
                          <span className="sr-only">Toggle availability</span>
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              item.available ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className={`ml-2 text-xs font-bold ${item.available ? 'text-amber-600' : 'text-gray-400'}`}>
                          {item.available ? 'Available' : 'Sold Out'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
