import { useEffect, useState } from 'react';
import { Activity, Edit2, Search, Check, X, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { HOTEL_NAME, formatCurrency } from '@/lib/utils';
import { MenuCategory, MenuItem } from '@/types';

export default function AdminMenuPage() {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  // Price editing states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [updatingPrice, setUpdatingPrice] = useState(false);

  // Name editing states
  const [editingNameItemId, setEditingNameItemId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState<string>('');
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [updatingName, setUpdatingName] = useState(false);

  // Availability updating states
  const [updatingAvailabilityId, setUpdatingAvailabilityId] = useState<string | null>(null);

  // Add Dish states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [addCategoryId, setAddCategoryId] = useState('');
  const [addImage, setAddImage] = useState('');
  const [addPrepTime, setAddPrepTime] = useState('15');
  const [addError, setAddError] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);

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

  const startEditPrice = (item: MenuItem) => {
    setEditingItemId(item.id);
    setEditPriceValue(item.price.toString());
    setEditError(null);
  };

  const cancelEditPrice = () => {
    setEditingItemId(null);
    setEditPriceValue('');
    setEditError(null);
  };

  const startEditName = (item: MenuItem) => {
    setEditingNameItemId(item.id);
    setEditNameValue(item.name);
    setEditNameError(null);
  };

  const cancelEditName = () => {
    setEditingNameItemId(null);
    setEditNameValue('');
    setEditNameError(null);
  };

  const handleSaveName = async (itemId: string) => {
    const trimmedName = editNameValue.trim();
    if (!trimmedName) {
      setEditNameError('Enter a valid name');
      return;
    }

    setUpdatingName(true);
    setEditNameError(null);

    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      });

      if (res.ok) {
        setCategories(prev => 
          prev.map(cat => ({
            ...cat,
            items: cat.items.map(item => 
              item.id === itemId ? { ...item, name: trimmedName } : item
            )
          }))
        );
        setEditingNameItemId(null);
      } else {
        const errData = await res.json();
        setEditNameError(errData.error || 'Failed to save name');
      }
    } catch (err) {
      console.error(err);
      setEditNameError('Error saving name');
    } finally {
      setUpdatingName(false);
    }
  };

  const handleSavePrice = async (itemId: string) => {
    const parsedPrice = parseFloat(editPriceValue);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setEditError('Enter a valid price');
      return;
    }

    setUpdatingPrice(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: parsedPrice })
      });

      if (res.ok) {
        setCategories(prev => 
          prev.map(cat => ({
            ...cat,
            items: cat.items.map(item => 
              item.id === itemId ? { ...item, price: parsedPrice } : item
            )
          }))
        );
        setEditingItemId(null);
      } else {
        const errData = await res.json();
        setEditError(errData.error || 'Failed to save price');
      }
    } catch (err) {
      console.error(err);
      setEditError('Error saving price');
    } finally {
      setUpdatingPrice(false);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"? This will also remove any historical order references.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/menu/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        // Update local state
        setCategories(prev => 
          prev.map(cat => ({
            ...cat,
            items: cat.items.filter(item => item.id !== id)
          }))
        );
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete dish');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while deleting the dish');
    }
  };

  const handleAddDishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    const priceNum = parseFloat(addPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setAddError('Please enter a valid price');
      return;
    }

    if (!addCategoryId) {
      setAddError('Please select a category');
      return;
    }

    setAddingItem(true);
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName,
          description: addDescription,
          price: priceNum,
          categoryId: addCategoryId,
          image: addImage || null,
          prepTime: parseInt(addPrepTime, 10),
          tags: []
        })
      });

      if (res.ok) {
        const newItem = await res.json();
        
        setCategories(prev => 
          prev.map(cat => {
            if (cat.id === addCategoryId) {
              return {
                ...cat,
                items: [...cat.items, newItem]
              };
            }
            return cat;
          })
        );

        setShowAddModal(false);
        setAddName('');
        setAddDescription('');
        setAddPrice('');
        setAddCategoryId('');
        setAddImage('');
        setAddPrepTime('15');
      } else {
        const errData = await res.json();
        setAddError(errData.error || 'Failed to add dish');
      }
    } catch (err) {
      console.error(err);
      setAddError('An error occurred while creating the dish');
    } finally {
      setAddingItem(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center min-h-screen bg-gray-50 items-center">
        <Activity className="animate-spin text-green-600" size={32} />
      </div>
    );
  }

  // Get all items flattened, or filtered by category
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
    <div className="p-6 md:p-8 animate-slide-up max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-serif">Menu Management</h1>
          <p className="text-gray-500 mt-1">Manage food item availability, pricing, and create new dishes across categories.</p>
        </div>
        <button
          onClick={() => {
            setAddError(null);
            setShowAddModal(true);
          }}
          className="self-start md:self-auto bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md shadow-red-600/10 active:scale-95 transition"
        >
          <Plus size={18} /> Add New Dish
        </button>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Category filtering */}
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
              activeCategory === 'all'
                ? 'bg-red-600 text-white shadow-sm shadow-red-600/10'
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
                  ? 'bg-red-600 text-white shadow-sm shadow-red-600/10'
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
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm transition"
          />
        </div>
      </div>

      {/* Menu Items Table */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-3">
            <Search size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No items found</h3>
          <p className="text-gray-500 text-sm">Try adjusting your search query or filters.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200 font-semibold">
                  <th className="px-6 py-4">Dish</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4 text-center">Availability</th>
                  <th className="px-6 py-4 text-right">Price</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition">
                    {/* Item details */}
                    <td className="px-6 py-4 max-w-sm">
                      <div className="flex items-center gap-4">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-xl object-cover border border-gray-100 bg-gray-50 shadow-sm"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs uppercase border border-gray-200 shadow-sm">
                            {item.name.slice(0, 2)}
                          </div>
                        )}
                        <div>
                          {editingNameItemId === item.id ? (
                            <div className="inline-flex flex-col gap-1.5 max-w-[200px] mb-1">
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editNameValue}
                                  onChange={(e) => setEditNameValue(e.target.value)}
                                  className="w-36 px-1.5 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 font-semibold"
                                  disabled={updatingName}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveName(item.id)}
                                  disabled={updatingName}
                                  className="p-1 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition"
                                  title="Save Name"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={cancelEditName}
                                  disabled={updatingName}
                                  className="p-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                              {editNameError && (
                                <span className="text-[10px] text-red-600 font-semibold whitespace-nowrap flex items-center gap-0.5">
                                  <AlertTriangle size={10} /> {editNameError}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2 group/name">
                              <h4 className="font-semibold text-gray-900 leading-tight mb-1">{item.name}</h4>
                              <button
                                onClick={() => startEditName(item)}
                                className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 transition opacity-0 group-hover/name:opacity-100 focus:opacity-100"
                                title="Edit Name"
                              >
                                <Edit2 size={13} />
                              </button>
                            </div>
                          )}
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
                            item.available ? 'bg-green-500' : 'bg-gray-200'
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
                        <span className={`ml-2 text-xs font-bold ${item.available ? 'text-green-600' : 'text-gray-400'}`}>
                          {item.available ? 'Available' : 'Sold Out'}
                        </span>
                      </div>
                    </td>

                    {/* Price Editing */}
                    <td className="px-6 py-4 text-right">
                      {editingItemId === item.id ? (
                        <div className="inline-flex flex-col items-end gap-1.5 max-w-[120px]">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={editPriceValue}
                              onChange={(e) => setEditPriceValue(e.target.value)}
                              className="w-16 px-1.5 py-1 text-xs border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                              disabled={updatingPrice}
                              autoFocus
                            />
                            <button
                              onClick={() => handleSavePrice(item.id)}
                              disabled={updatingPrice}
                              className="p-1 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={cancelEditPrice}
                              disabled={updatingPrice}
                              className="p-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {editError && (
                            <span className="text-[10px] text-red-600 font-semibold whitespace-nowrap flex items-center gap-0.5">
                              <AlertTriangle size={10} /> {editError}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 group">
                          <span className="font-bold text-gray-900">{formatCurrency(item.price)}</span>
                          <button
                            onClick={() => startEditPrice(item)}
                            className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-gray-100 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Edit Price"
                          >
                            <Edit2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition active:scale-90"
                        title="Delete Dish"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Dish Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto pt-10 md:pt-16">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 animate-slide-up mb-10">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-xl text-gray-900 font-serif">Add New Menu Dish</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddDishSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dish Name */}
                <div className="md:col-span-2">
                  <label htmlFor="dish-name" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Dish Name *
                  </label>
                  <input
                    id="dish-name"
                    type="text"
                    required
                    placeholder="e.g. Garlic Butter Naan"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
                    disabled={addingItem}
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label htmlFor="dish-desc" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Description *
                  </label>
                  <textarea
                    id="dish-desc"
                    required
                    rows={2}
                    placeholder="e.g. Soft clay-oven naan brushed with premium butter."
                    value={addDescription}
                    onChange={(e) => setAddDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm resize-none"
                    disabled={addingItem}
                  />
                </div>

                {/* Price */}
                <div>
                  <label htmlFor="dish-price" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Price (INR) *
                  </label>
                  <input
                    id="dish-price"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    placeholder="e.g. 120"
                    value={addPrice}
                    onChange={(e) => setAddPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
                    disabled={addingItem}
                  />
                </div>

                {/* Category Selection */}
                <div>
                  <label htmlFor="dish-category" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Category *
                  </label>
                  <select
                    id="dish-category"
                    required
                    value={addCategoryId}
                    onChange={(e) => setAddCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
                    disabled={addingItem}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Image URL */}
                <div>
                  <label htmlFor="dish-image" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Image URL (Optional)
                  </label>
                  <input
                    id="dish-image"
                    type="url"
                    placeholder="e.g. https://images.unsplash.com/..."
                    value={addImage}
                    onChange={(e) => setAddImage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
                    disabled={addingItem}
                  />
                </div>

                {/* Prep Time */}
                <div>
                  <label htmlFor="dish-preptime" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Prep Time (Minutes)
                  </label>
                  <input
                    id="dish-preptime"
                    type="number"
                    min="1"
                    placeholder="15"
                    value={addPrepTime}
                    onChange={(e) => setAddPrepTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm"
                    disabled={addingItem}
                  />
                </div>
              </div>

              {addError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {addError}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-gray-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  disabled={addingItem}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1 shadow-sm"
                  disabled={addingItem}
                >
                  {addingItem ? (
                    <>
                      <Activity className="animate-spin" size={16} /> Creating…
                    </>
                  ) : (
                    'Add Dish'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
