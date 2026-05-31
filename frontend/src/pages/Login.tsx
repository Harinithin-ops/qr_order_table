import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HOTEL_NAME } from '@/lib/utils';
import { Lock } from 'lucide-react';

export default function LoginPage() {
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
        navigate('/dashboard');
      } else {
        setError('Invalid credentials');
      }
    } catch (err) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up">
        <div className="bg-gray-900 p-8 text-center text-white">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-bold font-serif">{HOTEL_NAME}</h1>
          <p className="text-gray-400 mt-2">Admin Dashboard Login</p>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white font-bold py-3 px-4 rounded-lg hover:bg-black transition-colors focus:outline-none disabled:opacity-70 font-semibold"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
            <div className="text-xs text-gray-500 text-center mt-4 space-y-1 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
              <p className="font-semibold text-gray-600">Demo Accounts:</p>
              <p>Admin: <span className="font-mono bg-white px-1 border rounded font-semibold text-gray-700">admin</span> / <span className="font-mono bg-white px-1 border rounded font-semibold text-gray-700">kavitha2024</span></p>
              <p>Waiter: <span className="font-mono bg-white px-1 border rounded font-semibold text-gray-700">server</span> / <span className="font-mono bg-white px-1 border rounded font-semibold text-gray-700">server2024</span></p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
