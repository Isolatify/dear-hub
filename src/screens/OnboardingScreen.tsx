import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui';

export function OnboardingScreen() {
  const { user, completeOnboarding } = useAuth();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (upErr) {
      toast(upErr.message, 'error');
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      toast('Please enter your first name, last name, and username.', 'warning');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      toast('Username must be 3-20 characters using letters, numbers, or underscores.', 'warning');
      return;
    }
    setLoading(true);
    const { error } = await completeOnboarding(firstName.trim(), lastName.trim(), username.trim(), avatarUrl);
    if (error) toast(error, 'error');
    else toast('Profile created! Welcome to DEAR Hub.', 'success');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-8 w-full max-w-md animate-scale-in">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold gradient-text">Welcome to DEAR Hub!</h1>
          <p className="text-sm text-slate-500 mt-2">Let's set up your profile to get started.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col items-center mb-4">
            <div className="relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-white/50" />
              ) : (
                <div className="w-24 h-24 rounded-full glass flex items-center justify-center text-slate-400">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full gradient-bg flex items-center justify-center cursor-pointer shadow-lg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
              </label>
            </div>
            {uploading && <p className="text-xs text-slate-400 mt-2">Uploading...</p>}
            <p className="text-xs text-slate-400 mt-1">Profile picture (optional)</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-600 mb-1.5 block">First Name</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-3 text-slate-800"
              placeholder="First name"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1.5 block">Last Name</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-3 text-slate-800"
              placeholder="Last name"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1.5 block">Username</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-3 text-slate-800"
              placeholder="your_username"
            />
            <p className="text-xs text-slate-400 mt-1">3-20 letters, numbers, or underscores</p>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <Spinner size={20} /> : 'Get Started'}
          </button>
        </form>
      </div>
    </div>
  );
}
