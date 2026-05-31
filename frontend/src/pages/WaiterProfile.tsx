import { useEffect, useState } from 'react';
import { 
  User, Mail, Calendar, Shield, Activity, BadgeAlert, CheckCircle, Save, 
  Lock, Eye, EyeOff, KeyRound 
} from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  role: string;
  hasPassword?: boolean;
}

export default function WaiterProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Email edit
  const [emailInput, setEmailInput] = useState('');
  const [updating, setUpdating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setEmailInput(data.email || '');
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'Failed to load profile details');
        }
      } catch (err) {
        console.error(err);
        setError('Network error loading profile.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    if (!emailInput.trim()) {
      setSaveError('Email is required');
      return;
    }

    setUpdating(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
        credentials: 'include'
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setEmailInput(updated.email || '');
        setSaveSuccess('Email updated successfully!');
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || 'Failed to update email address. Make sure the email is unique.');
      }
    } catch (err) {
      console.error(err);
      setSaveError('An error occurred while updating profile.');
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }

    setChangingPw(true);
    try {
      const body: Record<string, string> = { newPassword };
      if (profile?.hasPassword) {
        body.currentPassword = currentPassword;
      }

      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include'
      });

      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPwSuccess('Password changed successfully! Use the new password next time you log in.');
        setTimeout(() => setPwSuccess(null), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setPwError(data.error || 'Failed to change password');
      }
    } catch (err) {
      console.error(err);
      setPwError('An error occurred while changing the password.');
    } finally {
      setChangingPw(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Activity className="animate-spin text-amber-500 mx-auto" size={36} />
          <p className="text-gray-500 text-sm font-medium">Loading profile details…</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-dashed border-red-200 p-8 text-center shadow-sm">
          <BadgeAlert className="text-red-500 mx-auto mb-3" size={40} />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Error Loading Profile</h3>
          <p className="text-gray-500 text-sm mb-4">{error || 'Could not find your staff record.'}</p>
        </div>
      </div>
    );
  }

  const initials = profile.username.slice(0, 2).toUpperCase();

  return (
    <div className="p-4 md:p-8 animate-slide-up max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900 font-serif flex items-center gap-2">
          <User className="text-amber-500" size={24} />
          My Profile
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Your staff identity and account settings</p>
      </div>

      {/* ── Profile Card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 h-28 relative">
          <div className="absolute -bottom-10 left-6">
            <div className="w-20 h-20 rounded-2xl bg-white p-1.5 shadow-md">
              <div className="w-full h-full rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center font-bold text-2xl text-amber-700 uppercase">
                {initials}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-14 p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-950 capitalize">{profile.username}</h2>
            <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 uppercase tracking-wide">
              {profile.role === 'admin' ? 'Administrator' : 'Waiter Staff'}
            </span>
          </div>

          <hr className="border-gray-100" />

          {/* Email Form */}
          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Account Details</h3>

            {saveSuccess && (
              <div className="p-3 bg-green-50 border border-green-150 text-green-700 font-medium text-xs rounded-xl flex items-center gap-2">
                <CheckCircle size={16} /> <span>{saveSuccess}</span>
              </div>
            )}
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 font-medium text-xs rounded-xl flex items-center gap-2">
                <BadgeAlert size={16} className="shrink-0" /> <span>{saveError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Username (Read-only) */}
              <div>
                <label htmlFor="profile-username" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Username (Unmodifiable)</span>
                  <Lock size={12} className="text-gray-400" />
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <User size={16} />
                  </div>
                  <input
                    id="profile-username"
                    type="text"
                    readOnly
                    disabled
                    value={profile.username}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-400 cursor-not-allowed select-none focus:outline-none"
                  />
                </div>
              </div>

              {/* Email (Editable) */}
              <div>
                <label htmlFor="profile-email" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Email Address *
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500">
                    <Mail size={16} />
                  </div>
                  <input
                    id="profile-email"
                    type="email"
                    required
                    disabled={profile.role === 'admin' || updating}
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className={`w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 transition ${
                      profile.role === 'admin' 
                        ? 'bg-gray-50 text-gray-400 cursor-not-allowed' 
                        : 'bg-white hover:bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
                    }`}
                  />
                </div>
              </div>

              {/* Registered date */}
              <div className="flex items-center gap-3 p-3 bg-gray-50/50 border border-gray-100 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Registered Since</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{formatDate(profile.createdAt)}</p>
                </div>
              </div>

              {/* Security Status */}
              <div className="flex items-center gap-3 p-3 bg-gray-50/50 border border-gray-100 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Shield size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Security Access</p>
                  <p className="font-semibold text-gray-800 mt-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                    Authorized Access Active
                  </p>
                </div>
              </div>
            </div>

            {profile.role !== 'admin' && (
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={updating || emailInput === profile.email}
                  className={`w-full font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow-md ${
                    updating || emailInput === profile.email
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/10'
                  }`}
                >
                  {updating ? (
                    <><Activity className="animate-spin" size={16} /> Saving Changes…</>
                  ) : (
                    <><Save size={16} /> Save Profile Changes</>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* ── Change Password Card ──────────────────────────────────────────── */}
      {profile.role !== 'admin' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-6">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
            <KeyRound size={16} className="text-amber-500" />
            Change Password
          </h3>

          <form onSubmit={handleChangePassword} className="space-y-4">
            {pwSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 font-medium text-xs rounded-xl flex items-center gap-2">
                <CheckCircle size={16} /> <span>{pwSuccess}</span>
              </div>
            )}
            {pwError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-600 font-medium text-xs rounded-xl flex items-center gap-2">
                <BadgeAlert size={16} className="shrink-0" /> <span>{pwError}</span>
              </div>
            )}

            {/* Current Password (only if account already has one) */}
            {profile.hasPassword && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Current Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    required={profile.hasPassword}
                    placeholder="Enter your current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    disabled={changingPw}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                    tabIndex={-1}
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500" size={16} />
                <input
                  type={showNewPw ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  disabled={changingPw}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                  tabIndex={-1}
                >
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                Confirm New Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="password"
                  required
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition ${
                    confirmPassword && confirmPassword !== newPassword
                      ? 'border-red-300 bg-red-50/30'
                      : confirmPassword && confirmPassword === newPassword
                        ? 'border-green-300 bg-green-50/30'
                        : 'border-gray-200'
                  }`}
                  disabled={changingPw}
                />
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-[10px] text-red-500 font-semibold mt-1.5">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={
                changingPw ||
                newPassword.length < 6 ||
                newPassword !== confirmPassword ||
                (profile.hasPassword && !currentPassword)
              }
              className={`w-full font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 ${
                changingPw || newPassword.length < 6 || newPassword !== confirmPassword || (profile.hasPassword && !currentPassword)
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/10'
              }`}
            >
              {changingPw ? (
                <><Activity className="animate-spin" size={16} /> Changing Password…</>
              ) : (
                <><KeyRound size={16} /> Change Password</>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
