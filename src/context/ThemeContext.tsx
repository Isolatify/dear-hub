import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { DEFAULT_THEME, type ThemeConfig } from '@/types';

interface ThemeContextValue {
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'dear-hub-theme';

function getStoredTheme(): ThemeConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_THEME, ...JSON.parse(stored) };
  } catch {
    // ignore
  }
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeConfig>(getStoredTheme);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    supabase
      .from('user_settings')
      .select('theme')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.theme) {
          const t = { ...DEFAULT_THEME, ...data.theme } as ThemeConfig;
          setThemeState(t);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
        }
        setLoading(false);
      });
  }, [user?.id]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--accent-color', theme.accentColor);
    root.dataset.animations = theme.animations ? 'on' : 'off';
    root.dataset.glass = theme.glassIntensity;
    root.dataset.font = theme.fontFamily;
    root.dataset.layout = theme.layout;
    root.dataset.mode = theme.mode;
  }, [theme]);

  const setTheme = async (newTheme: ThemeConfig) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newTheme));
    if (user) {
      await supabase
        .from('user_settings')
        .upsert({ id: user.id, theme: newTheme, updated_at: new Date().toISOString() });
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
