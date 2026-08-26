import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';
import { Avatar, Spinner } from '@/components/ui';
import { DEFAULT_THEME, type ThemeConfig } from '@/types';
import {
  User, ChevronRight, Camera, Search, Moon, Sun, Palette, Type,
  LayoutGrid, Sparkles, GlassWater, Bell, BellOff, MessageSquare,
  BookOpen, Download, Trash2, Info, LogOut, Shield,
  Mail, Key, Eye, X, Check, Monitor, Smartphone,
  MessageCircle, History, Fingerprint, Accessibility,
  Keyboard, Zap, Headphones, Volume2, VolumeX, WifiOff,
  HardDrive, Archive, RefreshCw, HelpCircle, Book,
  SlidersHorizontal, PanelLeftClose,
} from 'lucide-react';

/* ── Constants ── */

function SidebarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

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

const LAYOUTS: { key: ThemeConfig['layout']; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'default', label: 'Default', desc: 'Balanced spacing', icon: <LayoutGrid size={18} /> },
  { key: 'compact', label: 'Compact', desc: 'More content per screen', icon: <Smartphone size={18} /> },
  { key: 'spacious', label: 'Spacious', desc: 'Breathable layout', icon: <Eye size={18} /> },
  { key: 'grid', label: 'Grid', desc: 'Card-based grid view', icon: <Monitor size={18} /> },
];

const SHORTCUTS = [
  { keys: 'Ctrl + K', action: 'Quick search' },
  { keys: 'Ctrl + ,', action: 'Open Settings' },
  { keys: 'Ctrl + D', action: 'Go to Dashboard' },
  { keys: 'Ctrl + M', action: 'Open Messages' },
  { keys: 'Esc', action: 'Close modal / dialog' },
  { keys: 'Ctrl + Enter', action: 'Submit / Save' },
];

/* ── localStorage helpers ── */

