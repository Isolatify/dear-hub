import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { GlassCard, Badge, EmptyState } from '@/components/ui';
import { getStatusColor, getStatusLabel, formatDate, isOverdue, getDaysUntil } from '@/lib/utils';
import type { Dear, DearSubmission } from '@/types';
import {
  BookOpen, Clock, Target, TrendingUp, Flame, Award, Timer,
  ChevronRight, ChevronDown, BarChart3, Calendar, Star,
  Bookmark, BookmarkCheck, Eye, EyeOff, Zap, Trophy,
  ArrowUpRight, ArrowDownRight, Minus, Play, Pause, RotateCcw,
  CheckCircle2, Circle, AlertTriangle, Sparkles, Hash,
  MessageSquare, Bell, Settings, Search, X, GripVertical,
  PieChart, Activity, Layers, GraduationCap, PenLine,
} from 'lucide-react';

interface DearWithSubmission extends Dear {
  submission?: DearSubmission;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

interface ActivityLog {
  id: string;
  action: string;
  detail: string | null;
  created_at: string;
}

interface DashboardWidget {
  id: string;
  enabled: boolean;
  order: number;
}

interface ReadingGoal {
  target: number;
  current: number;
  period: 'weekly' | 'monthly';
}

const DAILY_QUOTES = [
  'The more that you read, the more things you will know. — Dr. Seuss',
  'Reading is to the mind what exercise is to the body. — Joseph Addison',
  'A reader lives a thousand lives before he dies. — George R.R. Martin',
  'Today a reader, tomorrow a leader. — Margaret Fuller',
  'Books are a uniquely portable magic. — Stephen King',
  'There is no friend as loyal as a book. — Ernest Hemingway',
  'Reading is the gateway skill that makes all other learning possible. — Barack Obama',
  'I have always imagined that Paradise will be a kind of library. — Jorge Luis Borges',
];

const ACHIEVEMENTS = [
  { id: 'first_submit', label: 'First Steps', desc: 'Submit your first DEAR', icon: '🎯', threshold: 1 },
  { id: 'five_submits', label: 'Bookworm', desc: 'Submit 5 DEARs', icon: '🐛', threshold: 5 },
  { id: 'ten_submits', label: 'Scholar', desc: 'Submit 10 DEARs', icon: '📚', threshold: 10 },
  { id: 'streak_3', label: 'On Fire', desc: '3-day submission streak', icon: '🔥', threshold: 3 },
  { id: 'streak_7', label: 'Unstoppable', desc: '7-day submission streak', icon: '⚡', threshold: 7 },
  { id: 'early_bird', label: 'Early Bird', desc: 'Submit before due date 3 times', icon: '🐦', threshold: 3 },
  { id: 'perfect', label: 'Perfectionist', desc: 'Get approved 5 times', icon: '✨', threshold: 5 },
  { id: 'speed_writer', label: 'Speed Writer', desc: 'Submit within 1 hour of starting', icon: '💨', threshold: 1 },
];

const FOCUS_PRESETS = [
  { label: 'Pomodoro', minutes: 25, break: 5 },
  { label: 'Short Focus', minutes: 15, break: 3 },
  { label: 'Deep Work', minutes: 50, break: 10 },
  { label: 'Quick Sprint', minutes: 10, break: 2 },
];

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'welcome', enabled: true, order: 0 },
  { id: 'stats', enabled: true, order: 1 },
  { id: 'progress', enabled: true, order: 2 },
  { id: 'quote', enabled: true, order: 3 },
  { id: 'goals', enabled: true, order: 4 },
  { id: 'streak', enabled: true, order: 5 },
  { id: 'timer', enabled: true, order: 6 },
  { id: 'dears', enabled: true, order: 7 },
  { id: 'heatmap', enabled: true, order: 8 },
  { id: 'achievements', enabled: true, order: 9 },
  { id: 'announcements', enabled: true, order: 10 },
  { id: 'activity', enabled: true, order: 11 },
  { id: 'bookmarks', enabled: true, order: 12 },
  { id: 'quicklinks', enabled: true, order: 13 },
];

