import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'dear-hub-onboarding';

interface OnboardingState {
  step: number;
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl: string | null;
}

function loadState(): OnboardingState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveState(state: OnboardingState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

function clearState() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export function OnboardingScreen() {
  const { user, completeOnboarding } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const saved = loadState();
  const [step, setStep] = useState(saved?.step ?? 1);
  const [firstName, setFirstName] = useState(saved?.firstName ?? '');
  const [lastName, setLastName] = useState(saved?.lastName ?? '');
  const [username, setUsername] = useState(saved?.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(saved?.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [previewText, setPreviewText] = useState('Reading opens a new window into the world.');
  const [welcomeReady, setWelcomeReady] = useState(false);

  // Crop state
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [cropImg, setCropImg] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [cropDragging, setCropDragging] = useState(false);
  const cropDragStart = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);

  // Persist state
  useEffect(() => {
    saveState({ step, firstName, lastName, username, avatarUrl });
  }, [step, firstName, lastName, username, avatarUrl]);

  useEffect(() => {
    if (step !== 1) return;
    const timer = window.setTimeout(() => setWelcomeReady(true), 2000);
    return () => window.clearTimeout(timer);
  }, [step]);

  const fonts = [
    { key: 'poppins' as const, label: 'Poppins', family: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" },
    { key: 'sfpro' as const, label: 'SF Pro', family: "'SF Pro Display', 'SF Pro', -apple-system, BlinkMacSystemFont, sans-serif" },
    { key: 'inter' as const, label: 'Inter', family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" },
    { key: 'roboto' as const, label: 'Roboto', family: "'Roboto', 'Helvetica Neue', Arial, sans-serif" },
    { key: 'montserrat' as const, label: 'Montserrat', family: "'Montserrat', 'Helvetica Neue', Arial, sans-serif" },
    { key: 'raleway' as const, label: 'Raleway', family: "'Raleway', 'Helvetica Neue', Arial, sans-serif" },
    { key: 'nunito' as const, label: 'Nunito', family: "'Nunito', 'Helvetica Neue', Arial, sans-serif" },
    { key: 'lora' as const, label: 'Lora', family: "'Lora', Georgia, 'Times New Roman', serif" },
    { key: 'playfair' as const, label: 'Playfair', family: "'Playfair Display', Georgia, 'Times New Roman', serif" },
    { key: 'sourceSans' as const, label: 'Source Sans', family: "'Source Sans 3', 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif" },
    { key: 'dmSans' as const, label: 'DM Sans', family: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif" },
    { key: 'spaceGrotesk' as const, label: 'Space Grotesk', family: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif" },
    { key: 'manrope' as const, label: 'Manrope', family: "'Manrope', 'Helvetica Neue', Arial, sans-serif" },
  ];

  const themes = [
    { label: 'Dear Blue', primary: '#6096B7', accent: '#8BB4D8' },
    { label: 'Ocean', primary: '#3b82f6', accent: '#06b6d4' },
    { label: 'Emerald', primary: '#10b981', accent: '#14b8a6' },
    { label: 'Sunset', primary: '#f97316', accent: '#f43f5e' },
    { label: 'Royal', primary: '#2563eb', accent: '#7c3aed' },
    { label: 'Rose', primary: '#ec4899', accent: '#f43f5e' },
    { label: 'Forest', primary: '#16a34a', accent: '#65a30d' },
    { label: 'Slate', primary: '#475569', accent: '#0ea5e9' },
    { label: 'Fire', primary: '#ef4444', accent: '#f59e0b' },
    { label: 'Midnight', primary: '#1e293b', accent: '#6366f1' },
    { label: 'Mint', primary: '#34d399', accent: '#22d3ee' },
    { label: 'Lavender', primary: '#a78bfa', accent: '#f0abfc' },
  ];

  const advance = () => setStep((current) => Math.min(10, current + 1));

  // ── Crop helpers ──
  const openCrop = (file: File) => {
    setCropFile(file);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    const reader = new FileReader();
    reader.onload = () => setCropImg(reader.result as string);
    reader.readAsDataURL(file);
    setCropOpen(true);
  };

  const onCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setCropDragging(true);
    cropDragStart.current = { x: e.clientX, y: e.clientY, offsetX: cropOffset.x, offsetY: cropOffset.y };
  };

  const onCropMouseMove = useCallback((e: MouseEvent) => {
    if (!cropDragging) return;
    const dx = e.clientX - cropDragStart.current.x;
    const dy = e.clientY - cropDragStart.current.y;
    setCropOffset({ x: cropDragStart.current.offsetX + dx, y: cropDragStart.current.offsetY + dy });
  }, [cropDragging]);

  const onCropMouseUp = useCallback(() => setCropDragging(false), []);

  useEffect(() => {
    if (cropOpen) {
      window.addEventListener('mousemove', onCropMouseMove);
      window.addEventListener('mouseup', onCropMouseUp);
      return () => {
        window.removeEventListener('mousemove', onCropMouseMove);
        window.removeEventListener('mouseup', onCropMouseUp);
      };
    }
  }, [cropOpen, onCropMouseMove, onCropMouseUp]);

  const applyCrop = async () => {
    if (!cropImg || !cropFile || !cropContainerRef.current) return;
    const img = new Image();
    img.src = cropImg;
    await new Promise((r) => { img.onload = r; });

    const canvas = cropCanvasRef.current!;
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d')!;

    const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
    const srcX = Math.max(0, (img.naturalWidth - srcSize) / 2);
    const srcY = Math.max(0, (img.naturalHeight - srcSize) / 2);

    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, 400, 400);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
    });

    const croppedFile = new File([blob], cropFile.name, { type: 'image/jpeg' });
    setCropOpen(false);
    setCropImg(null);
    setCropFile(null);
    await uploadAvatar(croppedFile);
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    setUploadProgress(15);
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/avatar.${ext}`;
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
    if (file) openCrop(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const checkUsername = useCallback((value: string) => {
    const normalized = value.trim().toLowerCase();
    setUsername(normalized);

    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(normalized)) {
      setUsernameState('idle');
      return;
    }

    setUsernameState('checking');
    usernameTimerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', normalized)
        .maybeSingle();
      setUsernameState(data ? 'taken' : 'available');
    }, 400);
  }, []);

  useEffect(() => {
    return () => {
      if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    };
  }, []);

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
      clearState();
      toast('Profile created! Welcome to DEAR Hub.', 'success');
      navigate('/dashboard', { replace: true });
    }
    setLoading(false);
  };

  const modeOptions = [
    {
      mode: 'light' as const,
      label: 'Light mode',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ),
    },
    {
      mode: 'dark' as const,
      label: 'Dark mode',
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="onboarding-shell min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="onboarding-blob onboarding-blob-one" />
      <div className="onboarding-blob onboarding-blob-two" />
      <div className="onboarding-blob onboarding-blob-three" />
      <div className="glass rounded-3xl p-6 sm:p-8 w-full max-w-2xl relative z-10 animate-scale-in">
        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-7">
          <span className="text-xs text-app-muted font-medium">STEP {step} OF 10</span>
          <div className="flex gap-1.5">
            {Array.from({ length: 10 }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 w-6 rounded-full transition-all duration-500 ${
                  index < step ? 'gradient-bg' : 'bg-slate-200/70 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1 - Welcome */}
        {step === 1 && (
          <div key="step-1" className="text-center py-10 onboarding-step-animate">
            <div className="onboarding-step-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#grad1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <defs><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="var(--primary-color)" /><stop offset="100%" stopColor="var(--accent-color)" /></linearGradient></defs>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <h1 className="text-4xl font-semibold gradient-text mt-6">Welcome to DEAR Hub</h1>
            <p className="text-sm text-app-secondary mt-3">
              Let's create your account so that we can get started!
            </p>
            {welcomeReady ? (
              <button onClick={advance} className="btn-primary mt-10 px-10">Start</button>
            ) : (
              <div className="mt-10 flex items-center justify-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary-color)] animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary-color)] animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="h-1.5 w-1.5 rounded-full bg-[var(--primary-color)] animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
          </div>
        )}

        {/* Step 2 - Name */}
        {step === 2 && (
          <div key="step-2" className="py-8 onboarding-step-animate">
            <h1 className="text-3xl font-semibold text-app-primary">What is your first & last name?</h1>
            <p className="text-app-muted mt-2">
              Your name helps your classmates and teacher recognize you.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mt-8">
              <input
                autoFocus
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="onboarding-input"
                placeholder="First name"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="onboarding-input"
                placeholder="Last name"
              />
            </div>
            <button
              onClick={() => (firstName && lastName ? advance() : toast('Please enter both names.', 'warning'))}
              className="btn-primary mt-8"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 3 - Avatar */}
        {step === 3 && (
          <div key="step-3" className="py-8 onboarding-step-animate">
            <h1 className="text-3xl font-semibold text-app-primary">Upload your Profile Picture</h1>
            <p className="text-app-muted mt-2">
              How do you want to show yourself to your classmates?
            </p>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) openCrop(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className="onboarding-dropzone mt-8"
            >
              <AvatarPreview url={avatarUrl} name={`${firstName} ${lastName}`} />
              <p className="font-medium text-app-primary mt-4">Drop an image here or tap to browse</p>
              <p className="text-xs text-app-muted mt-1">JPG, PNG, or WEBP</p>
              {uploading && (
                <div className="w-full max-w-xs mt-5">
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="gradient-bg h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-app-muted mt-2">Uploading {uploadProgress}%</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <button onClick={advance} disabled={uploading} className="btn-primary mt-7">
              {avatarUrl ? 'Looks good' : 'Skip for now'}
            </button>
          </div>
        )}

        {/* Step 4 - Username */}
        {step === 4 && (
          <div key="step-4" className="py-8 onboarding-step-animate">
            <h1 className="text-3xl font-semibold text-app-primary">Create a username</h1>
            <p className="text-app-muted mt-2">
              This is how others will find you on DEAR Hub.
            </p>
            <div className="relative mt-8">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted text-lg font-medium">@</span>
              <input
                autoFocus
                value={username}
                onChange={(e) => checkUsername(e.target.value)}
                className="onboarding-input pl-10 w-full pr-12"
                placeholder="your_username"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2">
                {usernameState === 'checking' && (
                  <div className="username-spinner" />
                )}
                {usernameState === 'available' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="onboarding-status-icon">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
                {usernameState === 'taken' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="onboarding-status-icon">
                    <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                )}
              </span>
            </div>
            <div className="mt-3">
              <p className={`text-sm font-medium ${
                usernameState === 'available' ? 'text-green-500' :
                usernameState === 'taken' ? 'text-red-500' :
                'text-app-muted'
              }`}>
                {usernameState === 'checking'
                  ? 'Checking availability...'
                  : usernameState === 'available'
                  ? 'Username is available!'
                  : usernameState === 'taken'
                  ? 'That username is already taken.'
                  : '3-20 letters, numbers, or underscores'}
              </p>
              {username && !/^[a-zA-Z0-9_]{3,20}$/.test(username) && usernameState === 'idle' && (
                <p className="text-xs text-amber-500 mt-1">Only letters, numbers, and underscores allowed</p>
              )}
            </div>
            <button
              onClick={() =>
                usernameState === 'available'
                  ? advance()
                  : toast('Choose an available username first.', 'warning')
              }
              className="btn-primary mt-7"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 5 - Profile Preview */}
        {step === 5 && (
          <div key="step-5" className="py-8 text-center onboarding-step-animate">
            <h1 className="text-3xl font-semibold text-app-primary">This is how you'll appear</h1>
            <div className="onboarding-profile-preview mt-8">
              <AvatarPreview url={avatarUrl} name={`${firstName} ${lastName}`} size={96} />
              <h2 className="text-2xl font-semibold text-app-primary mt-4">{firstName} {lastName}</h2>
              <p className="text-[var(--primary-color)] mt-1 font-medium">@{username}</p>
            </div>
            <div className="flex justify-center gap-3 mt-8">
              <button onClick={() => setStep(2)} className="btn-ghost">
                Edit details
              </button>
              <button onClick={advance} className="btn-primary">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 6 - Personalization Intro */}
        {step === 6 && (
          <TimedStep
            key="step-6"
            title={`Okay ${firstName || 'reader'}!`}
            subtitle="It's time to customize how you want your interface."
            button="Okay"
            onReady={setWelcomeReady}
            onNext={advance}
          />
        )}

        {/* Step 7 - Theme Mode */}
        {step === 7 && (
          <div key="step-7" className="py-8 onboarding-step-animate">
            <h1 className="text-3xl font-semibold text-app-primary">Pick light or dark mode</h1>
            <p className="text-app-muted mt-2">
              You can change this anytime in settings.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mt-8">
              {modeOptions.map((opt) => (
                <button
                  key={opt.mode}
                  onClick={() => setTheme({ ...theme, mode: opt.mode })}
                  className={`onboarding-choice onboarding-mode-card ${
                    theme.mode === opt.mode ? 'onboarding-choice-active' : ''
                  }`}
                >
                  <div className={`onboarding-mode-icon ${theme.mode === opt.mode ? 'active' : ''}`}>
                    {opt.icon}
                  </div>
                  <span className="font-medium text-app-primary">{opt.label}</span>
                  <span className="text-xs text-app-muted">
                    {opt.mode === 'light' ? 'Bright & clean' : 'Easy on the eyes'}
                  </span>
                </button>
              ))}
            </div>
            <button onClick={advance} className="btn-primary mt-8">
              Continue
            </button>
          </div>
        )}

        {/* Step 8 - Color Theme */}
        {step === 8 && (
          <div key="step-8" className="py-8 onboarding-step-animate">
            <h1 className="text-3xl font-semibold text-app-primary">Choose your color theme</h1>
            <p className="text-app-muted mt-2">
              Pick a preset or make it yours.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-8">
              {themes.map((t) => (
                <button
                  key={t.label}
                  onClick={() => setTheme({ ...theme, primaryColor: t.primary, accentColor: t.accent })}
                  className={`onboarding-theme-card ${
                    theme.primaryColor === t.primary ? 'onboarding-theme-active' : ''
                  }`}
                >
                  <div
                    className="onboarding-theme-preview"
                    style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.accent})` }}
                  >
                    {theme.primaryColor === t.primary && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="onboarding-theme-check">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <small className="text-app-secondary">{t.label}</small>
                </button>
              ))}
            </div>
            <div className="flex gap-4 mt-6">
              <label className="text-sm text-app-secondary flex items-center gap-2">
                Custom primary
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                  className="w-7 h-7 rounded cursor-pointer border-0"
                />
              </label>
              <label className="text-sm text-app-secondary flex items-center gap-2">
                Custom accent
                <input
                  type="color"
                  value={theme.accentColor}
                  onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })}
                  className="w-7 h-7 rounded cursor-pointer border-0"
                />
              </label>
            </div>
            <button onClick={advance} className="btn-primary mt-8">
              Continue
            </button>
          </div>
        )}

        {/* Step 9 - Font */}
        {step === 9 && (
          <div key="step-9" className="py-8 onboarding-step-animate">
            <h1 className="text-3xl font-semibold text-app-primary">What font do you want to use?</h1>
            <p className="text-app-muted mt-2">
              Preview each font below and pick your favorite.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-7 max-h-52 overflow-y-auto pr-1">
              {fonts.map((font) => (
                <button
                  key={font.key}
                  onClick={() => setTheme({ ...theme, fontFamily: font.key })}
                  style={{ fontFamily: font.family }}
                  className={`onboarding-font ${
                    theme.fontFamily === font.key ? 'onboarding-font-active' : ''
                  }`}
                  title={font.label}
                >
                  {font.label}
                </button>
              ))}
            </div>
            <textarea
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              style={{ fontFamily: fonts.find((f) => f.key === theme.fontFamily)?.family }}
              className="onboarding-editor mt-6"
              placeholder="Type here to preview your font..."
            />
            <button onClick={advance} className="btn-primary mt-7">
              Continue
            </button>
          </div>
        )}

        {/* Step 10 - Done */}
        {step === 10 && (
          <TimedStep
            key="step-10"
            delay={1000}
            title={`Great! You are done ${firstName || 'reader'}!`}
            subtitle="Your reading space is ready."
            button={loading ? 'Saving...' : 'Enter Dashboard'}
            onReady={setWelcomeReady}
            onNext={handleSubmit}
          />
        )}
      </div>

      {/* ── Crop Modal ── */}
      {cropOpen && (
        <div className="crop-overlay" onClick={() => { setCropOpen(false); setCropImg(null); }}>
          <div className="crop-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-semibold text-app-primary mb-1">Adjust your photo</h2>
            <p className="text-sm text-app-muted mb-4">Drag to reposition, use the slider to zoom</p>
            <div className="crop-viewport" ref={cropContainerRef}>
              {cropImg && (
                <img
                  src={cropImg}
                  alt="Crop preview"
                  className="crop-image"
                  draggable={false}
                  style={{
                    transform: `scale(${cropZoom}) translate(${cropOffset.x / cropZoom}px, ${cropOffset.y / cropZoom}px)`,
                    cursor: cropDragging ? 'grabbing' : 'grab',
                  }}
                  onMouseDown={onCropMouseDown}
                />
              )}
              <div className="crop-circle" />
            </div>
            <div className="flex items-center gap-3 mt-4 w-full max-w-xs mx-auto">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={cropZoom}
                onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                className="crop-slider flex-1"
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setCropOpen(false); setCropImg(null); }} className="btn-ghost px-6">
                Cancel
              </button>
              <button onClick={applyCrop} className="btn-primary px-6">
                Use this photo
              </button>
            </div>
          </div>
          <canvas ref={cropCanvasRef} className="hidden" />
        </div>
      )}
    </div>
  );
}

function AvatarPreview({ url, name, size = 120 }: { url: string | null; name: string; size?: number }) {
  return url ? (
    <img
      src={url}
      alt="Profile preview"
      className="rounded-full object-cover border-4 border-white/60"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full gradient-bg flex items-center justify-center text-white font-semibold text-3xl"
      style={{ width: size, height: size }}
    >
      {name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || '?'}
    </div>
  );
}

function TimedStep({
  title,
  subtitle,
  button,
  delay = 2000,
  onReady,
  onNext,
}: {
  title: string;
  subtitle: string;
  button: string;
  delay?: number;
  onReady: (ready: boolean) => void;
  onNext: () => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReady(true);
      onReady(true);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, onReady]);
  return (
    <div className="text-center py-14 onboarding-step-animate">
      <h1 className="text-4xl font-semibold gradient-text">{title}</h1>
      <p className="text-sm text-app-secondary mt-3">
        {subtitle}
      </p>
      {ready && (
        <button onClick={onNext} className="btn-primary mt-10 px-10">
          {button}
        </button>
      )}
    </div>
  );
}
