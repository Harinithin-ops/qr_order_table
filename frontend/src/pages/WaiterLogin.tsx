import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HOTEL_NAME } from '@/lib/utils';
import { Utensils, ArrowLeft, UserCheck } from 'lucide-react';

export default function WaiterLoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
        // Allow dynamic waiter to access the waiter dashboard
        navigate('/waiter/orders');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid credentials. Please use your assigned Waiter Username.');
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
        <div className="bg-amber-500 p-8 text-center text-white">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Utensils size={24} />
          </div>
          <h1 className="text-2xl font-bold font-serif">{HOTEL_NAME}</h1>
          <p className="text-amber-100 mt-2">Waiter Dashboard Login</p>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Waiter Username / Name</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm transition"
                placeholder="e.g. server"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-amber-600 transition-colors focus:outline-none disabled:opacity-70 shadow-sm"
            >
              {loading ? 'Verifying...' : 'Log In to Waiter Dashboard'}
            </button>

            <div className="text-xs text-gray-500 text-center mt-4 space-y-1.5 bg-amber-50 p-3.5 rounded-xl border border-amber-100">
              <p className="font-bold text-amber-800 flex items-center justify-center gap-1">
                <UserCheck size={12} />
                Username-Only Login
              </p>
              <p className="leading-relaxed">
                Log in by entering your assigned **Waiter Username**. Contact the Admin if you need to register a new account in the system.
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
