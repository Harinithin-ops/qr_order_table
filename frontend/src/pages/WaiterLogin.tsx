import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HOTEL_NAME } from '@/lib/utils';
import { Utensils, ArrowLeft, UserCheck, User } from 'lucide-react';

export default function WaiterLoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      const role = localStorage.getItem('userRole');
      if (token && role === 'waiter') {
        try {
          const res = await fetch('/api/auth/check');
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.role === 'waiter') {
              navigate('/waiter/orders', { replace: true });
            }
          }
        } catch (e) {
          // Ignore
        }
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("userRole", "waiter");
        localStorage.setItem("userData", JSON.stringify(data.user || data.waiter));
        navigate('/waiter/orders');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid username. Please use your assigned Waiter Username.');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-amber-50/50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-amber-500 p-8 text-center text-white">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Utensils size={28} />
          </div>
          <h1 className="text-2xl font-bold font-serif">{HOTEL_NAME}</h1>
          <p className="text-amber-100 mt-1 text-sm">Waiter Staff Portal</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-200 font-medium">
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Waiter Username
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm transition bg-gray-50/50"
                  placeholder="e.g. server1"
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-amber-600 transition-colors focus:outline-none disabled:opacity-70 shadow-md shadow-amber-500/20"
            >
              {loading ? 'Verifying…' : 'Log In to Waiter Dashboard'}
            </button>

            <div className="text-xs text-gray-500 text-center bg-amber-50 p-3.5 rounded-xl border border-amber-100">
              <p className="font-bold text-amber-800 flex items-center justify-center gap-1 mb-1">
                <UserCheck size={12} />
                Username-Only Login
              </p>
              <p className="leading-relaxed">
                Enter your assigned <strong className="text-amber-800">Waiter Username</strong>. 
                Contact the Admin if you need to register a new account.
              </p>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              <ArrowLeft size={14} />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
