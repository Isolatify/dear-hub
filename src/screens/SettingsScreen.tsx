import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { GlassCard, Avatar, Spinner } from '@/components/ui';
import { DEFAULT_THEME, type ThemeConfig } from '@/types';

const COLOR_PRESETS = [
  { name: 'Dear Blue', primary: '#6096B7', accent: '#8BB4D8' },
  { name: 'Ocean', primary: '#3b82f6', accent: '#06b6d4' },
  { name: 'Emerald', primary: '#10b981', accent: '#14b8a6' },
  { name: 'Sunset', primary: '#f97316', accent: '#f43f5e' },
  { name: 'Royal', primary: '#2563eb', accent: '#7c3aed' },
  { name: 'Rose', primary: '#ec4899', accent: '#f43f5e' },
  { name: 'Forest', primary: '#16a34a', accent: '#65a30d' },
  { name: 'Slate', primary: '#475569', accent: '#0ea5e9' },
  { name: 'Fire', primary: '#ef4444', accent: '#f59e0b' },
  { name: 'Midnight', primary: '#1e293b', accent: '#6366f1' },
  { name: 'Mint', primary: '#34d399', accent: '#22d3ee' },
  { name: 'Lavender', primary: '#a78bfa', accent: '#f0abfc' },
];

const LAYOUTS: { key: ThemeConfig['layout']; label: string; desc: string }[] = [
  { key: 'default', label: 'Default', desc: 'Balanced spacing' },
  { key: 'compact', label: 'Compact', desc: 'More content per screen' },
  { key: 'spacious', label: 'Spacious', desc: 'Breathable layout' },
  { key: 'grid', label: 'Grid', desc: 'Card-based grid view' },
];

