import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

const ADMIN_EMAILS = ['abdul.mohammad5504@gmail.com'];

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  needsOnboarding: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: string | null; user: User | null }>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  completeOnboarding: (
    firstName: string,
    lastName: string,
    username: string,
    avatarUrl?: string | null
  ) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const isAdmin = !!user && ADMIN_EMAILS.includes(user.email ?? '');

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }

    if (!data) {
      setNeedsOnboarding(true);
      setProfile(null);
      return;
    }

    setProfile(data as Profile);
    setNeedsOnboarding(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => {
          setLoading(false);
          setInitialLoadDone(true);
        });
      } else {
        setLoading(false);
        setInitialLoadDone(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Only react to actual sign-in/sign-out events, NOT token refreshes
      // and NOT INITIAL_SESSION if we've already loaded once
      if (event === 'SIGNED_IN' && session?.user) {
        setLoading(true);
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setNeedsOnboarding(false);
        setLoading(false);
      }
      // Ignore INITIAL_SESSION (already handled by getSession above)
      // Ignore TOKEN_REFRESHED (session still valid)
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const emailRedirectTo = window.location.hostname === 'localhost'
      ? `${window.location.origin}/onboarding`
      : 'https://dear-hub.vercel.app/onboarding';
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });
    return { error: error?.message ?? null, user: data.user };
  };

  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle = async () => {
    const redirectTo = window.location.hostname === 'localhost'
      ? `${window.location.origin}/dashboard`
      : 'https://dear-hub.vercel.app/dashboard';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setNeedsOnboarding(false);
  };

  const completeOnboarding = async (
    firstName: string,
    lastName: string,
    username: string,
    avatarUrl?: string | null
  ) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
      first_name: firstName,
      last_name: lastName,
      username: username.toLowerCase(),
      role: 'student',
      avatar_url: avatarUrl ?? null,
    });

    if (error) return { error: error.message };

    await fetchProfile(user.id);
    return { error: null };
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        needsOnboarding,
        isAdmin,
        signIn,
        signUp,
        resendConfirmation,
        signInWithGoogle,
        signOut,
        completeOnboarding,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
