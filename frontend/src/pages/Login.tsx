import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { HOTEL_NAME } from '@/lib/utils';
import { Lock, ShieldAlert, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // OTP States
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  
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
        if (data.otpRequired) {
          setOtpRequired(true);
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
            /* Phase 1: Username Only */
            <>
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
                    placeholder="e.g. admin"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gray-900 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-black transition-colors focus:outline-none disabled:opacity-70 font-semibold shadow-sm"
                >
                  {loading ? 'Sending Code...' : 'Get Login Code'}
                </button>
              </form>

              <div className="mt-6 text-center border-t border-gray-100 pt-4 flex flex-col gap-2.5">
                <Link 
                  to="/waiter-login" 
                  className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors py-1 hover:underline"
                >
                  <ArrowLeft size={14} />
                  Back to Waiter Dashboard
                </Link>
                <Link 
                  to="/" 
                  className="inline-flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-0.5"
                >
                  Back to Home
                </Link>
              </div>
            </>
          ) : (
            /* Phase 2: Authenticator OTP Verification */
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="text-center p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 mb-2">
                <p className="text-xs text-gray-600 mb-1.5 leading-relaxed">
                  Enter the rolling 6-digit verification code from your
                </p>
                <p className="font-bold text-gray-950 text-sm mb-1.5 tracking-wide">
                  Authenticator App
                </p>
                <p className="text-[10px] text-gray-400 leading-normal">
                  (Or retrieve the active code printed in your server's backend terminal logs)
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
