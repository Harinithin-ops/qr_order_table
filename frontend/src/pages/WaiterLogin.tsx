import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HOTEL_NAME } from '@/lib/utils';
import { Utensils, ArrowLeft } from 'lucide-react';

export default function WaiterLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const data = await res.json();
        // Allow both waiter and admin to access the waiter dashboard
        navigate('/waiter/orders');
      } else {
        setError('Invalid credentials. Use waiter credentials.');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col justify-center items-center p-4">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="waiter"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-amber-600 transition-colors focus:outline-none disabled:opacity-70"
            >
              {loading ? 'Signing in...' : 'Sign In as Waiter'}
            </button>

            <div className="text-xs text-gray-500 text-center mt-4 space-y-1 bg-amber-50 p-2.5 rounded-lg border border-amber-100">
              <p className="font-semibold text-gray-600">Waiter Credentials:</p>
              <p>Username: <span className="font-mono bg-white px-1 border rounded font-semibold text-gray-700">server</span> / <span className="font-mono bg-white px-1 border rounded font-semibold text-gray-700">server2024</span></p>
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
