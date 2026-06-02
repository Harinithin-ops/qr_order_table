import { useEffect, useState } from 'react';
import { 
  Activity, Plus, Trash2, User, Search, AlertCircle, CheckCircle, X, Shield,
  Lock, Eye, EyeOff, KeyRound, RefreshCw, Pencil, ToggleLeft, ToggleRight,
  TableIcon
} from 'lucide-react';
import { HOTEL_NAME, formatCurrency } from '@/lib/utils';

interface AssignedTable {
  id: string;
  tableNumber: number;
  slug: string;
}

interface Waiter {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  isDisabled: boolean;
  createdAt: string;
  tables: AssignedTable[];
  ordersTaken: number;
  ordersCompleted: number;
  revenue: number;
}

export default function AdminWaitersPage() {
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add Waiter states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset Password states
  const [resetTarget, setResetTarget] = useState<Waiter | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  // Rename states
  const [renameTarget, setRenameTarget] = useState<Waiter | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSuccess, setRenameSuccess] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  // Toggle access state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Waiter Details Modal target state
  const [detailTarget, setDetailTarget] = useState<Waiter | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState<{
    tableBreakdown: { id: string; tableNumber: number; completedOrders: number }[];
    dailyStats: {
      dateLabel: string;
      totalOrders: number;
      totalRevenue: number;
      tables: { tableNumber: number; ordersCount: number; revenue: number }[];
    }[];
  } | null>(null);

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

    if (!addPassword || addPassword.length < 6) {
      setAddError('Password must be at least 6 characters');
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
          username: addUsername.trim(),
          password: addPassword
        }),
        credentials: 'include'
      });

      if (res.ok) {
        const newWaiter = await res.json();
        setWaiters(prev => [newWaiter, ...prev]);
        setAddSuccess(`✓ Waiter "${newWaiter.username}" created! They can now log in with the password you set.`);
        setAddUsername('');
        setAddPassword('');
        setTimeout(() => {
          setShowAddModal(false);
          setAddSuccess(null);
        }, 2500);
      } else {
        const errData = await res.json().catch(() => ({}));
        setAddError(errData.error || 'Failed to create waiter. Make sure the username is unique.');
      }
    } catch (err) {
      console.error(err);
      setAddError('An error occurred while creating the waiter account');
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);
    setResetSuccess(null);

    if (!resetPassword || resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }

    setResetting(true);
    try {
      const res = await fetch(`/api/waiters/${resetTarget.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: resetPassword }),
        credentials: 'include'
      });

      if (res.ok) {
        setResetSuccess(`Password for "${resetTarget.username}" has been reset successfully.`);
        setResetPassword('');
        setTimeout(() => {
          setResetTarget(null);
          setResetSuccess(null);
        }, 2000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setResetError(errData.error || 'Failed to reset password');
      }
    } catch (err) {
      console.error(err);
      setResetError('An error occurred while resetting the password');
    } finally {
      setResetting(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    setRenameError(null);
    setRenameSuccess(null);

    if (!renameValue.trim()) {
      setRenameError('Display name cannot be empty');
      return;
    }

    setRenaming(true);
    try {
      const res = await fetch(`/api/waiters/${renameTarget.id}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: renameValue.trim() }),
        credentials: 'include'
      });

      if (res.ok) {
        const updated = await res.json();
        setWaiters(prev => prev.map(w => w.id === updated.id ? updated : w));
        setRenameSuccess(`Display name updated to "${updated.displayName}".`);
        setTimeout(() => {
          setRenameTarget(null);
          setRenameSuccess(null);
        }, 1800);
      } else {
        const errData = await res.json().catch(() => ({}));
        setRenameError(errData.error || 'Failed to update display name');
      }
    } catch (err) {
      console.error(err);
      setRenameError('An error occurred while updating the display name');
    } finally {
      setRenaming(false);
    }
  };

  const handleToggleAccess = async (waiter: Waiter) => {
    setTogglingId(waiter.id);
    try {
      const res = await fetch(`/api/waiters/${waiter.id}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDisabled: !waiter.isDisabled }),
        credentials: 'include'
      });

      if (res.ok) {
        const updated = await res.json();
        setWaiters(prev => prev.map(w => w.id === updated.id ? updated : w));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to update access');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while updating waiter access');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredWaiters = waiters.filter(waiter => {
    const name = (waiter.displayName || waiter.username).toLowerCase();
    return name.includes(searchTerm.toLowerCase()) || waiter.username.toLowerCase().includes(searchTerm.toLowerCase());
  });

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
          <p className="text-gray-500 mt-1">
            Create, monitor, and manage Waiter accounts for {HOTEL_NAME}. 
            Each waiter logs in securely with their <strong>username + password</strong>.
          </p>
        </div>
        <button
          onClick={() => {
            setAddError(null);
            setAddSuccess(null);
            setAddUsername('');
            setAddPassword('');
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

      {/* Stats & Search */}
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
            placeholder="Search waiter name..."
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
                  <th className="px-6 py-4">Assigned Tables</th>
                  <th className="px-6 py-4">Registration Date</th>
                  <th className="px-6 py-4 text-center">Dashboard Access</th>
                  <th className="px-6 py-4 text-center">Password</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredWaiters.map(waiter => (
                  <tr key={waiter.id} className={`hover:bg-gray-50/50 transition ${waiter.isDisabled ? 'opacity-60' : ''}`}>
                    {/* Profile */}
                    <td className="px-6 py-4">
                      <div 
                        onClick={async () => {
                          setDetailTarget(waiter);
                          setResetPassword('');
                          setResetError(null);
                          setResetSuccess(null);
                          setShowResetPassword(false);

                          // Load detailed performance breakdown
                          setPerformanceLoading(true);
                          setPerformanceData(null);
                          try {
                            const res = await fetch(`/api/waiters/${waiter.id}/performance`, {
                              credentials: 'include'
                            });
                            if (res.ok) {
                              const data = await res.json();
                              setPerformanceData(data);
                            }
                          } catch (err) {
                            console.error('Failed to load performance metrics:', err);
                          } finally {
                            setPerformanceLoading(false);
                          }
                        }}
                        className="flex items-center gap-3 cursor-pointer group"
                        title="Click to view full waiter profile"
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm uppercase shadow-sm border border-black/5 ${getAvatarBgColor(waiter.username)} ${waiter.isDisabled ? 'grayscale' : ''} group-hover:scale-105 transition duration-200`}>
                          {(waiter.displayName || waiter.username).slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="font-semibold text-gray-900 leading-none group-hover:text-red-600 transition duration-200">
                              {waiter.displayName || waiter.username}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenameTarget(waiter);
                                setRenameValue(waiter.displayName || waiter.username);
                                setRenameError(null);
                                setRenameSuccess(null);
                              }}
                              className="text-gray-400 hover:text-blue-600 transition p-0.5 rounded"
                              title="Edit display name"
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium tracking-wide mt-0.5 block">
                            @{waiter.username}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Assigned Tables */}
                    <td className="px-6 py-4">
                      {waiter.tables.length === 0 ? (
                        <span className="text-xs text-gray-400 italic">No tables</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {waiter.tables
                            .slice()
                            .sort((a, b) => a.tableNumber - b.tableNumber)
                            .map(t => (
                              <span
                                key={t.id}
                                className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold"
                              >
                                <TableIcon size={10} />
                                T{t.tableNumber}
                              </span>
                            ))}
                        </div>
                      )}
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

                    {/* Dashboard Access Toggle */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleAccess(waiter)}
                        disabled={togglingId === waiter.id}
                        title={waiter.isDisabled ? 'Enable Dashboard Access' : 'Disable Dashboard Access'}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition active:scale-95 ${
                          waiter.isDisabled
                            ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                        } ${togglingId === waiter.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {togglingId === waiter.id ? (
                          <Activity size={12} className="animate-spin" />
                        ) : waiter.isDisabled ? (
                          <ToggleLeft size={14} />
                        ) : (
                          <ToggleRight size={14} />
                        )}
                        {waiter.isDisabled ? 'Disabled' : 'Enabled'}
                      </button>
                    </td>

                    {/* Password Reset */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => {
                          setResetTarget(waiter);
                          setResetPassword('');
                          setResetError(null);
                          setResetSuccess(null);
                          setShowResetPassword(false);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition active:scale-95"
                      >
                        <RefreshCw size={11} /> Reset
                      </button>
                    </td>

                    {/* Delete */}
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDeleteWaiter(waiter.id, waiter.displayName || waiter.username)}
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

      {/* ── Register Waiter Modal ─────────────────────────────────────────── */}
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
              {/* Username */}
              <div>
                <label htmlFor="waiter-username" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Waiter Username *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    id="waiter-username"
                    type="text"
                    required
                    placeholder="e.g. server2"
                    value={addUsername}
                    onChange={(e) => setAddUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm bg-gray-50/50"
                    disabled={submitting}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-normal">
                  Used to log in. You can set a display name afterwards.
                </p>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="waiter-password" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Password * <span className="text-gray-400 font-normal normal-case">(minimum 6 characters)</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    id="waiter-password"
                    type={showAddPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Set a secure password"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm bg-gray-50/50"
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    tabIndex={-1}
                  >
                    {showAddPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {/* Password strength indicator */}
                {addPassword.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          addPassword.length >= 12 ? 'bg-green-500' :
                          addPassword.length >= 9 ? (i < 3 ? 'bg-amber-400' : 'bg-gray-200') :
                          addPassword.length >= 6 ? (i < 2 ? 'bg-orange-400' : 'bg-gray-200') :
                          i === 0 ? 'bg-red-400' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                    <span className="text-[10px] font-semibold text-gray-400 ml-1">
                      {addPassword.length >= 12 ? 'Strong' :
                       addPassword.length >= 9 ? 'Good' :
                       addPassword.length >= 6 ? 'Weak' : 'Too short'}
                    </span>
                  </div>
                )}
              </div>

              {addError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" /> {addError}
                </p>
              )}

              {addSuccess && (
                <p className="text-xs font-semibold text-green-700 bg-green-50 p-2.5 rounded-lg border border-green-200 flex items-start gap-1.5">
                  <CheckCircle size={14} className="shrink-0 mt-0.5" /> {addSuccess}
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
                    'Create Account'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ──────────────────────────────────────────── */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto pt-12 md:pt-20">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 animate-slide-up mb-10">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-lg text-gray-900 font-serif flex items-center gap-2">
                  <KeyRound size={18} className="text-amber-500" /> Reset Password
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">For: <strong>{resetTarget.displayName || resetTarget.username}</strong></p>
              </div>
              <button onClick={() => setResetTarget(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  New Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm bg-gray-50/50"
                    disabled={resetting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    tabIndex={-1}
                  >
                    {showResetPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {resetError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" /> {resetError}
                </p>
              )}
              {resetSuccess && (
                <p className="text-xs font-semibold text-green-700 bg-green-50 p-2.5 rounded-lg border border-green-200 flex items-center gap-1.5">
                  <CheckCircle size={14} className="shrink-0" /> {resetSuccess}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTarget(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  disabled={resetting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1 shadow-sm"
                  disabled={resetting}
                >
                  {resetting ? <><Activity className="animate-spin" size={16} /> Saving…</> : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Rename Display Name Modal ─────────────────────────────────────── */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto pt-12 md:pt-20">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 animate-slide-up mb-10">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-lg text-gray-900 font-serif flex items-center gap-2">
                  <Pencil size={18} className="text-blue-500" /> Edit Display Name
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Login username: <strong>@{renameTarget.username}</strong> (unchanged)</p>
              </div>
              <button onClick={() => setRenameTarget(null)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Display Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="Enter display name"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm bg-gray-50/50"
                    disabled={renaming}
                    autoFocus
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 leading-normal">
                  This is the name shown in the admin dashboard. The login username stays the same.
                </p>
              </div>

              {renameError && (
                <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-100 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" /> {renameError}
                </p>
              )}
              {renameSuccess && (
                <p className="text-xs font-semibold text-green-700 bg-green-50 p-2.5 rounded-lg border border-green-200 flex items-center gap-1.5">
                  <CheckCircle size={14} className="shrink-0" /> {renameSuccess}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameTarget(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                  disabled={renaming}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-1 shadow-sm"
                  disabled={renaming}
                >
                  {renaming ? <><Activity className="animate-spin" size={16} /> Saving…</> : 'Save Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Waiter Profile Details Modal ─────────────────────────────────────────── */}
      {detailTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 md:p-6 shadow-2xl border border-gray-100 animate-slide-up relative overflow-hidden my-auto">
            
            {/* Banner top styling accent */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500" />
            
            <div className="flex justify-between items-start mb-4 pt-1">
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg uppercase shadow-md border border-black/5 ${getAvatarBgColor(detailTarget.username)}`}>
                  {(detailTarget.displayName || detailTarget.username).slice(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-xl text-gray-900 font-serif leading-tight">
                    {detailTarget.displayName || detailTarget.username}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-400 font-semibold tracking-wide">
                      @{detailTarget.username}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                      detailTarget.isDisabled
                        ? 'bg-red-50 border-red-200 text-red-600'
                        : 'bg-green-50 border-green-200 text-green-700'
                    }`}>
                      {detailTarget.isDisabled ? 'Disabled' : 'Active'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDetailTarget(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Tables Assigned & Overall Table Breakdown */}
              <div className="bg-gray-50/50 rounded-2xl p-3 border border-gray-100">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-sans">
                  <TableIcon size={12} className="text-amber-500" /> Tables Assigned & Overall Breakdown
                </h4>
                {detailTarget.tables.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No tables currently assigned to this waiter</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {detailTarget.tables
                      .slice()
                      .sort((a, b) => a.tableNumber - b.tableNumber)
                      .map(t => {
                        const tableStats = performanceData?.tableBreakdown.find(tb => tb.tableNumber === t.tableNumber);
                        return (
                          <div
                            key={t.id}
                            className="flex items-center justify-between bg-amber-50/50 border border-amber-100 text-amber-900 p-2 rounded-xl text-[11px] shadow-sm font-sans"
                          >
                            <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
                              <TableIcon size={10} /> Table {t.tableNumber}
                            </span>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">
                              {performanceLoading ? (
                                '...'
                              ) : (
                                `${tableStats?.completedOrders ?? 0} done`
                              )}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Stats & Revenue Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Orders Taken / Completed */}
                <div className="bg-gray-50/50 rounded-2xl p-3 border border-gray-100 flex flex-col justify-between">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5 font-sans">
                    <Activity size={12} className="text-blue-500" /> Overall Performance
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Orders Taken</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 shadow-sm">
                        {detailTarget.ordersTaken ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Completed</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-100 shadow-sm">
                        {detailTarget.ordersCompleted ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Revenue Generated */}
                <div className="bg-gray-50/50 rounded-2xl p-3 border border-gray-100 flex flex-col justify-between">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 font-sans">
                    <span className="text-emerald-500 font-bold">₹</span> Revenue Generated
                  </h4>
                  <div className="mt-auto">
                    <span className="text-[9px] font-bold text-gray-400 uppercase block tracking-wider leading-none">Settled Earnings</span>
                    <span className="font-black text-xl text-emerald-600 block mt-1 leading-none">
                      {formatCurrency(detailTarget.revenue ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Registration Date */}
              <div className="bg-gray-50/50 rounded-2xl p-3 border border-gray-100">
                <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5 font-sans">
                  <Activity size={12} className="text-purple-500" /> Registration Date
                </h4>
                <div className="text-xs font-semibold text-gray-800">
                  {new Intl.DateTimeFormat('en-IN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  }).format(new Date(detailTarget.createdAt))}
                </div>
              </div>

              {/* Daily Activity Log (Timeline Approach) */}
              <div className="bg-gray-50/50 rounded-2xl p-3.5 border border-gray-100">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 font-sans">
                  <Activity size={14} className="text-indigo-500" /> Daily Activity & Revenue Timeline (Past 11 Days)
                </h4>

                {performanceLoading ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2">
                    <Activity className="animate-spin text-red-600" size={20} />
                    <span className="text-[10px] font-medium text-gray-400">Loading history...</span>
                  </div>
                ) : !performanceData ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">No activity history records retrieved</p>
                ) : (
                  <div className="relative pl-4 border-l border-indigo-100 space-y-4 max-h-44 overflow-y-auto pr-1 select-none scrollbar-thin ml-2">
                    {performanceData.dailyStats.map((day, idx) => (
                      <div key={idx} className="relative group font-sans">
                        {/* Timeline node dot */}
                        <div className={`absolute -left-[21.5px] top-1 w-2 h-2 rounded-full border border-indigo-400 transition-all ${
                          day.totalOrders > 0 
                            ? 'bg-emerald-500 border-emerald-600 scale-110 shadow-sm' 
                            : 'bg-gray-300 border-gray-400'
                        }`} />

                        {/* Day Header Row */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-gray-800">
                            {day.dateLabel}
                          </span>
                          <span className="text-[10px] font-semibold text-gray-400">
                            {day.totalOrders > 0 ? (
                              <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                {day.totalOrders} orders • {formatCurrency(day.totalRevenue)}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-medium">Off duty / Idle</span>
                            )}
                          </span>
                        </div>

                        {/* Indented table breakdown rows */}
                        {day.tables.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {day.tables.map((t, tIdx) => (
                              <span 
                                key={tIdx} 
                                className="inline-flex items-center bg-white border border-gray-150 rounded-lg px-2 py-0.5 text-[9px] font-semibold text-gray-600 shadow-sm"
                              >
                                Table {t.tableNumber}: <strong className="text-gray-900 ml-0.5">{t.ordersCount}</strong> <span className="text-[8px] text-gray-400 mx-0.5">•</span> <strong className="text-emerald-600">{formatCurrency(t.revenue)}</strong>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
            
            <div className="mt-6 pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setDetailTarget(null)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition font-sans shadow-sm"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
