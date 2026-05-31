import { useEffect, useState } from 'react';
import { Activity, Plus, Trash2, User, Search, AlertCircle, CheckCircle, X, Shield } from 'lucide-react';
import { HOTEL_NAME } from '@/lib/utils';

interface Waiter {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export default function AdminWaitersPage() {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Waiter states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchWaiters = async () => {
    try {
      const res = await fetch('/api/waiters', {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setWaiters(data);
      }
    } catch (err) {
      console.error('Failed to load waiters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWaiters();
  }, []);

  const handleAddWaiterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);

    if (!addUsername.trim()) {
      setAddError('Username is required');
      return;
    }

    if (waiters.length >= 40) {
      setAddError('Limit reached: You can create a maximum of 40 waiter accounts.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/waiters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: addUsername.trim()
        }),
        credentials: 'include'
      });

      if (res.ok) {
        const newWaiter = await res.json();
        setWaiters(prev => [newWaiter, ...prev]);
        setAddSuccess(`Successfully registered Waiter "${newWaiter.username}"!`);
        setAddUsername('');
        setTimeout(() => {
          setShowAddModal(false);
          setAddSuccess(null);
        }, 1500);
      } else {
        const errData = await res.json().catch(() => ({}));
        setAddError(errData.error || 'Failed to register waiter profile. Make sure the username is unique.');
      }
    } catch (err) {
      console.error(err);
      setAddError('An error occurred while creating waiter account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWaiter = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete waiter profile "${name}"?\nThey will immediately lose access to the Waiter Dashboard.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/waiters/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        setWaiters(prev => prev.filter(w => w.id !== id));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to delete waiter profile');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while deleting the waiter account');
    }
  };

  const filteredWaiters = waiters.filter(waiter => 
    waiter.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to generate dynamic premium background colors for avatar circles based on username initials
  const getAvatarBgColor = (name: string) => {
    const code = name.charCodeAt(0) % 5;
    return [
      'bg-red-500 text-white',
      'bg-amber-500 text-white',
      'bg-green-600 text-white',
      'bg-blue-600 text-white',
      'bg-purple-600 text-white'
    ][code];
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center min-h-screen bg-gray-50 items-center">
        <Activity className="animate-spin text-red-600" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 animate-slide-up max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-serif">Staff Management</h1>
          <p className="text-gray-500 mt-1">Create, monitor, and delete Waiter accounts for Kavitha Hotel. Staff logs in securely using only their Username.</p>
        </div>
        <button
          onClick={() => {
            setAddError(null);
            setAddSuccess(null);
            setShowAddModal(true);
          }}
          disabled={waiters.length >= 40}
          className={`self-start md:self-auto font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 shadow-md active:scale-95 transition ${
            waiters.length >= 40 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' 
              : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/10'
          }`}
        >
          <Plus size={18} /> Register Waiter
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-400 font-medium">
          <Shield size={16} className="text-red-500" />
          <span>Active Staff Profiles: <span className="font-bold text-gray-800">{waiters.length} / 40 Slots</span></span>
          {waiters.length >= 40 && (
            <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">MAX LIMIT REACHED</span>
          )}
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search waiter username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm transition"
          />
        </div>
      </div>

      {/* Waiters Listing */}
      {filteredWaiters.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-3">
            <User size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No staff members found</h3>
          <p className="text-gray-500 text-sm">
            {searchTerm ? 'Try adjusting your search query.' : 'Click "Register Waiter" to add your first staff profile.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200 font-semibold">
                  <th className="px-6 py-4">Waiter Profile</th>
                  <th className="px-6 py-4">Registration Date</th>
                  <th className="px-6 py-4 text-center">Dashboard Access</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredWaiters.map(waiter => (
                  <tr key={waiter.id} className="hover:bg-gray-50/50 transition">
                    {/* Profile & Initials */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm uppercase shadow-sm border border-black/5 ${getAvatarBgColor(waiter.username)}`}>
                          {waiter.username.slice(0, 2)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900 leading-none">{waiter.username}</h4>
                          <span className="text-[10px] text-gray-400 font-medium tracking-wide uppercase mt-1 block">Waiter Staff</span>
                        </div>
                      </div>
                    </td>

                    {/* Registration Date */}
                    <td className="px-6 py-4 text-gray-400 text-xs font-semibold">
                      {new Intl.DateTimeFormat('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      }).format(new Date(waiter.createdAt))}
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-4 text-center">
                      <span className="bg-green-50 border border-green-200 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                        <CheckCircle size={10} fill="currentColor" className="text-white" />
                        Enabled
                      </span>
                    </td>

                    {/* Deletion action */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteWaiter(waiter.id, waiter.username)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition active:scale-90"
                        title="Delete Waiter Profile"
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

      {/* Register Waiter Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto pt-12 md:pt-20">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-slide-up mb-10">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-xl text-gray-900 font-serif">Register Waiter Profile</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddWaiterSubmit} className="space-y-4">
              <div>
                <label htmlFor="waiter-username" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Waiter Username *
                </label>
                <input
                  id="waiter-username"
                  type="text"
                  required
                  placeholder="e.g. server2"
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm bg-gray-50/50"
                  disabled={submitting}
                />
                <p className="text-[10px] text-gray-400 mt-1.5 leading-normal">
                  The waiter will use this username to log in securely to their dashboard.
                </p>
              </div>

              {addError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" /> {addError}
                </p>
              )}

              {addSuccess && (
                <p className="text-xs font-semibold text-green-700 bg-green-50 p-2.5 rounded-lg border border-green-150 flex items-center gap-1.5">
                  <CheckCircle size={14} className="shrink-0" /> {addSuccess}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-gray-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1 shadow-sm"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Activity className="animate-spin" size={16} /> Creating…
                    </>
                  ) : (
                    'Add Waiter'
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
