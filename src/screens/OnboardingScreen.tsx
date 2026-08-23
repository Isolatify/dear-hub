import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';

export function OnboardingScreen() {
  const { user, completeOnboarding } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [previewText, setPreviewText] = useState('Reading opens a new window into the world.');
  const [welcomeReady, setWelcomeReady] = useState(false);

  useEffect(() => {
    if (step !== 1) return;
    const timer = window.setTimeout(() => setWelcomeReady(true), 2000);
    return () => window.clearTimeout(timer);
  }, [step]);

  const fonts = [
    { key: 'poppins' as const, label: 'Poppins', family: "'Poppins', sans-serif" },
    { key: 'sfpro' as const, label: 'SF Pro', family: "'SF Pro Display', sans-serif" },
    { key: 'inter' as const, label: 'Inter', family: "'Inter', sans-serif" },
    { key: 'roboto' as const, label: 'Roboto', family: "'Roboto', sans-serif" },
    { key: 'montserrat' as const, label: 'Montserrat', family: "'Montserrat', sans-serif" },
    { key: 'raleway' as const, label: 'Raleway', family: "'Raleway', sans-serif" },
    { key: 'nunito' as const, label: 'Nunito', family: "'Nunito', sans-serif" },
    { key: 'lora' as const, label: 'Lora', family: "'Lora', serif" },
    { key: 'playfair' as const, label: 'Playfair', family: "'Playfair Display', serif" },
    { key: 'sourceSans' as const, label: 'Source Sans', family: "'Source Sans 3', sans-serif" },
    { key: 'dmSans' as const, label: 'DM Sans', family: "'DM Sans', sans-serif" },
    { key: 'spaceGrotesk' as const, label: 'Space Grotesk', family: "'Space Grotesk', sans-serif" },
    { key: 'manrope' as const, label: 'Manrope', family: "'Manrope', sans-serif" },
  ];

  const themes = [
    ['Dear Blue', '#6096B7', '#8BB4D8'], ['Ocean', '#3b82f6', '#06b6d4'], ['Emerald', '#10b981', '#14b8a6'],
    ['Sunset', '#f97316', '#f43f5e'], ['Royal', '#2563eb', '#7c3aed'], ['Rose', '#ec4899', '#f43f5e'],
    ['Forest', '#16a34a', '#65a30d'], ['Slate', '#475569', '#0ea5e9'], ['Fire', '#ef4444', '#f59e0b'],
    ['Midnight', '#1e293b', '#6366f1'], ['Mint', '#34d399', '#22d3ee'], ['Lavender', '#a78bfa', '#f0abfc'],
  ] as const;

  const advance = () => setStep((current) => Math.min(10, current + 1));

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    setUploadProgress(15);
    const path = `${user.id}/avatar.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      toast(uploadError.message, 'error');
      setUploading(false);
      return;
    }
    setUploadProgress(75);
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploadProgress(100);
    setUploading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadAvatar(file);
  };

  const checkUsername = async (value: string) => {
    const normalized = value.trim().toLowerCase();
    setUsername(normalized);
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalized)) {
      setUsernameState('idle');
      return;
    }
    setUsernameState('checking');
    const { data } = await supabase.from('profiles').select('id').ilike('username', normalized).maybeSingle();
    setUsernameState(data ? 'taken' : 'available');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !username.trim() || usernameState === 'taken') {
      toast('Please complete your name and choose an available username.', 'warning');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
      toast('Username must be 3-20 characters using letters, numbers, or underscores.', 'warning');
      return;
    }
    setLoading(true);
    const { error } = await completeOnboarding(firstName.trim(), lastName.trim(), username.trim(), avatarUrl);
    if (error) toast(error, 'error');
    else {
      toast('Profile created! Welcome to DEAR Hub.', 'success');
      navigate('/dashboard', { replace: true });
    }
    setLoading(false);
  };

  return (
    <div className="onboarding-shell min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="onboarding-blob onboarding-blob-one" /><div className="onboarding-blob onboarding-blob-two" /><div className="onboarding-blob onboarding-blob-three" />
      <div className="glass rounded-3xl p-6 sm:p-8 w-full max-w-2xl relative z-10 animate-scale-in">
        <div className="flex items-center justify-between mb-7"><span className="text-xs text-app-muted">STEP {step} OF 10</span><div className="flex gap-1.5">{Array.from({ length: 10 }, (_, index) => <span key={index} className={`h-1.5 w-6 rounded-full ${index < step ? 'gradient-bg' : 'bg-slate-200/70 dark:bg-slate-700'}`} />)}</div></div>
        {step === 1 && <div className="text-center py-10"><h1 className="text-4xl font-semibold gradient-text">Welcome to DEAR Hub</h1><p className="text-sm text-app-secondary mt-3">Let's create your account so that we can get started!</p>{welcomeReady ? <button onClick={advance} className="btn-primary mt-10 px-10">Start</button> : <p className="text-xs text-app-muted mt-10">Preparing your reading space...</p>}</div>}
        {step === 2 && <div className="py-8"><h1 className="text-3xl font-semibold text-app-primary">What is your first & last name?</h1><p className="text-app-muted mt-2">Your name helps your classmates and teacher recognize you.</p><div className="grid sm:grid-cols-2 gap-4 mt-8"><input autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} className="onboarding-input" placeholder="First name" /><input value={lastName} onChange={(e) => setLastName(e.target.value)} className="onboarding-input" placeholder="Last name" /></div><button onClick={() => firstName && lastName ? advance() : toast('Please enter both names.', 'warning')} className="btn-primary mt-8">Continue</button></div>}
        {step === 3 && <div className="py-8"><h1 className="text-3xl font-semibold text-app-primary">Upload your Profile Picture</h1><p className="text-app-muted mt-2">How do you want to show yourself to your classmates?</p><div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) uploadAvatar(file); }} onClick={() => fileInputRef.current?.click()} className="onboarding-dropzone mt-8"><AvatarPreview url={avatarUrl} name={`${firstName} ${lastName}`} /><p className="font-medium text-app-primary mt-4">Drop an image here or tap to browse</p><p className="text-xs text-app-muted mt-1">JPG, PNG, or WEBP</p>{uploading && <div className="w-full max-w-xs mt-5"><div className="h-2 rounded-full bg-slate-200 overflow-hidden"><div className="gradient-bg h-full transition-all" style={{ width: `${uploadProgress}%` }} /></div><p className="text-xs text-app-muted mt-2">Uploading {uploadProgress}%</p></div>}<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} /></div><button onClick={advance} disabled={uploading} className="btn-primary mt-7">{avatarUrl ? 'Looks good' : 'Skip for now'}</button></div>}
        {step === 4 && <div className="py-8"><h1 className="text-3xl font-semibold text-app-primary">Create a username</h1><p className="text-app-muted mt-2">Enter your username!</p><div className="relative mt-8"><span className="absolute left-4 top-3 text-app-muted">@</span><input autoFocus value={username} onChange={(e) => checkUsername(e.target.value)} className="onboarding-input pl-9 w-full" placeholder="your_username" /></div><p className={`text-sm mt-3 ${usernameState === 'available' ? 'text-green-500' : usernameState === 'taken' ? 'text-red-500' : 'text-app-muted'}`}>{usernameState === 'checking' ? 'Checking availability...' : usernameState === 'available' ? 'Username is available!' : usernameState === 'taken' ? 'That username is already taken.' : '3-20 letters, numbers, or underscores'}</p><button onClick={() => usernameState === 'available' ? advance() : toast('Choose an available username first.', 'warning')} className="btn-primary mt-7">Continue</button></div>}
        {step === 5 && <div className="py-8 text-center"><h1 className="text-3xl font-semibold text-app-primary">This is how you’ll appear</h1><div className="onboarding-profile-preview mt-8"><AvatarPreview url={avatarUrl} name={`${firstName} ${lastName}`} size={96} /><h2 className="text-2xl font-semibold text-app-primary mt-4">{firstName} {lastName}</h2><p className="text-[var(--primary-color)] mt-1">@{username}</p></div><div className="flex justify-center gap-3 mt-8"><button onClick={() => setStep(2)} className="btn-ghost">Edit details</button><button onClick={advance} className="btn-primary">Continue</button></div></div>}
        {step === 6 && <TimedStep title={`Okay ${firstName || 'reader'}!`} subtitle="It's time to customize how you want your interface." button="Okay" onReady={setWelcomeReady} onNext={advance} />}
        {step === 7 && <div className="py-8"><h1 className="text-3xl font-semibold text-app-primary">Pick light or dark mode</h1><div className="grid sm:grid-cols-2 gap-4 mt-8">{(['light', 'dark'] as const).map((mode) => <button key={mode} onClick={() => setTheme({ ...theme, mode })} className={`onboarding-choice ${theme.mode === mode ? 'ring-2 ring-[var(--primary-color)]' : ''}`}><span className={`mode-preview ${mode}`} /> <span className="capitalize font-medium">{mode} mode</span></button>)}</div><button onClick={advance} className="btn-primary mt-8">Continue</button></div>}
        {step === 8 && <div className="py-8"><h1 className="text-3xl font-semibold text-app-primary">Choose your color theme</h1><p className="text-app-muted mt-2">Pick a preset or make it yours.</p><div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-8">{themes.map(([label, primary, accent]) => <button key={label} onClick={() => setTheme({ ...theme, primaryColor: primary, accentColor: accent })} className={`onboarding-theme ${theme.primaryColor === primary ? 'ring-2 ring-[var(--primary-color)]' : ''}`}><span style={{ background: primary }} /><span style={{ background: accent }} /><small>{label}</small></button>)}</div><div className="flex gap-4 mt-6"><label className="text-sm text-app-secondary">Custom primary <input type="color" value={theme.primaryColor} onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })} /></label><label className="text-sm text-app-secondary">Custom accent <input type="color" value={theme.accentColor} onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })} /></label></div><button onClick={advance} className="btn-primary mt-8">Continue</button></div>}
        {step === 9 && <div className="py-8"><h1 className="text-3xl font-semibold text-app-primary">What font do you want to use?</h1><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-7 max-h-48 overflow-y-auto">{fonts.map((font) => <button key={font.key} onClick={() => setTheme({ ...theme, fontFamily: font.key })} style={{ fontFamily: font.family }} className={`onboarding-font ${theme.fontFamily === font.key ? 'ring-2 ring-[var(--primary-color)]' : ''}`}>{font.label}</button>)}</div><textarea value={previewText} onChange={(e) => setPreviewText(e.target.value)} style={{ fontFamily: fonts.find((font) => font.key === theme.fontFamily)?.family }} className="onboarding-editor mt-6" /><button onClick={advance} className="btn-primary mt-7">Continue</button></div>}
        {step === 10 && <TimedStep delay={1000} title={`Great! You are done ${firstName || 'reader'}!`} subtitle="Your reading space is ready." button={loading ? 'Saving...' : 'Enter Dashboard'} onReady={setWelcomeReady} onNext={handleSubmit} />}
      </div>
    </div>
  );
}

function AvatarPreview({ url, name, size = 120 }: { url: string | null; name: string; size?: number }) {
  return url ? <img src={url} alt="Profile preview" className="rounded-full object-cover border-4 border-white/60" style={{ width: size, height: size }} /> : <div className="rounded-full gradient-bg flex items-center justify-center text-white font-semibold text-3xl" style={{ width: size, height: size }}>{name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'}</div>;
}

function TimedStep({ title, subtitle, button, delay = 2000, onReady, onNext }: { title: string; subtitle: string; button: string; delay?: number; onReady: (ready: boolean) => void; onNext: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => { setReady(true); onReady(true); }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, onReady]);
  return <div className="text-center py-14"><h1 className="text-4xl font-semibold gradient-text">{title}</h1><p className="text-sm text-app-secondary mt-3">{subtitle}</p>{ready && <button onClick={onNext} className="btn-primary mt-10 px-10">{button}</button>}</div>;
}
