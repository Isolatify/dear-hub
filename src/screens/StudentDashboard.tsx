import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { GlassCard, Badge, EmptyState } from '@/components/ui';
import { getStatusColor, getStatusLabel, formatDate, isOverdue, getDaysUntil } from '@/lib/utils';
import type { Dear, DearSubmission } from '@/types';

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

const DAILY_QUOTES = [
  'The more that you read, the more things you will know. — Dr. Seuss',
  'Reading is to the mind what exercise is to the body. — Joseph Addison',
  'A reader lives a thousand lives before he dies. — George R.R. Martin',
  'Today a reader, tomorrow a leader. — Margaret Fuller',
  'Books are a uniquely portable magic. — Stephen King',
];

export function StudentDashboard() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [dears, setDears] = useState<DearWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'drafted' | 'missed'>('all');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [onlineStudents, setOnlineStudents] = useState(0);

  const dailyQuote = DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length];

  useEffect(() => {
    loadDears();
    loadAnnouncements();
    loadActivity();

    const channel = supabase
      .channel('student-dears')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dears' }, () => loadDears())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dear_submissions' }, () => loadDears())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => loadAnnouncements())
      .subscribe();

    const presenceChannel = supabase.channel('student-presence');
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
  };

  const loadAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);
    setAnnouncements((data ?? []) as Announcement[]);
  };

  const loadActivity = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('student_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentActivity((data ?? []) as ActivityLog[]);
  };

  const filteredDears = dears.filter((d) => {
    const status = d.submission?.status ?? 'not_started';
    if (filter === 'all') return true;
    if (filter === 'upcoming') return !isOverdue(d.due_date) && status === 'not_started';
    if (filter === 'drafted') return status === 'draft';
    if (filter === 'missed') return isOverdue(d.due_date) && status === 'not_started';
    return true;
  });

  const stats = {
    total: dears.length,
    notStarted: dears.filter((d) => (d.submission?.status ?? 'not_started') === 'not_started').length,
    inProgress: dears.filter((d) => d.submission?.status === 'draft').length,
    submitted: dears.filter((d) => ['submitted', 'approved'].includes(d.submission?.status ?? '')).length,
  };

  const completionRate = stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;

  const layoutClass = theme.layout === 'compact' ? 'gap-3' : theme.layout === 'spacious' ? 'gap-6' : 'gap-4';

  return (
    <div className="dashboard-page p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Welcome header */}
      <div className="mb-8 animate-fade-in flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-app-primary">
            Hi, {profile?.first_name}!
          </h1>
          <p className="text-app-secondary mt-1">Here are your DEAR assignments. Pick one to get started.</p>
        </div>
        <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-app-secondary">{onlineStudents} online now</span>
        </div>
      </div>

      {/* Stats */}
      <div className={`dashboard-stats grid grid-cols-2 lg:grid-cols-4 ${layoutClass} mb-6`}>
        <GlassCard className="p-4 animate-slide-up">
          <p className="text-sm text-app-muted">Total DEARS</p>
          <p className="text-2xl font-semibold text-app-primary mt-1">{stats.total}</p>
        </GlassCard>
        <GlassCard className="p-4 animate-slide-up">
          <p className="text-sm text-app-muted">Not Started</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="status-dot status-red" />
            <p className="text-2xl font-semibold text-red-500">{stats.notStarted}</p>
          </div>
        </GlassCard>
        <GlassCard className="p-4 animate-slide-up">
          <p className="text-sm text-app-muted">In Progress</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="status-dot status-yellow" />
            <p className="text-2xl font-semibold text-amber-500">{stats.inProgress}</p>
          </div>
        </GlassCard>
        <GlassCard className="p-4 animate-slide-up">
          <p className="text-sm text-app-muted">Submitted</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="status-dot status-green" />
            <p className="text-2xl font-semibold text-green-500">{stats.submitted}</p>
          </div>
        </GlassCard>
      </div>

      {/* Progress bar + quote */}
      <div className={`grid grid-cols-1 lg:grid-cols-3 ${layoutClass} mb-6`}>
        <GlassCard className="p-5 lg:col-span-2 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-app-primary">Your Completion Rate</h3>
            <span className="text-lg font-bold gradient-text">{completionRate}%</span>
          </div>
          <div className="h-3 rounded-full bg-slate-200/50 dark:bg-slate-700/50 overflow-hidden">
            <div
              className="h-full gradient-bg rounded-full transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-xs text-app-muted mt-2">
            {stats.submitted} of {stats.total} DEARS completed
          </p>
        </GlassCard>

        <GlassCard className="p-5 animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
            <h3 className="text-sm font-semibold text-app-primary">Daily Quote</h3>
          </div>
          <p className="text-sm text-app-secondary italic leading-relaxed">{dailyQuote}</p>
        </GlassCard>
      </div>

      {/* Main content: DEAR cards + sidebar */}
      <div className={`dashboard-main grid grid-cols-1 lg:grid-cols-3 ${layoutClass}`}>
        {/* DEAR assignments */}
        <div className="lg:col-span-2">
          {/* Filter tabs */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {([
              { key: 'all', label: 'All' },
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'drafted', label: 'In Progress' },
              { key: 'missed', label: 'Missed' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                  filter === tab.key
                    ? 'glass text-[var(--primary-color)]'
                    : 'text-app-secondary hover:opacity-80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="border-2 border-slate-200 dark:border-slate-600 border-t-[var(--primary-color)] rounded-full animate-spin w-8 h-8" />
            </div>
          ) : filteredDears.length === 0 ? (
            <EmptyState
              icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>}
              title="No DEARS here yet"
              subtitle="Your assignments will appear in this category."
            />
          ) : (
            <div className="assignment-grid grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDears.map((dear, i) => {
                const status = dear.submission?.status ?? 'not_started';
                const color = getStatusColor(status);
                const overdue = isOverdue(dear.due_date) && status === 'not_started';
                const days = getDaysUntil(dear.due_date);

                return (
                  <GlassCard
                    key={dear.id}
                    hover
                    className={`p-5 cursor-pointer animate-slide-up`}
                  >
                    <div
                      onClick={() => navigate(`/dear/${dear.id}`)}
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`status-dot status-${color}`} />
                          <Badge color={color}>{getStatusLabel(status)}</Badge>
                        </div>
                        {overdue && <Badge color="red">Overdue</Badge>}
                      </div>

                      <h3 className="text-lg font-semibold text-app-primary mb-1">
                        {dear.week} - {dear.term}
                      </h3>
                      <p className="text-sm text-app-muted mb-4">
                        Due {formatDate(dear.due_date)}
                        {!overdue && days >= 0 && days <= 3 && (
                          <span className="ml-2 text-amber-500 font-medium">
                            {days === 0 ? 'Due today!' : `${days} day${days > 1 ? 's' : ''} left`}
                          </span>
                        )}
                      </p>

                      {dear.submission?.feedback && (
                        <div className="glass-input rounded-xl p-3 mb-3">
                          <p className="text-xs text-app-muted mb-1">Teacher Feedback</p>
                          <p className="text-sm text-app-secondary line-clamp-2">{dear.submission.feedback}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-app-muted">
                          {status === 'not_started' ? 'Tap to start' : status === 'draft' ? 'Continue working' : 'View submission'}
                        </span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar: announcements + activity */}
        <div className="space-y-4">
          {/* Announcements */}
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
              <div className="space-y-3">
                {announcements.map((a) => (
                  <div key={a.id} className="glass-input rounded-xl p-3">
                    <p className="text-sm font-medium text-app-primary">{a.title}</p>
                    <p className="text-xs text-app-muted mt-1 line-clamp-2">{a.body}</p>
                    <p className="text-xs text-app-muted mt-1">{formatDate(a.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Recent activity */}
          <GlassCard className="p-5 animate-slide-up">
            <h3 className="text-sm font-semibold text-app-primary mb-3">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-app-muted py-4 text-center">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full gradient-bg mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-app-secondary">{formatActivityAction(log.action, log.detail)}</p>
                      <p className="text-xs text-app-muted">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Quick links */}
          <GlassCard className="p-5 animate-slide-up">
            <h3 className="text-sm font-semibold text-app-primary mb-3">Quick Links</h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/messages')}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl glass-input text-sm text-app-secondary hover:text-app-primary transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                Messages
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl glass-input text-sm text-app-secondary hover:text-app-primary transition"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                Settings
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function formatActivityAction(action: string, detail: string | null): string {
  switch (action) {
    case 'submitted_dear':
      return `Submitted ${detail ?? 'DEAR'}`;
    case 'started_dear':
      return `Started ${detail ?? 'DEAR'}`;
    case 'opened_dear':
      return `Opened ${detail ?? 'DEAR'}`;
    default:
      return action.replace(/_/g, ' ');
  }
}