const FONTS: { key: ThemeConfig['fontFamily']; label: string; family: string }[] = [
  { key: 'poppins', label: 'Poppins', family: "'Poppins', sans-serif" },
  { key: 'sfpro', label: 'SF Pro', family: "'SF Pro Display', sans-serif" },
  { key: 'inter', label: 'Inter', family: "'Inter', sans-serif" },
  { key: 'roboto', label: 'Roboto', family: "'Roboto', sans-serif" },
  { key: 'montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif" },
  { key: 'raleway', label: 'Raleway', family: "'Raleway', sans-serif" },
  { key: 'nunito', label: 'Nunito', family: "'Nunito', sans-serif" },
  { key: 'lora', label: 'Lora', family: "'Lora', serif" },
  { key: 'playfair', label: 'Playfair', family: "'Playfair Display', serif" },
  { key: 'sourceSans', label: 'Source Sans', family: "'Source Sans 3', sans-serif" },
  { key: 'dmSans', label: 'DM Sans', family: "'DM Sans', sans-serif" },
  { key: 'spaceGrotesk', label: 'Space Grotesk', family: "'Space Grotesk', sans-serif" },
  { key: 'manrope', label: 'Manrope', family: "'Manrope', sans-serif" },
];

export function SettingsScreen({ isTeacher }: { isTeacher: boolean }) {
  const { profile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${profile.id}/avatar.${ext}`;

    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) {
      toast(error.message, 'error');
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', profile.id);
    await refreshProfile();
    setUploading(false);
    toast('Profile picture updated!', 'success');
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName, username: username.toLowerCase(), updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    await refreshProfile();
    setSavingProfile(false);
    if (error) toast(error.message.includes('username') ? 'That username is already taken.' : error.message, 'error');
    else toast('Profile saved!', 'success');
  };

  const handleThemeChange = (partial: Partial<ThemeConfig>) => {
    setTheme({ ...theme, ...partial });
  };

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-semibold text-app-primary">Settings</h1>
        <p className="text-app-secondary mt-1">Customize your profile and the look of your dashboard.</p>
      </div>

      {/* Profile section */}
      <GlassCard className="p-6 mb-4 animate-slide-up">
        <h2 className="text-lg font-semibold text-app-primary mb-4">Profile</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative">
            <Avatar url={profile?.avatar_url} name={`${firstName} ${lastName}`} size={72} />
            <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full gradient-bg flex items-center justify-center cursor-pointer shadow-lg">
              {uploading ? (
                <Spinner size={14} />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
          </div>
          <div className="flex-1">
            <p className="text-sm text-app-secondary">{isTeacher ? 'Teacher Account' : 'Student Account'}</p>
            <p className="text-xs text-app-muted">{profile?.email}</p>
          </div>
        </div>

        {!isTeacher && (
          <div className="mt-3">
            <label className="text-sm font-medium text-app-secondary mb-1.5 block">Username</label>
            <input
              type="text"
              value={username}
              minLength={3}
              maxLength={20}
              pattern="[a-zA-Z0-9_]+"
              onChange={(e) => setUsername(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-2.5"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-app-secondary mb-1.5 block">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-2.5"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-app-secondary mb-1.5 block">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-2.5"
            />
          </div>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="btn-primary mt-4 flex items-center gap-2"
        >
          {savingProfile ? <Spinner size={18} /> : 'Save Profile'}
        </button>
      </GlassCard>

      {/* Appearance: Mode + Glass + Font + Animations */}
      <GlassCard className="p-6 mb-4 animate-slide-up">
        <h2 className="text-lg font-semibold text-app-primary mb-4">Appearance</h2>

        {/* Light/Dark mode */}
        <div className="mb-4">
          <label className="text-sm font-medium text-app-secondary mb-2 block">Theme Mode</label>
          <div className="flex gap-2">
            {(['light', 'dark'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleThemeChange({ mode })}
                className={`flex-1 glass-input rounded-xl py-2.5 text-sm capitalize transition flex items-center justify-center gap-2 ${
                  theme.mode === mode ? 'ring-2 ring-[var(--primary-color)] text-[var(--primary-color)] font-medium' : 'text-app-secondary hover:opacity-80'
                }`}
              >
                {mode === 'light' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                )}
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-app-secondary mb-2 block">Glass Intensity</label>
          <div className="flex gap-2">
            {(['subtle', 'medium', 'strong'] as const).map((level) => (
              <button
                key={level}
                onClick={() => handleThemeChange({ glassIntensity: level })}
                className={`flex-1 glass-input rounded-xl py-2.5 text-sm capitalize transition ${
                  theme.glassIntensity === level ? 'ring-2 ring-[var(--primary-color)] text-[var(--primary-color)] font-medium' : 'text-app-secondary hover:opacity-80'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-app-secondary mb-2 block">Font Family</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {FONTS.map((font) => (
              <button
                key={font.key}
                onClick={() => handleThemeChange({ fontFamily: font.key })}
                className={`flex-1 glass-input rounded-xl py-2.5 text-sm transition ${
                  theme.fontFamily === font.key ? 'ring-2 ring-[var(--primary-color)] text-[var(--primary-color)] font-medium' : 'text-app-secondary hover:opacity-80'
                }`}
                style={{
                  fontFamily: font.family,
                }}
              >
                {font.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-app-secondary">Animations</p>
            <p className="text-xs text-app-muted">Enable smooth transitions and effects</p>
          </div>
          <button
            onClick={() => handleThemeChange({ animations: !theme.animations })}
            className={`w-12 h-7 rounded-full transition relative shrink-0 ${theme.animations ? 'gradient-bg' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${theme.animations ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </GlassCard>

      {/* Theme colors */}
      <GlassCard className="p-6 mb-4 animate-slide-up">
        <h2 className="text-lg font-semibold text-app-primary mb-4">Color Theme</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {COLOR_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleThemeChange({ primaryColor: preset.primary, accentColor: preset.accent })}
              className={`glass-input rounded-xl p-3 text-left transition ${
                theme.primaryColor === preset.primary ? 'ring-2 ring-[var(--primary-color)]' : 'hover:opacity-80'
              }`}
            >
              <div className="flex gap-1.5 mb-2">
                <span className="w-6 h-6 rounded-full" style={{ background: preset.primary }} />
                <span className="w-6 h-6 rounded-full" style={{ background: preset.accent }} />
              </div>
              <p className="text-xs font-medium text-app-secondary">{preset.name}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-app-secondary mb-1.5 block">Primary Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.primaryColor}
                onChange={(e) => handleThemeChange({ primaryColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border-0"
              />
              <span className="text-sm text-app-secondary font-mono">{theme.primaryColor}</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-app-secondary mb-1.5 block">Accent Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.accentColor}
                onChange={(e) => handleThemeChange({ accentColor: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border-0"
              />
              <span className="text-sm text-app-secondary font-mono">{theme.accentColor}</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Layout */}
      <GlassCard className="p-6 mb-4 animate-slide-up">
        <h2 className="text-lg font-semibold text-app-primary mb-4">Dashboard Layout</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {LAYOUTS.map((layout) => (
            <button
              key={layout.key}
              onClick={() => handleThemeChange({ layout: layout.key })}
              className={`glass-input rounded-xl p-3 text-left transition ${
                theme.layout === layout.key ? 'ring-2 ring-[var(--primary-color)]' : 'hover:opacity-80'
              }`}
            >
              <p className="text-sm font-medium text-app-primary">{layout.label}</p>
              <p className="text-xs text-app-muted mt-0.5">{layout.desc}</p>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Reset */}
      <GlassCard className="p-6 mb-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-app-primary">Reset Theme</h2>
            <p className="text-sm text-app-muted">Go back to the default look</p>
          </div>
          <button onClick={() => setTheme(DEFAULT_THEME)} className="btn-ghost">
            Reset to Default
          </button>
        </div>
      </GlassCard>

      {/* Sign out */}
      <GlassCard className="p-6 animate-slide-up">
        <button onClick={() => signOut()} className="w-full py-3 rounded-xl bg-red-50 text-red-500 font-medium hover:bg-red-100 transition flex items-center justify-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Sign Out
        </button>
      </GlassCard>
    </div>
  );
}
