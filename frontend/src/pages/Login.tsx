import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HOTEL_NAME } from '@/lib/utils';
import { Lock, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // OTP States
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  
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
        if (data.otpRequired) {
          setOtpRequired(true);
          setAdminEmail(data.email);
        } else {
          // Direct login (like waiter testing)
          navigate('/dashboard');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode }),
      });

      if (res.ok) {
        navigate('/dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid or expired verification code');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gray-900 p-8 text-center text-white">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
            {otpRequired ? <ShieldAlert size={24} className="text-amber-400" /> : <Lock size={24} />}
          </div>
          <h1 className="text-2xl font-bold font-serif">{HOTEL_NAME}</h1>
          <p className="text-gray-400 mt-2">
            {otpRequired ? 'Two-Factor Authentication' : 'Admin Dashboard Login'}
          </p>
        </div>
        
        {/* Body */}
        <div className="p-8">
          {!otpRequired ? (
            /* Phase 1: Username & Password */
            <form onSubmit={handleLogin} className="space-y-6">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm transition bg-gray-50/50"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm transition bg-gray-50/50"
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-black transition-colors focus:outline-none disabled:opacity-70 font-semibold shadow-sm"
              >
                {loading ? 'Authenticating...' : 'Login'}
              </button>
              
              <div className="text-xs text-gray-500 text-center mt-4 space-y-1 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="font-semibold text-gray-600">Admin Authentication Note:</p>
                <p>Logging in as <span className="font-mono bg-white px-1 border rounded text-[10px] font-bold text-gray-700">admin</span> will trigger a secure 6-digit verification code to the registered email: <span className="font-bold underline">{adminEmail || 'kavithahotel47471@gmail.com'}</span>.</p>
              </div>
            </form>
          ) : (
            /* Phase 2: Supabase OTP Verification */
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center p-3 bg-amber-50/40 rounded-xl border border-amber-100/50 mb-2">
                <p className="text-xs text-gray-600 mb-1.5 leading-relaxed">
                  A secure 6-digit verification code has been dispatched to:
                </p>
                <p className="font-bold text-amber-900 text-sm mb-1.5 tracking-wide">
                  {adminEmail}
                </p>
                <p className="text-[10px] text-gray-400 leading-normal">
                  Check your inbox (or spam) and enter the code below to complete authorization.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center">
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 text-center">
                  Enter Security Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  pattern="\d{6}"
                  placeholder="0 0 0 0 0 0"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-gray-50 font-bold"
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOtpRequired(false);
                    setOtpCode('');
                    setError('');
                  }}
                  className="flex-1 border border-gray-300 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition focus:outline-none text-sm"
                  disabled={loading}
                >
                  Back
                </button>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-black transition focus:outline-none disabled:opacity-70 text-sm shadow-sm"
                >
                  {loading ? 'Verifying...' : 'Verify & Login'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