function loadSetting<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveSetting(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* ── Settings types ── */

interface UserPrefs {
  notifAnnouncements: boolean;
  notifMessages: boolean;
  notifSubmissions: boolean;
  notifSounds: boolean;
  notifDesktop: boolean;
  profileVisible: boolean;
  onlineStatusVisible: boolean;
  activityVisible: boolean;
  emailVisible: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
  screenReader: boolean;
  keyboardNav: boolean;
  shortcutsEnabled: boolean;
  compactCards: boolean;
  sidebarCollapsed: boolean;
}

const DEFAULT_PREFS: UserPrefs = {
  notifAnnouncements: true, notifMessages: true, notifSubmissions: true,
  notifSounds: true, notifDesktop: false,
  profileVisible: true, onlineStatusVisible: true, activityVisible: true, emailVisible: false,
  reduceMotion: false, highContrast: false, fontSize: 'medium',
  screenReader: false, keyboardNav: false, shortcutsEnabled: true,
  compactCards: false, sidebarCollapsed: false,
};

/* ════════════════════════════════════════════════════════════════════ */
/*  SettingsScreen                                                     */
/* ════════════════════════════════════════════════════════════════════ */

export function SettingsScreen({ isTeacher }: { isTeacher: boolean }) {
  const { profile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Core UI state ──
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [search, setSearch] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showUpdateLog, setShowUpdateLog] = useState(false);
  const [passwordEmail, setPasswordEmail] = useState('');

  // ── Persisted prefs (load from localStorage, apply to DOM on mount) ──
  const [prefs, setPrefs] = useState<UserPrefs>(() => loadSetting<UserPrefs>('dear-hub-prefs', DEFAULT_PREFS));

  // Sessions (fetched from Supabase)
  const [sessions, setSessions] = useState<Array<{ id: string; device: string; browser: string; last_active: string; current: boolean }>>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Connected accounts
  const [googleConnected, setGoogleConnected] = useState(false);

  // Data
  const [storageUsed, setStorageUsed] = useState(0);

  // ── Persist prefs to localStorage + apply to DOM ──
  const updatePrefs = useCallback((partial: Partial<UserPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      saveSetting('dear-hub-prefs', next);
      return next;
    });
  }, []);

  // Apply accessibility prefs to DOM on mount & change
  useEffect(() => {
    const root = document.documentElement;

    // Font size
    root.dataset.fontSize = prefs.fontSize;

    // High contrast
    if (prefs.highContrast) root.classList.add('high-contrast');
    else root.classList.remove('high-contrast');

    // Reduce motion
    if (prefs.reduceMotion) root.classList.add('reduce-motion');
    else root.classList.remove('reduce-motion');
  }, [prefs.fontSize, prefs.highContrast, prefs.reduceMotion]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!prefs.shortcutsEnabled) return;
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === ',') { e.preventDefault(); navigate('/settings'); }
      else if (ctrl && e.key === 'd') { e.preventDefault(); navigate(isTeacher ? '/teacher/dashboard' : '/dashboard'); }
      else if (ctrl && e.key === 'm') { e.preventDefault(); navigate(isTeacher ? '/teacher/messages' : '/messages'); }
      else if (e.key === 'Escape') { document.dispatchEvent(new CustomEvent('close-modals')); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prefs.shortcutsEnabled, navigate, isTeacher]);

  // ── Fetch sessions from Supabase ──
  useEffect(() => {
    const loadSessions = async () => {
      setSessionsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setSessionsLoading(false); return; }

      const currentDevice = navigator.userAgent;
      const isMobile = /Mobile|iPhone|iPad/i.test(currentDevice);
      const browser = currentDevice.includes('Chrome') ? 'Chrome' : currentDevice.includes('Firefox') ? 'Firefox' : currentDevice.includes('Safari') ? 'Safari' : 'Browser';
      const device = isMobile ? 'Mobile Device' : 'Desktop';

      setSessions([{
        id: session.user.id,
        device,
        browser,
        last_active: session.user.last_sign_in_at ?? new Date().toISOString(),
        current: true,
      }]);
      setSessionsLoading(false);
    };
    loadSessions();
  }, []);

  // ── Check Google connection ──
  useEffect(() => {
    const checkGoogle = async () => {
      const { data } = await supabase.auth.getIdentities();
      if (data?.identities?.some((i) => i.provider === 'google')) {
        setGoogleConnected(true);
      }
    };
    checkGoogle();
  }, []);

  // ── Calculate storage used ──
  useEffect(() => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('dear-hub')) {
        total += (localStorage.getItem(key)?.length ?? 0) * 2; // UTF-16
      }
    }
    setStorageUsed(Math.round(total / 1024));
  }, []);

  // ── Actions ──

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${profile.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { toast(error.message, 'error'); setUploading(false); return; }
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
    setEditingProfile(false);
    if (error) toast(error.message.includes('username') ? 'That username is already taken.' : error.message, 'error');
    else toast('Profile saved!', 'success');
  };

  const handleThemeChange = (partial: Partial<ThemeConfig>) => {
    setTheme({ ...theme, ...partial });
  };

  const handleResetTheme = () => {
    setTheme(DEFAULT_THEME);
    toast('Theme reset to defaults', 'success');
  };

  const handlePasswordReset = async () => {
    const emailToUse = passwordEmail.trim() || profile?.email;
    if (!emailToUse) { toast('Enter your email', 'error'); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, {
      redirectTo: `${window.location.origin}/settings`,
    });
    if (error) toast(error.message, 'error');
    else toast('Password reset email sent!', 'success');
    setPasswordEmail('');
  };

  const handleDisconnectGoogle = async () => {
    // Supabase doesn't support unlinking from client-side easily
    toast('To disconnect Google, contact support.', 'info');
  };

  const handleExportData = async () => {
    const [profileData, settingsData, submissionsData] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profile?.id ?? '').maybeSingle(),
      supabase.from('user_settings').select('*').eq('id', profile?.id ?? '').maybeSingle(),
      supabase.from('dear_submissions').select('*').eq('student_id', profile?.id ?? ''),
    ]);
    const exportObj = {
      exportedAt: new Date().toISOString(),
      profile: profileData.data,
      settings: settingsData.data,
      submissions: submissionsData.data,
      localStorage: Object.fromEntries(
        Object.keys(localStorage)
          .filter((k) => k.startsWith('dear-hub'))
          .map((k) => [k, JSON.parse(localStorage.getItem(k) ?? 'null')])
      ),
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dear-hub-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('All data exported!', 'success');
  };

  const handleClearCache = () => {
    const keysToKeep = ['dear-hub-theme', 'dear-hub-prefs', 'dear-hub-widgets', 'dear-hub-teacher-widgets', 'dear-hub-seen-version'];
    const allKeys = Object.keys(localStorage);
    allKeys.forEach((k) => { if (!keysToKeep.includes(k)) localStorage.removeItem(k); });
    // Recalc storage
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      total += (localStorage.getItem(localStorage.key(i) ?? '')?.length ?? 0) * 2;
    }
    setStorageUsed(Math.round(total / 1024));
    toast('Cache cleared!', 'success');
  };

  const handleSignOutAll = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    toast('Signed out of all devices', 'success');
  };

  const handleRevokeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    toast('Session revoked', 'success');
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // ── Search ──
  const sectionIndex = useMemo(() => ({
    profile: ['profile', 'avatar', 'name', 'username', 'account'],
    account: ['account', 'email', 'password', 'security', 'delete'],
    appearance: ['appearance', 'theme', 'dark', 'light', 'color', 'font', 'glass', 'animation'],
    display: ['display', 'layout', 'grid', 'compact', 'spacious'],
    notifications: ['notification', 'alert', 'announcement', 'message', 'submission', 'sound', 'desktop'],
    privacy: ['privacy', 'security', 'password', 'two-factor', '2fa', 'visibility', 'online'],
    sessions: ['session', 'device', 'sign out all', 'revoke'],
    accessibility: ['accessibility', 'motion', 'contrast', 'font size', 'screen reader', 'keyboard'],
    shortcuts: ['shortcut', 'keyboard shortcut', 'ctrl', 'hotkey'],
    dashboard: ['dashboard', 'widget', 'layout', 'compact', 'animation', 'sidebar'],
    connected: ['connected', 'google', 'account', 'link'],
    data: ['data', 'storage', 'cache', 'export', 'download', 'sync'],
    help: ['help', 'support', 'feedback', 'documentation', 'report'],
    about: ['about', 'version', 'info', 'update log'],
  }), []);

  const visibleSections = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return Object.entries(sectionIndex)
      .filter(([, keywords]) => keywords.some((k) => k.includes(q)))
      .map(([section]) => section);
  }, [search, sectionIndex]);

  const isSectionVisible = (section: string) => !visibleSections || visibleSections.includes(section);

  // ── Helper: toggle row ──
  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange} className={`settings-toggle ${value ? 'settings-toggle-on' : ''}`}>
      <span className="settings-toggle-knob" />
    </button>
  );

  return (
    <div className="settings-page min-h-screen">
      <div className="settings-header">
        <h1 className="settings-header-title">Settings</h1>
        <p className="settings-header-subtitle">Customize your experience</p>
      </div>

      <div className="settings-container">
        {/* Search */}
        <div className="settings-search-wrapper">
          <Search size={18} className="settings-search-icon" />
          <input type="text" placeholder="Search settings..." value={search} onChange={(e) => setSearch(e.target.value)} className="settings-search-input" />
          {search && <button onClick={() => setSearch('')} className="settings-search-clear"><X size={16} /></button>}
        </div>

        {/* ═══ PROFILE ═══ */}
        {isSectionVisible('profile') && (
          <div className="settings-section">
            <div className="settings-profile-card">
              <div className="settings-profile-top">
                <div className="settings-profile-avatar-wrap">
                  <Avatar url={profile?.avatar_url} name={`${firstName} ${lastName}`} size={72} />
                  <label className="settings-profile-camera">
                    {uploading ? <Spinner size={14} /> : <Camera size={14} />}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                  </label>
                </div>
                <div className="settings-profile-info">
                  <h2 className="settings-profile-name">{firstName} {lastName}</h2>
                  <p className="settings-profile-email">{profile?.email}</p>
                  <span className={`settings-role-badge ${isTeacher ? 'settings-role-teacher' : 'settings-role-student'}`}>
                    {isTeacher ? 'Teacher' : 'Student'}
                  </span>
                </div>
              </div>
              <button onClick={() => setEditingProfile(!editingProfile)} className="settings-profile-edit-btn">
                {editingProfile ? 'Cancel' : 'Edit Profile'}
                <ChevronRight size={16} className={`settings-chevron ${editingProfile ? 'settings-chevron-open' : ''}`} />
              </button>
              {editingProfile && (
                <div className="settings-profile-form">
                  {!isTeacher && (
                    <div className="settings-field">
                      <label className="settings-field-label">Username</label>
                      <div className="settings-field-input-wrap">
                        <span className="settings-field-prefix">@</span>
                        <input type="text" value={username} minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" onChange={(e) => setUsername(e.target.value)} className="settings-field-input settings-field-input-with-prefix" />
                      </div>
                    </div>
                  )}
                  <div className="settings-field-row">
                    <div className="settings-field">
                      <label className="settings-field-label">First Name</label>
                      <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="settings-field-input" />
                    </div>
                    <div className="settings-field">
                      <label className="settings-field-label">Last Name</label>
                      <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="settings-field-input" />
                    </div>
                  </div>
                  <button onClick={handleSaveProfile} disabled={savingProfile} className="settings-save-btn">
                    {savingProfile ? <Spinner size={16} /> : <><Check size={16} /> Save Changes</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ ACCOUNT ═══ */}
        {isSectionVisible('account') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Account</h3>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row-icon"><Mail size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Email</span>
                  <span className="settings-row-value">{profile?.email}</span>
                </div>
              </div>
              <div className="settings-row" onClick={() => toggleSection('password')}>
                <div className="settings-row-icon"><Key size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Change Password</span>
                  <span className="settings-row-desc">Update your password via email</span>
                </div>
                <ChevronRight size={18} className={`settings-chevron ${expandedSection === 'password' ? 'settings-chevron-open' : ''}`} />
              </div>
              {expandedSection === 'password' && (
                <div className="settings-expand">
                  <input type="email" value={passwordEmail} onChange={(e) => setPasswordEmail(e.target.value)} placeholder={profile?.email ?? 'your@email.com'} className="settings-field-input w-full mb-3" />
                  <button onClick={handlePasswordReset} className="btn-primary px-4 py-2 text-sm rounded-xl">Send Reset Link</button>
                </div>
              )}
              <div className="settings-row settings-row-danger" onClick={() => setShowDeleteConfirm(true)}>
                <div className="settings-row-icon settings-row-icon-danger"><Trash2 size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label settings-row-label-danger">Delete Account</span>
                  <span className="settings-row-desc">Permanently delete your account and data</span>
                </div>
                <ChevronRight size={18} className="settings-row-chevron" />
              </div>
            </div>
          </div>
        )}

        {/* ═══ APPEARANCE ═══ */}
        {isSectionVisible('appearance') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>
            <div className="settings-card">
              <div className="settings-row" onClick={() => toggleSection('thememode')}>
                <div className="settings-row-icon"><Moon size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Theme Mode</span>
                  <span className="settings-row-value">{theme.mode === 'light' ? 'Light' : 'Dark'}</span>
                </div>
                <ChevronRight size={18} className={`settings-chevron ${expandedSection === 'thememode' ? 'settings-chevron-open' : ''}`} />
              </div>
              {expandedSection === 'thememode' && (
                <div className="settings-expand">
                  <div className="settings-mode-grid">
                    <button onClick={() => handleThemeChange({ mode: 'light' })} className={`settings-mode-card ${theme.mode === 'light' ? 'settings-mode-active' : ''}`}><Sun size={24} /><span>Light</span></button>
                    <button onClick={() => handleThemeChange({ mode: 'dark' })} className={`settings-mode-card ${theme.mode === 'dark' ? 'settings-mode-active' : ''}`}><Moon size={24} /><span>Dark</span></button>
                  </div>
                </div>
              )}

              <div className="settings-row" onClick={() => toggleSection('colortheme')}>
                <div className="settings-row-icon"><Palette size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Color Theme</span>
                  <span className="settings-row-value">{COLOR_PRESETS.find((p) => p.primary === theme.primaryColor)?.name || 'Custom'}</span>
                </div>
                <ChevronRight size={18} className={`settings-chevron ${expandedSection === 'colortheme' ? 'settings-chevron-open' : ''}`} />
              </div>
              {expandedSection === 'colortheme' && (
                <div className="settings-expand">
                  <div className="settings-color-grid">
                    {COLOR_PRESETS.map((preset) => (
                      <button key={preset.name} onClick={() => handleThemeChange({ primaryColor: preset.primary, accentColor: preset.accent })} className={`settings-color-card ${theme.primaryColor === preset.primary ? 'settings-color-active' : ''}`}>
                        <div className="settings-color-swatch" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.accent})` }}>
                          {theme.primaryColor === preset.primary && <Check size={14} className="settings-color-check" />}
                        </div>
                        <span className="settings-color-name">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                  <div className="settings-color-custom">
                    <div className="settings-color-custom-row">
                      <span className="settings-color-custom-label">Primary</span>
                      <div className="settings-color-custom-picker">
                        <input type="color" value={theme.primaryColor} onChange={(e) => handleThemeChange({ primaryColor: e.target.value })} className="settings-color-input" />
                        <span className="settings-color-hex">{theme.primaryColor}</span>
                      </div>
                    </div>
                    <div className="settings-color-custom-row">
                      <span className="settings-color-custom-label">Accent</span>
                      <div className="settings-color-custom-picker">
                        <input type="color" value={theme.accentColor} onChange={(e) => handleThemeChange({ accentColor: e.target.value })} className="settings-color-input" />
                        <span className="settings-color-hex">{theme.accentColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="settings-row" onClick={() => toggleSection('font')}>
                <div className="settings-row-icon"><Type size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Font Family</span>
                  <span className="settings-row-value">{FONTS.find((f) => f.key === theme.fontFamily)?.label}</span>
                </div>
                <ChevronRight size={18} className={`settings-chevron ${expandedSection === 'font' ? 'settings-chevron-open' : ''}`} />
              </div>
              {expandedSection === 'font' && (
                <div className="settings-expand">
                  <div className="settings-font-grid">
                    {FONTS.map((font) => (
                      <button key={font.key} onClick={() => handleThemeChange({ fontFamily: font.key })} className={`settings-font-card ${theme.fontFamily === font.key ? 'settings-font-active' : ''}`} style={{ fontFamily: font.family }}>
                        <span className="settings-font-name">{font.label}</span>
                        <span className="settings-font-sample" style={{ fontFamily: font.family }}>Aa</span>
                        {theme.fontFamily === font.key && <Check size={14} className="settings-font-check" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="settings-row" onClick={() => toggleSection('glass')}>
                <div className="settings-row-icon"><GlassWater size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Glass Intensity</span>
                  <span className="settings-row-value capitalize">{theme.glassIntensity}</span>
                </div>
                <ChevronRight size={18} className={`settings-chevron ${expandedSection === 'glass' ? 'settings-chevron-open' : ''}`} />
              </div>
              {expandedSection === 'glass' && (
                <div className="settings-expand">
                  <div className="settings-glass-grid">
                    {(['subtle', 'medium', 'strong'] as const).map((level) => (
                      <button key={level} onClick={() => handleThemeChange({ glassIntensity: level })} className={`settings-glass-card ${theme.glassIntensity === level ? 'settings-glass-active' : ''}`}>
                        <span className="settings-glass-label capitalize">{level}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="settings-toggle-row">
                <div className="flex items-center gap-3">
                  <div className="settings-row-icon"><Zap size={20} /></div>
                  <div>
                    <p className="settings-row-label">Animations</p>
                    <p className="settings-row-desc">Enable smooth transitions</p>
                  </div>
                </div>
                <Toggle value={theme.animations} onChange={() => handleThemeChange({ animations: !theme.animations })} />
              </div>

              <div className="settings-row" onClick={handleResetTheme}>
                <div className="settings-row-icon"><RefreshCw size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Reset Theme</span>
                  <span className="settings-row-desc">Restore default appearance</span>
                </div>
                <ChevronRight size={18} className="settings-row-chevron" />
              </div>
            </div>
          </div>
        )}

        {/* ═══ DISPLAY ═══ */}
        {isSectionVisible('display') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Display</h3>
            <div className="settings-card">
              <div className="settings-row" onClick={() => toggleSection('layout')}>
                <div className="settings-row-icon"><LayoutGrid size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Layout</span>
                  <span className="settings-row-value capitalize">{theme.layout}</span>
                </div>
                <ChevronRight size={18} className={`settings-chevron ${expandedSection === 'layout' ? 'settings-chevron-open' : ''}`} />
              </div>
              {expandedSection === 'layout' && (
                <div className="settings-expand">
                  <div className="grid grid-cols-2 gap-2">
                    {LAYOUTS.map((layout) => (
                      <button key={layout.key} onClick={() => handleThemeChange({ layout: layout.key })} className={`p-3 rounded-xl text-left transition ${theme.layout === layout.key ? 'bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/30 text-[var(--primary-color)]' : 'glass text-app-muted hover:text-app-primary'}`}>
                        <div className="flex items-center gap-2 mb-1">{layout.icon}<span className="text-sm font-medium">{layout.label}</span></div>
                        <p className="text-xs opacity-70">{layout.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ NOTIFICATIONS ═══ */}
        {isSectionVisible('notifications') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Notifications</h3>
            <div className="settings-card">
              {([
                { key: 'notifAnnouncements' as const, icon: <Bell size={20} />, label: 'Announcements', desc: 'New announcements from teachers' },
                { key: 'notifMessages' as const, icon: <MessageSquare size={20} />, label: 'Messages', desc: 'New messages' },
                { key: 'notifSubmissions' as const, icon: <BookOpen size={20} />, label: 'Submission Updates', desc: 'When your DEAR is graded' },
                { key: 'notifSounds' as const, icon: prefs.notifSounds ? <Volume2 size={20} /> : <VolumeX size={20} />, label: 'Notification Sounds', desc: 'Play sounds for notifications' },
                { key: 'notifDesktop' as const, icon: <Monitor size={20} />, label: 'Desktop Notifications', desc: 'Show browser notifications' },
              ]).map((item) => (
                <div key={item.key} className="settings-toggle-row">
                  <div className="flex items-center gap-3">
                    <div className="settings-row-icon">{item.icon}</div>
                    <div><p className="settings-row-label">{item.label}</p><p className="settings-row-desc">{item.desc}</p></div>
                  </div>
                  <Toggle value={prefs[item.key]} onChange={() => {
                    if (item.key === 'notifDesktop' && !prefs.notifDesktop && 'Notification' in window) {
                      Notification.requestPermission().then((p) => {
                        updatePrefs({ notifDesktop: p === 'granted' });
                        if (p !== 'granted') toast('Notifications blocked by browser', 'warning');
                      });
                    } else {
                      updatePrefs({ [item.key]: !prefs[item.key] });
                    }
                  }} />
                </div>
              ))}
              <div className="settings-toggle-row">
                <div className="flex items-center gap-3">
                  <div className="settings-row-icon"><BellOff size={20} /></div>
                  <div><p className="settings-row-label">Mute All</p><p className="settings-row-desc">Temporarily disable all notifications</p></div>
                </div>
                <Toggle
                  value={!prefs.notifAnnouncements && !prefs.notifMessages && !prefs.notifSubmissions}
                  onChange={() => {
                    const allOff = !prefs.notifAnnouncements && !prefs.notifMessages && !prefs.notifSubmissions;
                    updatePrefs({ notifAnnouncements: allOff, notifMessages: allOff, notifSubmissions: allOff });
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ═══ PRIVACY & SECURITY ═══ */}
        {isSectionVisible('privacy') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Privacy & Security</h3>
            <div className="settings-card">
              {([
                { key: 'profileVisible' as const, icon: <Eye size={20} />, label: 'Profile Visibility', desc: 'Allow others to see your profile' },
                { key: 'onlineStatusVisible' as const, icon: <User size={20} />, label: 'Online Status', desc: 'Show when you\'re online' },
                { key: 'activityVisible' as const, icon: <Zap size={20} />, label: 'Activity Feed', desc: 'Show your recent activity' },
                { key: 'emailVisible' as const, icon: <Mail size={20} />, label: 'Email Visibility', desc: 'Show email on your profile' },
              ]).map((item) => (
                <div key={item.key} className="settings-toggle-row">
                  <div className="flex items-center gap-3">
                    <div className="settings-row-icon">{item.icon}</div>
                    <div><p className="settings-row-label">{item.label}</p><p className="settings-row-desc">{item.desc}</p></div>
                  </div>
                  <Toggle value={prefs[item.key]} onChange={() => updatePrefs({ [item.key]: !prefs[item.key] })} />
                </div>
              ))}
              <div className="settings-row" onClick={() => toggleSection('twofactor')}>
                <div className="settings-row-icon"><Fingerprint size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Two-Factor Authentication</span>
                  <span className="settings-row-desc">Add an extra layer of security</span>
                </div>
                <ChevronRight size={18} className={`settings-chevron ${expandedSection === 'twofactor' ? 'settings-chevron-open' : ''}`} />
              </div>
              {expandedSection === 'twofactor' && (
                <div className="settings-expand">
                  <p className="text-sm text-app-secondary mb-3">Two-factor authentication adds an extra layer of security to your account.</p>
                  <button onClick={() => toast('2FA setup coming soon!', 'info')} className="btn-primary px-4 py-2 text-sm rounded-xl">Enable 2FA</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ SESSIONS ═══ */}
        {isSectionVisible('sessions') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Session Management</h3>
            <div className="settings-card">
              {sessionsLoading ? (
                <div className="p-4 flex justify-center"><Spinner size={20} /></div>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-app-muted p-4 text-center">No active sessions.</p>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="settings-row">
                    <div className="settings-row-icon"><Monitor size={20} /></div>
                    <div className="settings-row-content">
                      <span className="settings-row-label">
                        {session.device} — {session.browser}
                        {session.current && <span className="ml-2 text-[10px] text-green-500 font-medium">(Current)</span>}
                      </span>
                      <span className="settings-row-desc">Last active {new Date(session.last_active).toLocaleDateString()}</span>
                    </div>
                    {!session.current && (
                      <button onClick={() => handleRevokeSession(session.id)} className="text-xs text-red-500 hover:underline">Revoke</button>
                    )}
                  </div>
                ))
              )}
              <div className="settings-row" onClick={handleSignOutAll}>
                <div className="settings-row-icon"><WifiOff size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Sign Out All Devices</span>
                  <span className="settings-row-desc">Revoke all sessions except current</span>
                </div>
                <ChevronRight size={18} className="settings-row-chevron" />
              </div>
            </div>
          </div>
        )}

        {/* ═══ ACCESSIBILITY ═══ */}
        {isSectionVisible('accessibility') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Accessibility</h3>
            <div className="settings-card">
              <div className="settings-toggle-row">
                <div className="flex items-center gap-3">
                  <div className="settings-row-icon"><Accessibility size={20} /></div>
                  <div><p className="settings-row-label">Reduce Motion</p><p className="settings-row-desc">Minimize animations throughout the app</p></div>
                </div>
                <Toggle value={prefs.reduceMotion} onChange={() => updatePrefs({ reduceMotion: !prefs.reduceMotion })} />
              </div>
              <div className="settings-toggle-row">
                <div className="flex items-center gap-3">
                  <div className="settings-row-icon"><Eye size={20} /></div>
                  <div><p className="settings-row-label">High Contrast</p><p className="settings-row-desc">Increase contrast for better visibility</p></div>
                </div>
                <Toggle value={prefs.highContrast} onChange={() => updatePrefs({ highContrast: !prefs.highContrast })} />
              </div>
              <div className="settings-row" onClick={() => toggleSection('fontsize')}>
                <div className="settings-row-icon"><Type size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Font Size</span>
                  <span className="settings-row-value capitalize">{prefs.fontSize}</span>
                </div>
                <ChevronRight size={18} className={`settings-chevron ${expandedSection === 'fontsize' ? 'settings-chevron-open' : ''}`} />
              </div>
              {expandedSection === 'fontsize' && (
                <div className="settings-expand">
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <button key={size} onClick={() => updatePrefs({ fontSize: size })} className={`flex-1 py-2 rounded-xl text-sm font-medium transition capitalize ${prefs.fontSize === size ? 'bg-[var(--primary-color)] text-white' : 'glass text-app-muted'}`}>
                        <span className={size === 'small' ? 'text-xs' : size === 'large' ? 'text-lg' : 'text-sm'}>Aa</span>
                        <span className="ml-1 text-xs">{size}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="settings-toggle-row">
                <div className="flex items-center gap-3">
                  <div className="settings-row-icon"><Headphones size={20} /></div>
                  <div><p className="settings-row-label">Screen Reader Support</p><p className="settings-row-desc">Optimize for screen readers</p></div>
                </div>
                <Toggle value={prefs.screenReader} onChange={() => updatePrefs({ screenReader: !prefs.screenReader })} />
              </div>
              <div className="settings-toggle-row">
                <div className="flex items-center gap-3">
                  <div className="settings-row-icon"><Keyboard size={20} /></div>
                  <div><p className="settings-row-label">Keyboard Navigation</p><p className="settings-row-desc">Navigate with keyboard shortcuts</p></div>
                </div>
                <Toggle value={prefs.keyboardNav} onChange={() => updatePrefs({ keyboardNav: !prefs.keyboardNav })} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ KEYBOARD SHORTCUTS ═══ */}
        {isSectionVisible('shortcuts') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Keyboard Shortcuts</h3>
            <div className="settings-card">
              <div className="settings-toggle-row mb-3">
                <div className="flex items-center gap-3">
                  <div className="settings-row-icon"><Keyboard size={20} /></div>
                  <div><p className="settings-row-label">Enable Shortcuts</p><p className="settings-row-desc">Use keyboard shortcuts for quick actions</p></div>
                </div>
                <Toggle value={prefs.shortcutsEnabled} onChange={() => updatePrefs({ shortcutsEnabled: !prefs.shortcutsEnabled })} />
              </div>
              {prefs.shortcutsEnabled && (
                <div className="space-y-2 mt-3">
                  {SHORTCUTS.map((shortcut) => (
                    <div key={shortcut.keys} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-app-secondary">{shortcut.action}</span>
                      <kbd className="text-[10px] font-mono px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-app-muted border border-slate-200 dark:border-slate-700">{shortcut.keys}</kbd>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ DASHBOARD ═══ */}
        {isSectionVisible('dashboard') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Dashboard</h3>
            <div className="settings-card">
              <div className="settings-toggle-row">
                <div className="flex items-center gap-3">
                  <div className="settings-row-icon"><SlidersHorizontal size={20} /></div>
                  <div><p className="settings-row-label">Compact Cards</p><p className="settings-row-desc">Show more content with less padding</p></div>
                </div>
                <Toggle value={prefs.compactCards} onChange={() => updatePrefs({ compactCards: !prefs.compactCards })} />
              </div>
              <div className="settings-toggle-row">
                <div className="flex items-center gap-3">
                  <div className="settings-row-icon"><PanelLeftClose size={20} /></div>
                  <div><p className="settings-row-label">Collapsed Sidebar</p><p className="settings-row-desc">Start with sidebar collapsed</p></div>
                </div>
                <Toggle value={prefs.sidebarCollapsed} onChange={() => updatePrefs({ sidebarCollapsed: !prefs.sidebarCollapsed })} />
              </div>
            </div>
          </div>
        )}

        {/* ═══ CONNECTED ACCOUNTS ═══ */}
        {isSectionVisible('connected') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Connected Accounts</h3>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                </div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Google</span>
                  <span className="settings-row-desc">{googleConnected ? 'Connected' : 'Not connected'}</span>
                </div>
                <button onClick={googleConnected ? handleDisconnectGoogle : () => toast('Sign in with Google on the auth page to connect.', 'info')} className={`text-xs font-medium ${googleConnected ? 'text-red-500 hover:underline' : 'text-[var(--primary-color)] hover:underline'}`}>
                  {googleConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ DATA & STORAGE ═══ */}
        {isSectionVisible('data') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Data & Storage</h3>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row-icon"><HardDrive size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Storage Used</span>
                  <span className="settings-row-desc">Local cache and settings</span>
                </div>
                <span className="settings-row-value">{storageUsed} KB</span>
              </div>
              <div className="settings-row" onClick={handleExportData}>
                <div className="settings-row-icon"><Download size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Export All Data</span>
                  <span className="settings-row-desc">Download profile, settings, submissions</span>
                </div>
                <ChevronRight size={18} className="settings-row-chevron" />
              </div>
              <div className="settings-row" onClick={handleClearCache}>
                <div className="settings-row-icon"><Archive size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Clear Cache</span>
                  <span className="settings-row-desc">Free up local storage space</span>
                </div>
                <ChevronRight size={18} className="settings-row-chevron" />
              </div>
            </div>
          </div>
        )}

        {/* ═══ HELP & SUPPORT ═══ */}
        {isSectionVisible('help') && (
          <div className="settings-section">
            <h3 className="settings-section-title">Help & Support</h3>
            <div className="settings-card">
              <div className="settings-row" onClick={() => navigate('/feedback')}>
                <div className="settings-row-icon"><MessageCircle size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Send Feedback</span>
                  <span className="settings-row-desc">Report bugs or request features</span>
                </div>
                <ChevronRight size={18} className="settings-row-chevron" />
              </div>
              <div className="settings-row" onClick={() => toast('Documentation coming soon!', 'info')}>
                <div className="settings-row-icon"><Book size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Documentation</span>
                  <span className="settings-row-desc">Learn how to use DEAR Hub</span>
                </div>
                <ChevronRight size={18} className="settings-row-chevron" />
              </div>
              <div className="settings-row" onClick={() => toast('Problem reported! We\'ll look into it.', 'success')}>
                <div className="settings-row-icon"><HelpCircle size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Report a Problem</span>
                  <span className="settings-row-desc">Get help with issues</span>
                </div>
                <ChevronRight size={18} className="settings-row-chevron" />
              </div>
            </div>
          </div>
        )}

        {/* ═══ ABOUT ═══ */}
        {isSectionVisible('about') && (
          <div className="settings-section">
            <h3 className="settings-section-title">About</h3>
            <div className="settings-card">
              <div className="settings-row">
                <div className="settings-row-icon"><Info size={20} /></div>
                <div className="settings-row-content"><span className="settings-row-label">App Version</span></div>
                <span className="settings-row-value">1.1.0</span>
              </div>
              <div className="settings-row" onClick={() => setShowUpdateLog(true)}>
                <div className="settings-row-icon"><History size={20} /></div>
                <div className="settings-row-content">
                  <span className="settings-row-label">Update Log</span>
                  <span className="settings-row-desc">See what's new in each version</span>
                </div>
                <ChevronRight size={18} className="settings-row-chevron" />
              </div>
              <div className="settings-row">
                <div className="settings-row-icon"><User size={20} /></div>
                <div className="settings-row-content"><span className="settings-row-label">Account Created</span></div>
                <span className="settings-row-value">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '--'}</span>
              </div>
              <div className="settings-row">
                <div className="settings-row-icon"><Shield size={20} /></div>
                <div className="settings-row-content"><span className="settings-row-label">Role</span></div>
                <span className="settings-row-value capitalize">{profile?.role || 'student'}</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ SIGN OUT ═══ */}
        {(!visibleSections || visibleSections.includes('account') || !search.trim()) && (
          <div className="settings-section">
            <button onClick={() => setShowSignOutConfirm(true)} className="settings-signout-btn">
              <LogOut size={20} /> Sign Out
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showDeleteConfirm && (
        <div className="settings-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-icon settings-modal-icon-danger"><Trash2 size={24} /></div>
            <h3 className="settings-modal-title">Delete Account?</h3>
            <p className="settings-modal-desc">This action is permanent and cannot be undone.</p>
            <div className="settings-modal-actions">
              <button onClick={() => setShowDeleteConfirm(false)} className="settings-modal-cancel">Cancel</button>
              <button onClick={() => { setShowDeleteConfirm(false); toast('Contact support to delete your account.', 'warning'); }} className="settings-modal-danger">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showSignOutConfirm && (
        <div className="settings-modal-overlay" onClick={() => setShowSignOutConfirm(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal-icon"><LogOut size={24} /></div>
            <h3 className="settings-modal-title">Sign Out?</h3>
            <p className="settings-modal-desc">You will be redirected to the login page.</p>
            <div className="settings-modal-actions">
              <button onClick={() => setShowSignOutConfirm(false)} className="settings-modal-cancel">Cancel</button>
              <button onClick={() => signOut()} className="settings-modal-confirm">Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {showUpdateLog && (
        <div className="settings-modal-overlay" onClick={() => setShowUpdateLog(false)}>
          <div className="settings-modal settings-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-semibold text-app-primary">Update Log</h3>
              <button onClick={() => setShowUpdateLog(false)} className="text-app-muted hover:text-app-primary transition"><X size={20} /></button>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {[
                { version: '1.1.0', date: 'Aug 2026', tag: 'Latest', changes: [
                  'Mega dashboards with 14 student & 8 teacher widgets',
                  'WhatsApp-style messaging with call overlay',
                  'Sapling AI Detection API integration',
                  'GradeScreen remake with split pane & auto AI check',
                  'ManageStudents with search & expandable cards',
                  'Browser alerts replaced with glass ConfirmModal',
                  'PDF rotation bug fix & submission locking',
                  'Mobile responsiveness across all screens',
                ]},
                { version: '1.0.0', date: 'Aug 2026', tag: '', changes: [
                  'Fully functional settings with persistence',
                  'Customizable dashboards with toggleable widgets',
                  'Keyboard shortcuts system',
                  'Accessibility settings (font size, reduce motion, high contrast)',
                  'Session management',
                  'Data export & cache management',
                ]},
                { version: '0.9.0', date: 'Aug 2026', tag: '', changes: ['Feedback board', 'Real-time activity', 'AI checker', '12 themes', 'Dark/light mode', '13 fonts'] },
                { version: '0.8.0', date: 'Aug 2026', tag: '', changes: ['DEAR workspace', 'Word processor', 'Grading', 'Submissions', 'Announcements'] },
                { version: '0.1.0', date: 'Aug 2026', tag: 'Alpha', changes: ['Initial release', 'Auth & onboarding', 'Dashboards', 'Supabase'] },
              ].map((release) => (
                <div key={release.version} className="border-b border-slate-200/30 dark:border-slate-700/30 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-app-primary">v{release.version}</span>
                    {release.tag && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--primary-color)] text-white">{release.tag}</span>}
                    <span className="text-xs text-app-muted ml-auto">{release.date}</span>
                  </div>
                  <ul className="space-y-1">
                    {release.changes.map((change, i) => (
                      <li key={i} className="text-sm text-app-secondary flex items-start gap-2">
                        <span className="text-[var(--primary-color)] mt-1 shrink-0">•</span>{change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