const WIDGET_LABELS: Record<string, string> = {
  welcome: 'Welcome Header',
  stats: 'Quick Stats',
  progress: 'Completion Rate',
  quote: 'Daily Quote',
  goals: 'Reading Goals',
  streak: 'Submission Streak',
  timer: 'Focus Timer',
  dears: 'DEAR Assignments',
  heatmap: 'Activity Heatmap',
  achievements: 'Achievements',
  announcements: 'Announcements',
  activity: 'Recent Activity',
  bookmarks: 'Pinned DEARs',
  quicklinks: 'Quick Links',
};

export function StudentDashboard() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  // Core data
  const [dears, setDears] = useState<DearWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'drafted' | 'missed'>('all');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [onlineStudents, setOnlineStudents] = useState(0);

  // Widget system
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    try {
      const stored = localStorage.getItem('dear-hub-widgets');
      return stored ? JSON.parse(stored) : DEFAULT_WIDGETS;
    } catch { return DEFAULT_WIDGETS; }
  });
  const [editingLayout, setEditingLayout] = useState(false);

  // Goals
  const [goal, setGoal] = useState<ReadingGoal>(() => {
    try {
      const stored = localStorage.getItem('dear-hub-goal');
      return stored ? JSON.parse(stored) : { target: 5, current: 0, period: 'monthly' };
    } catch { return { target: 5, current: 0, period: 'monthly' }; }
  });

  // Streak
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  // Focus timer
  const [timerPreset, setTimerPreset] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(FOCUS_PRESETS[0].minutes * 60);
  const [onBreak, setOnBreak] = useState(false);
  const [timerCompleted, setTimerCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('dear-hub-bookmarks');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded panels
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Heatmap data (last 12 weeks)
  const [heatmapData, setHeatmapData] = useState<number[]>([]);

  const dailyQuote = DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length];

  // ── Load data ──
  useEffect(() => {
    loadDears();
    loadAnnouncements();
    loadActivity();
    loadHeatmap();

    const channel = supabase
      .channel('student-dears-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dears' }, () => loadDears())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dear_submissions' }, () => loadDears())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => loadAnnouncements())
      .subscribe();

    const presenceChannel = supabase.channel('student-presence-v2');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        setOnlineStudents(Object.keys(presenceChannel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && profile) {
          await presenceChannel.track({ user_id: profile.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  // ── Timer logic ──
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerRunning(false);
            setTimerCompleted(true);
            const preset = FOCUS_PRESETS[timerPreset];
            if (onBreak) {
              setOnBreak(false);
              return preset.minutes * 60;
            } else {
              setOnBreak(true);
              return preset.break * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, timerPreset, onBreak]);

  const loadDears = async () => {
    const { data: dearData } = await supabase
      .from('dears')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (!dearData) { setLoading(false); return; }

    const { data: subs } = await supabase
      .from('dear_submissions')
      .select('*')
      .eq('student_id', profile?.id);

    const subMap = new Map<string, DearSubmission>();
    (subs ?? []).forEach((s) => subMap.set(s.dear_id, s as DearSubmission));

    const combined = dearData.map((d) => ({
      ...(d as Dear),
      submission: subMap.get(d.id),
    }));

    setDears(combined);
    setLoading(false);

    // Update goal progress
    const submitted = combined.filter((d) => ['submitted', 'approved'].includes(d.submission?.status ?? '')).length;
    setGoal((prev) => ({ ...prev, current: submitted }));
  };

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    setAnnouncements((data ?? []) as Announcement[]);
  };

  const loadActivity = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(10);
    setRecentActivity((data ?? []) as ActivityLog[]);
  };

  const loadHeatmap = async () => {
    if (!profile) return;
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
    const { data } = await supabase
      .from('activity_logs')
      .select('created_at')
      .eq('student_id', profile.id)
      .gte('created_at', twelveWeeksAgo.toISOString());

    const dayCounts = new Map<string, number>();
    (data ?? []).forEach((log: { created_at: string }) => {
      const day = new Date(log.created_at).toDateString();
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
    });

    const heatmap: number[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      heatmap.push(dayCounts.get(d.toDateString()) ?? 0);
    }
    setHeatmapData(heatmap);
  };

  // ── Computed ──
  const stats = {
    total: dears.length,
    notStarted: dears.filter((d) => (d.submission?.status ?? 'not_started') === 'not_started').length,
    inProgress: dears.filter((d) => d.submission?.status === 'draft').length,
    submitted: dears.filter((d) => ['submitted', 'approved'].includes(d.submission?.status ?? '')).length,
    approved: dears.filter((d) => d.submission?.status === 'approved').length,
  };

  const completionRate = stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;
  const approvalRate = stats.submitted > 0 ? Math.round((stats.approved / stats.submitted) * 100) : 0;

  // Streak calculation
  useEffect(() => {
    const submittedDates = dears
      .filter((d) => d.submission?.submitted_at)
      .map((d) => new Date(d.submission!.submitted_at!).toDateString());
    const uniqueDates = [...new Set(submittedDates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let currentStreak = 0;
    let longest = 0;
    let tempStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toDateString();
      if (uniqueDates.includes(dateStr)) {
        tempStreak++;
        if (i < uniqueDates.length) currentStreak = tempStreak;
      } else {
        longest = Math.max(longest, tempStreak);
        tempStreak = 0;
      }
    }
    longest = Math.max(longest, tempStreak, currentStreak);
    setStreak(currentStreak);
    setLongestStreak(longest);
  }, [dears]);

  const filteredDears = dears.filter((d) => {
    const status = d.submission?.status ?? 'not_started';
    if (filter === 'all') return true;
    if (filter === 'upcoming') return !isOverdue(d.due_date) && status === 'not_started';
    if (filter === 'drafted') return status === 'draft';
    if (filter === 'missed') return isOverdue(d.due_date) && status === 'not_started';
    return true;
  }).filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return d.week.toLowerCase().includes(q) || d.term.toLowerCase().includes(q);
  });

  const toggleBookmark = (dearId: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(dearId)) next.delete(dearId);
      else next.add(dearId);
      localStorage.setItem('dear-hub-bookmarks', JSON.stringify([...next]));
      return next;
    });
  };

  const toggleWidget = (widgetId: string) => {
    setWidgets((prev) => {
      const next = prev.map((w) => w.id === widgetId ? { ...w, enabled: !w.enabled } : w);
      localStorage.setItem('dear-hub-widgets', JSON.stringify(next));
      return next;
    });
  };

  const resetWidgets = () => {
    setWidgets(DEFAULT_WIDGETS);
    localStorage.setItem('dear-hub-widgets', JSON.stringify(DEFAULT_WIDGETS));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => setTimerRunning(!timerRunning);
  const resetTimer = () => {
    setTimerRunning(false);
    setOnBreak(false);
    setTimerCompleted(false);
    setTimerSeconds(FOCUS_PRESETS[timerPreset].minutes * 60);
  };

  const changePreset = (index: number) => {
    setTimerPreset(index);
    setTimerRunning(false);
    setOnBreak(false);
    setTimerCompleted(false);
    setTimerSeconds(FOCUS_PRESETS[index].minutes * 60);
  };

  const layoutClass = theme.layout === 'compact' ? 'gap-3' : theme.layout === 'spacious' ? 'gap-6' : 'gap-4';

  const enabledWidgets = widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order);
  const hasWidget = (id: string) => enabledWidgets.some((w) => w.id === id);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // ── Render ──
  return (
    <div className="dashboard-page p-4 lg:p-8 max-w-7xl mx-auto">
      {/* ── Layout Editor Toggle ── */}
      <div className="flex items-center justify-end mb-4">
        <button
          onClick={() => setEditingLayout(!editingLayout)}
          className="flex items-center gap-2 text-xs text-app-muted hover:text-app-primary transition px-3 py-1.5 rounded-lg glass"
        >
          <Settings size={14} />
          {editingLayout ? 'Done' : 'Customize Layout'}
        </button>
      </div>

      {/* ── Layout Editor Panel ── */}
      {editingLayout && (
        <GlassCard className="p-5 mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-app-primary">Dashboard Widgets</h3>
            <button onClick={resetWidgets} className="text-xs text-app-muted hover:text-app-primary">Reset to default</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {widgets.map((widget) => (
              <button
                key={widget.id}
                onClick={() => toggleWidget(widget.id)}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition ${
                  widget.enabled
                    ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/30'
                    : 'glass text-app-muted'
                }`}
              >
                {widget.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                {WIDGET_LABELS[widget.id]}
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* ═══ WELCOME HEADER ═══ */}
      {hasWidget('welcome') && (
        <div className="mb-8 animate-fade-in flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-app-primary">
              {getGreeting()}, {profile?.first_name}!
            </h1>
            <p className="text-app-secondary mt-1">
              {stats.notStarted > 0
                ? `You have ${stats.notStarted} assignment${stats.notStarted > 1 ? 's' : ''} waiting.`
                : stats.inProgress > 0
                ? `Keep going! You have ${stats.inProgress} in progress.`
                : 'All caught up! Great work.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-app-secondary">{onlineStudents} online</span>
            </div>
            {streak > 0 && (
              <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2">
                <Flame size={16} className="text-orange-500" />
                <span className="text-sm font-semibold text-app-primary">{streak} day streak</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ STATS ═══ */}
      {hasWidget('stats') && (
        <div className={`dashboard-stats grid grid-cols-2 lg:grid-cols-5 ${layoutClass} mb-6`}>
          {[
            { label: 'Total DEARs', value: stats.total, color: 'text-app-primary', icon: <Layers size={16} /> },
            { label: 'Not Started', value: stats.notStarted, color: 'text-red-500', icon: <Circle size={16} /> },
            { label: 'In Progress', value: stats.inProgress, color: 'text-amber-500', icon: <PenLine size={16} /> },
            { label: 'Submitted', value: stats.submitted, color: 'text-blue-500', icon: <CheckCircle2 size={16} /> },
            { label: 'Approved', value: stats.approved, color: 'text-green-500', icon: <Award size={16} /> },
          ].map((stat, i) => (
            <GlassCard key={stat.label} className="p-4 animate-slide-up">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-app-muted">{stat.label}</p>
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </GlassCard>
          ))}
        </div>
      )}

      {/* ═══ PROGRESS + QUOTE + STREAK ═══ */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 ${layoutClass} mb-6`}>
        {/* Progress */}
        {hasWidget('progress') && (
          <GlassCard className="p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-app-primary">Completion Rate</h3>
              <span className="text-lg font-bold gradient-text">{completionRate}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-200/50 dark:bg-slate-700/50 overflow-hidden">
              <div className="h-full gradient-bg rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-app-muted">{stats.submitted} of {stats.total} completed</p>
              {approvalRate > 0 && (
                <p className="text-xs text-green-500">{approvalRate}% approval</p>
              )}
            </div>

            {/* Mini bar chart */}
            <div className="mt-4 flex items-end gap-1 h-12">
              {['notStarted', 'inProgress', 'submitted', 'approved'].map((key, i) => {
                const val = stats[key as keyof typeof stats] as number;
                const max = Math.max(stats.total, 1);
                const heights = ['bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-green-400'];
                return (
                  <div key={key} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t ${heights[i]} transition-all duration-500`}
                      style={{ height: `${(val / max) * 48}px`, minHeight: val > 0 ? '4px' : '0px' }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-1">
              {['Red', 'Yellow', 'Blue', 'Green'].map((c) => (
                <span key={c} className="flex-1 text-center text-[9px] text-app-muted">{c}</span>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Quote */}
        {hasWidget('quote') && (
          <GlassCard className="p-5 animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={18} className="text-[var(--primary-color)]" />
              <h3 className="text-sm font-semibold text-app-primary">Daily Quote</h3>
            </div>
            <p className="text-sm text-app-secondary italic leading-relaxed">{dailyQuote}</p>
            <div className="mt-3 pt-3 border-t border-slate-200/30 dark:border-slate-700/30">
              <p className="text-[10px] text-app-muted uppercase tracking-wider">Today's Date</p>
              <p className="text-xs text-app-secondary font-medium">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
          </GlassCard>
        )}

        {/* Streak */}
        {hasWidget('streak') && (
          <GlassCard className="p-5 animate-slide-up">
            <div className="flex items-center gap-2 mb-3">
              <Flame size={18} className="text-orange-500" />
              <h3 className="text-sm font-semibold text-app-primary">Submission Streak</h3>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div>
                <p className="text-3xl font-bold text-app-primary">{streak}</p>
                <p className="text-xs text-app-muted">Current</p>
              </div>
              <div className="w-px h-8 bg-slate-200/50 dark:bg-slate-700/50" />
              <div>
                <p className="text-3xl font-bold text-app-muted">{longestStreak}</p>
                <p className="text-xs text-app-muted">Longest</p>
              </div>
            </div>
            {/* Mini streak dots */}
            <div className="flex gap-1">
              {Array.from({ length: 14 }).map((_, i) => {
                const isActive = i < streak;
                return (
                  <div
                    key={i}
                    className={`w-3 h-3 rounded-full transition-all ${
                      isActive ? 'gradient-bg' : 'bg-slate-200/50 dark:bg-slate-700/50'
                    }`}
                  />
                );
              })}
            </div>
            <p className="text-[10px] text-app-muted mt-2">Last 14 days</p>
          </GlassCard>
        )}
      </div>

      {/* ═══ GOALS + TIMER ═══ */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${layoutClass} mb-6`}>
        {/* Goals */}
        {hasWidget('goals') && (
          <GlassCard className="p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-[var(--primary-color)]" />
                <h3 className="text-sm font-semibold text-app-primary">Reading Goal</h3>
              </div>
              <button
                onClick={() => {
                  const newTarget = prompt('Set your monthly target (number of DEARs):', String(goal.target));
                  if (newTarget && !isNaN(Number(newTarget)) && Number(newTarget) > 0) {
                    const newGoal = { ...goal, target: Number(newTarget) };
                    setGoal(newGoal);
                    localStorage.setItem('dear-hub-goal', JSON.stringify(newGoal));
                  }
                }}
                className="text-xs text-[var(--primary-color)] hover:underline"
              >
                Edit
              </button>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-200/50 dark:text-slate-700/50" />
                  <circle
                    cx="40" cy="40" r="35" fill="none" stroke="var(--primary-color)" strokeWidth="6"
                    strokeDasharray={`${(Math.min(goal.current / Math.max(goal.target, 1), 1)) * 220} 220`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-app-primary">{Math.min(goal.current, goal.target)}/{goal.target}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-app-secondary">
                  {goal.current >= goal.target
                    ? '🎉 Goal reached!'
                    : `${goal.target - goal.current} more to go`}
                </p>
                <p className="text-xs text-app-muted mt-1">{goal.period} target</p>
                <div className="flex gap-1 mt-2">
                  {(['weekly', 'monthly'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        const newGoal = { ...goal, period: p };
                        setGoal(newGoal);
                        localStorage.setItem('dear-hub-goal', JSON.stringify(newGoal));
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded-full capitalize transition ${
                        goal.period === p ? 'bg-[var(--primary-color)] text-white' : 'glass text-app-muted'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Focus Timer */}
        {hasWidget('timer') && (
          <GlassCard className="p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Timer size={18} className="text-[var(--primary-color)]" />
                <h3 className="text-sm font-semibold text-app-primary">Focus Timer</h3>
              </div>
              {onBreak && <Badge color="green">Break Time</Badge>}
            </div>

            {/* Preset selector */}
            <div className="flex gap-1.5 mb-4">
              {FOCUS_PRESETS.map((preset, i) => (
                <button
                  key={preset.label}
                  onClick={() => changePreset(i)}
                  className={`text-[10px] px-2 py-1 rounded-lg transition ${
                    timerPreset === i ? 'bg-[var(--primary-color)] text-white' : 'glass text-app-muted hover:text-app-primary'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Timer display */}
            <div className="flex items-center justify-center mb-4">
              <div className={`text-5xl font-mono font-bold ${onBreak ? 'text-green-500' : 'text-app-primary'} ${timerCompleted ? 'animate-pulse' : ''}`}>
                {formatTime(timerSeconds)}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button onClick={toggleTimer} className="btn-primary w-12 h-12 rounded-full flex items-center justify-center">
                {timerRunning ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button onClick={resetTimer} className="w-10 h-10 rounded-full glass flex items-center justify-center text-app-secondary hover:text-app-primary transition">
                <RotateCcw size={16} />
              </button>
            </div>

            {timerCompleted && (
              <p className="text-xs text-center text-green-500 mt-3 font-medium">
                {onBreak ? 'Break over! Time to focus.' : 'Great focus session! Take a break.'}
              </p>
            )}
          </GlassCard>
        )}
      </div>

      {/* ═══ HEATMAP ═══ */}
      {hasWidget('heatmap') && (
        <GlassCard className="p-5 mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-[var(--primary-color)]" />
              <h3 className="text-sm font-semibold text-app-primary">Activity Heatmap</h3>
            </div>
            <span className="text-xs text-app-muted">{heatmapData.filter((v) => v > 0).length} active days</span>
          </div>
          <div className="flex gap-[3px] overflow-x-auto pb-1">
            {heatmapData.map((count, i) => {
              const intensity = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3;
              const colors = [
                'bg-slate-200/40 dark:bg-slate-700/40',
                'bg-[var(--primary-color)]/20',
                'bg-[var(--primary-color)]/50',
                'bg-[var(--primary-color)]',
              ];
              return (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-[3px] shrink-0 ${colors[intensity]} transition-colors`}
                  title={`${count} activities`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-1 mt-2 justify-end">
            <span className="text-[9px] text-app-muted">Less</span>
            {[0, 1, 2, 3].map((level) => (
              <div key={level} className={`w-3 h-3 rounded-[3px] ${
                level === 0 ? 'bg-slate-200/40 dark:bg-slate-700/40' :
                level === 1 ? 'bg-[var(--primary-color)]/20' :
                level === 2 ? 'bg-[var(--primary-color)]/50' : 'bg-[var(--primary-color)]'
              }`} />
            ))}
            <span className="text-[9px] text-app-muted">More</span>
          </div>
        </GlassCard>
      )}

      {/* ═══ MAIN CONTENT ═══ */}
      <div className={`dashboard-main grid grid-cols-1 lg:grid-cols-3 ${layoutClass}`}>
        {/* DEAR Assignments */}
        <div className="lg:col-span-2">
          {hasWidget('dears') && (
            <>
              {/* Search + Filter tabs */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
                  <input
                    type="text"
                    placeholder="Search DEARs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="glass-input rounded-xl w-full pl-8 pr-8 py-2 text-sm"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-primary">
                      <X size={12} />
                    </button>
                  )}
                </div>
                {([
                  { key: 'all', label: 'All', count: stats.total },
                  { key: 'upcoming', label: 'Upcoming', count: stats.notStarted },
                  { key: 'drafted', label: 'In Progress', count: stats.inProgress },
                  { key: 'missed', label: 'Missed', count: dears.filter((d) => isOverdue(d.due_date) && (d.submission?.status ?? 'not_started') === 'not_started').length },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition whitespace-nowrap ${
                      filter === tab.key ? 'glass text-[var(--primary-color)]' : 'text-app-secondary hover:opacity-80'
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1 opacity-60">{tab.count}</span>
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="border-2 border-slate-200 dark:border-slate-600 border-t-[var(--primary-color)] rounded-full animate-spin w-8 h-8" />
                </div>
              ) : filteredDears.length === 0 ? (
                <EmptyState
                  icon={<BookOpen size={48} />}
                  title="No DEARs here yet"
                  subtitle="Your assignments will appear in this category."
                />
              ) : (
                <div className={`assignment-grid grid gap-4 ${theme.layout === 'grid' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  {filteredDears.map((dear, i) => {
                    const status = dear.submission?.status ?? 'not_started';
                    const color = getStatusColor(status);
                    const overdue = isOverdue(dear.due_date) && status === 'not_started';
                    const days = getDaysUntil(dear.due_date);
                    const isBookmarked = bookmarks.has(dear.id);

                    return (
                      <GlassCard key={dear.id} hover className="p-5 animate-slide-up" style={{ animationDelay: `${i * 30}ms` } as React.CSSProperties}>
                        <div className="flex items-start gap-4">
                          {/* Bookmark */}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleBookmark(dear.id); }}
                            className="mt-1 shrink-0 text-app-muted hover:text-[var(--primary-color)] transition"
                          >
                            {isBookmarked ? <BookmarkCheck size={18} className="text-[var(--primary-color)]" /> : <Bookmark size={18} />}
                          </button>

                          <div className="flex-1 min-w-0" onClick={() => navigate(`/dear/${dear.id}`)}>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`status-dot status-${color}`} />
                              <Badge color={color}>{getStatusLabel(status)}</Badge>
                              {overdue && <Badge color="red">Overdue</Badge>}
                              {!overdue && days >= 0 && days <= 3 && (
                                <span className="text-[10px] text-amber-500 font-medium">
                                  {days === 0 ? 'Due today!' : `${days}d left`}
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-app-primary">{dear.week} — {dear.term}</h3>
                            <p className="text-sm text-app-muted">Due {formatDate(dear.due_date)}</p>

                            {dear.submission?.feedback && (
                              <div className="glass-input rounded-xl p-3 mt-2">
                                <p className="text-xs text-app-muted mb-1">Teacher Feedback</p>
                                <p className="text-sm text-app-secondary line-clamp-2">{dear.submission.feedback}</p>
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-3">
                              <span className="text-xs text-app-muted">
                                {status === 'not_started' ? 'Tap to start' : status === 'draft' ? 'Continue working' : 'View submission'}
                              </span>
                              <ChevronRight size={16} className="text-[var(--primary-color)]" />
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Achievements */}
          {hasWidget('achievements') && (
            <GlassCard className="p-5 mt-6 animate-slide-up">
              <div className="flex items-center gap-2 mb-4">
                <Trophy size={18} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-app-primary">Achievements</h3>
                <span className="text-xs text-app-muted ml-auto">
                  {ACHIEVEMENTS.filter((a) => stats.submitted >= a.threshold).length}/{ACHIEVEMENTS.length} unlocked
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ACHIEVEMENTS.map((achievement) => {
                  const unlocked = stats.submitted >= achievement.threshold;
                  return (
                    <div
                      key={achievement.id}
                      className={`p-3 rounded-xl text-center transition ${
                        unlocked
                          ? 'bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/30'
                          : 'glass opacity-50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{achievement.icon}</div>
                      <p className="text-xs font-semibold text-app-primary">{achievement.label}</p>
                      <p className="text-[10px] text-app-muted mt-0.5">{achievement.desc}</p>
                      {unlocked && <Badge color="green" className="mt-1 text-[8px]">Unlocked</Badge>}
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          {/* Announcements */}
          {hasWidget('announcements') && (
            <GlassCard className="p-5 animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-app-primary">Announcements</h3>
                <button onClick={() => navigate('/announcements')} className="text-xs text-[var(--primary-color)] hover:underline">
                  View all
                </button>
              </div>
              {announcements.length === 0 ? (
                <p className="text-sm text-app-muted py-4 text-center">No announcements yet.</p>
              ) : (
                <div className="space-y-2">
                  {announcements.map((a) => (
                    <div key={a.id} className="glass-input rounded-xl p-3 cursor-pointer hover:bg-white/20 dark:hover:bg-white/5 transition" onClick={() => navigate('/announcements')}>
                      <p className="text-sm font-medium text-app-primary line-clamp-1">{a.title}</p>
                      <p className="text-xs text-app-muted mt-1 line-clamp-2">{a.body}</p>
                      <p className="text-[10px] text-app-muted mt-1">{formatDate(a.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          )}

          {/* Activity */}
          {hasWidget('activity') && (
            <GlassCard className="p-5 animate-slide-up">
              <h3 className="text-sm font-semibold text-app-primary mb-3">Recent Activity</h3>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-app-muted py-4 text-center">No activity yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentActivity.slice(0, 6).map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full gradient-bg mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-app-secondary line-clamp-1">{formatActivityAction(log.action, log.detail)}</p>
                        <p className="text-[10px] text-app-muted">{formatDate(log.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          )}

          {/* Bookmarks */}
          {hasWidget('bookmarks') && (
            <GlassCard className="p-5 animate-slide-up">
              <div className="flex items-center gap-2 mb-3">
                <Bookmark size={16} className="text-[var(--primary-color)]" />
                <h3 className="text-sm font-semibold text-app-primary">Pinned DEARs</h3>
              </div>
              {bookmarks.size === 0 ? (
                <p className="text-sm text-app-muted py-4 text-center">Pin DEARs to find them quickly.</p>
              ) : (
                <div className="space-y-2">
                  {dears.filter((d) => bookmarks.has(d.id)).map((dear) => {
                    const status = dear.submission?.status ?? 'not_started';
                    const color = getStatusColor(status);
                    return (
                      <button
                        key={dear.id}
                        onClick={() => navigate(`/dear/${dear.id}`)}
                        className="w-full flex items-center gap-2 glass-input rounded-xl p-2.5 text-left hover:bg-white/20 dark:hover:bg-white/5 transition"
                      >
                        <span className={`status-dot status-${color} shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-app-primary truncate">{dear.week}</p>
                          <p className="text-[10px] text-app-muted">{getStatusLabel(status)}</p>
                        </div>
                        <ChevronRight size={12} className="text-app-muted shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          )}

          {/* Quick Links */}
          {hasWidget('quicklinks') && (
            <GlassCard className="p-5 animate-slide-up">
              <h3 className="text-sm font-semibold text-app-primary mb-3">Quick Links</h3>
              <div className="space-y-2">
                {[
                  { label: 'Messages', icon: <MessageSquare size={16} />, path: '/messages' },
                  { label: 'Announcements', icon: <Bell size={16} />, path: '/announcements' },
                  { label: 'Settings', icon: <Settings size={16} />, path: '/settings' },
                  { label: 'Feedback', icon: <Sparkles size={16} />, path: '/feedback' },
                ].map((link) => (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl glass-input text-sm text-app-secondary hover:text-app-primary transition"
                  >
                    {link.icon}
                    {link.label}
                  </button>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

function formatActivityAction(action: string, detail: string | null): string {
  switch (action) {
    case 'submitted_dear': return `Submitted ${detail ?? 'DEAR'}`;
    case 'started_dear': return `Started ${detail ?? 'DEAR'}`;
    case 'opened_dear': return `Opened ${detail ?? 'DEAR'}`;
    default: return action.replace(/_/g, ' ');
  }
}
