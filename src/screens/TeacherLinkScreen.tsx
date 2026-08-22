import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui';

const TEACHER_EMAIL = 'gaghzy@gmail.com';

export function TeacherLinkScreen() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(TEACHER_EMAIL, password);
    if (error) {
      toast(error, 'error');
      setLoading(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast('Sign-in failed. Please try again.', 'error');
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (profile && profile.role === 'teacher') {
      toast('Welcome back, Ms. Ghada!', 'success');
      window.location.href = '/teacher/dashboard';
      return;
    }

    if (profile && profile.role !== 'teacher') {
      toast('This account is not authorized for the teacher panel.', 'error');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    if (!profile && userData.user.email === TEACHER_EMAIL) {
      const { error: insertError } = await supabase.from('profiles').insert({
        id: userData.user.id,
        email: userData.user.email,
        first_name: 'Ghada',
        last_name: 'Ghazy',
        role: 'teacher',
      });

      if (insertError) {
        toast('Could not set up teacher profile. Please contact support.', 'error');
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      toast('Welcome, Ms. Ghada!', 'success');
      window.location.href = '/teacher/dashboard';
      return;
    }

    toast('Account not recognized.', 'error');
    await supabase.auth.signOut();
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-8 w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-bg mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold gradient-text">Teacher Sign In</h1>
          <p className="text-sm text-slate-500 mt-1">Ms. Ghada, please enter your password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1.5 block">Email</label>
            <input
              type="email"
              value={TEACHER_EMAIL}
              readOnly
              className="glass-input w-full rounded-xl px-4 py-3 text-slate-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1.5 block">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-3 text-slate-800"
              placeholder="••••••••"
              autoFocus
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Spinner size={20} /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-200/50 text-center">
          <a href="/" className="text-xs text-slate-400 hover:text-slate-600 transition">
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
