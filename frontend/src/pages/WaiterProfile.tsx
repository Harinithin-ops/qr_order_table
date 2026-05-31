import { useEffect, useState } from 'react';
import { User, Mail, Calendar, Shield, Activity, BadgeAlert } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  role: string;
}

export default function WaiterProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
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

  // Get Initials for Avatar
  const initials = profile.username.slice(0, 2).toUpperCase();

  return (
    <div className="p-4 md:p-8 animate-slide-up max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-serif flex items-center gap-2">
          <User className="text-amber-500" size={24} />
          My Profile
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Your staff identity and account information</p>
      </div>

      {/* Profile Detail Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden">
        {/* Banner with Initials Avatar */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 h-28 relative">
          <div className="absolute -bottom-10 left-6">
            <div className="w-20 h-20 rounded-2xl bg-white p-1.5 shadow-md">
              <div className="w-full h-full rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center font-bold text-2xl text-amber-700 uppercase">
                {initials}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="pt-14 p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-950 capitalize">{profile.username}</h2>
            <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-800 uppercase tracking-wide">
              {profile.role === 'admin' ? 'Administrator' : 'Waiter Staff'}
            </span>
          </div>

          <hr className="border-gray-100" />

          {/* Details list */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Account Information</h3>
            
            <div className="grid grid-cols-1 gap-4 text-sm">
              {/* Username row */}
              <div className="flex items-center gap-3 p-3 bg-gray-50/50 hover:bg-gray-50 border border-gray-100/50 rounded-xl transition">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Username</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{profile.username}</p>
                </div>
              </div>

              {/* Email row */}
              <div className="flex items-center gap-3 p-3 bg-gray-50/50 hover:bg-gray-50 border border-gray-100/50 rounded-xl transition">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Mail size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Generated Email ID</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{profile.email}</p>
                </div>
              </div>

              {/* Registration row */}
              <div className="flex items-center gap-3 p-3 bg-gray-50/50 hover:bg-gray-50 border border-gray-100/50 rounded-xl transition">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Calendar size={16} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Registered Since</p>
                  <p className="font-semibold text-gray-800 mt-0.5">
                    {formatDate(profile.createdAt)}
                  </p>
                </div>
              </div>

              {/* Status row */}
              <div className="flex items-center gap-3 p-3 bg-gray-50/50 hover:bg-gray-50 border border-gray-100/50 rounded-xl transition">
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
          </div>
        </div>
      </div>
    </div>
  );
}
