import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { GlassCard, Badge, EmptyState, Avatar, Spinner } from '@/components/ui';
import { getStatusColor, getStatusLabel, formatRelative, formatDate, isOverdue } from '@/lib/utils';
import type { Dear, DearSubmission, Profile } from '@/types';
import {
  Users, BookOpen, CheckCircle2, AlertTriangle, Clock, TrendingUp,
  Plus, Eye, MessageSquare, BarChart3, Settings, Search, X,
  ChevronRight, Download, Filter, ArrowUpRight, ArrowDownRight,
  Zap, Target, Award, Calendar, Layers, GraduationCap,
  Activity, PieChart, RefreshCw, Bell, FileText, Send,
} from 'lucide-react';

interface StudentWithSubmissions extends Profile {
  submissions: (DearSubmission & { dear: Dear })[];
}

interface DashboardWidget {
  id: string;
  enabled: boolean;
  order: number;
}

const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: 'welcome', enabled: true, order: 0 },
  { id: 'stats', enabled: true, order: 1 },
  { id: 'charts', enabled: true, order: 2 },
  { id: 'dears', enabled: true, order: 3 },
  { id: 'students', enabled: true, order: 4 },
  { id: 'quickactions', enabled: true, order: 5 },
  { id: 'activity', enabled: true, order: 6 },
  { id: 'heatmap', enabled: true, order: 7 },
];

const WIDGET_LABELS: Record<string, string> = {
  welcome: 'Welcome Header',
  stats: 'Class Overview',
  charts: 'Grade Distribution',
  dears: 'Active DEARs',
  students: 'Student List',
  quickactions: 'Quick Actions',
  activity: 'Recent Activity',
  heatmap: 'Student Activity',
};

export function TeacherDashboard() {
  const { profile, isAdmin } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentWithSubmissions[]>([]);
  const [dears, setDears] = useState<Dear[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineStudents, setOnlineStudents] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentFilter, setStudentFilter] = useState<'all' | 'struggling' | 'on_track' | 'excellent'>('all');
  const [editingLayout, setEditingLayout] = useState(false);
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    try {
      const stored = localStorage.getItem('dear-hub-teacher-widgets');
      return stored ? JSON.parse(stored) : DEFAULT_WIDGETS;
    } catch { return DEFAULT_WIDGETS; }
  });

  useEffect(() => {
    loadData();
    const channel = supabase
      .channel('teacher-overview-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dear_submissions' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dears' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadData())
      .subscribe();

    const presenceChannel = supabase.channel('teacher-presence-v2');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineStudents(Object.keys(state));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  const loadData = async () => {
    const { data: studentData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('first_name');

    const { data: dearData } = await supabase
      .from('dears')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: subData } = await supabase
      .from('dear_submissions')
      .select('*, dear:dears(*)');

    const subMap = new Map<string, (DearSubmission & { dear: Dear })[]>();
    (subData ?? []).forEach((s: any) => {
      const arr = subMap.get(s.student_id) ?? [];
      arr.push(s);
      subMap.set(s.student_id, arr);
    });

    const combined = (studentData ?? []).map((s) => ({
      ...(s as Profile),
      submissions: subMap.get(s.id) ?? [],
    }));

    setStudents(combined as StudentWithSubmissions[]);
    setDears((dearData ?? []) as Dear[]);
    setLoading(false);
  };

  // ── Computed stats ──
  const stats = useMemo(() => {
    const s = { total: students.length, red: 0, yellow: 0, green: 0, submitted: 0, approved: 0, overdue: 0 };
    students.forEach((student) => {
      const latest = student.submissions[0];
      const status = latest?.status ?? 'not_started';
      const color = getStatusColor(status);
      if (color === 'red') s.red++;
      else if (color === 'yellow') s.yellow++;
      else if (color === 'green') s.green++;
      if (['submitted', 'approved'].includes(status)) s.submitted++;
      if (status === 'approved') s.approved++;
    });
    dears.forEach((d) => { if (isOverdue(d.due_date)) s.overdue++; });
    return s;
  }, [students, dears]);

  // Grade distribution
  const gradeDistribution = useMemo(() => {
    const dist = { notStarted: 0, draft: 0, submitted: 0, approved: 0, failed: 0 };
    students.forEach((s) => {
      s.submissions.forEach((sub) => {
        if (sub.status in dist) dist[sub.status as keyof typeof dist]++;
      });
    });
    return dist;
  }, [students]);

  // Class average completion
  const classCompletionRate = useMemo(() => {
    if (students.length === 0 || dears.length === 0) return 0;
    const totalExpected = students.length * dears.length;
    const totalCompleted = students.reduce((acc, s) =>
      acc + s.submissions.filter((sub) => ['submitted', 'approved'].includes(sub.status)).length, 0
    );
    return Math.round((totalCompleted / Math.max(totalExpected, 1)) * 100);
  }, [students, dears]);

  // Top & struggling students
  const { topStudents, strugglingStudents } = useMemo(() => {
    const scored = students.map((s) => {
      const approved = s.submissions.filter((sub) => sub.status === 'approved').length;
      const submitted = s.submissions.filter((sub) => ['submitted', 'approved'].includes(sub.status)).length;
      const total = s.submissions.length;
      return { ...s, approved, submitted, total, score: total > 0 ? (approved / total) * 100 : 0 };
    }).sort((a, b) => b.score - a.score);

    return {
      topStudents: scored.slice(0, 5),
      strugglingStudents: scored.filter((s) => s.score < 30 && s.total > 0).slice(0, 5),
    };
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (studentFilter === 'all') return true;
      const latest = s.submissions[0];
      const status = latest?.status ?? 'not_started';
      const color = getStatusColor(status);
      if (studentFilter === 'struggling') return color === 'red';
      if (studentFilter === 'on_track') return color === 'yellow';
      if (studentFilter === 'excellent') return color === 'green';
      return true;
    });
  }, [students, searchQuery, studentFilter]);

  const toggleWidget = (widgetId: string) => {
    setWidgets((prev) => {
      const next = prev.map((w) => w.id === widgetId ? { ...w, enabled: !w.enabled } : w);
      localStorage.setItem('dear-hub-teacher-widgets', JSON.stringify(next));
      return next;
    });
  };

  const resetWidgets = () => {
    setWidgets(DEFAULT_WIDGETS);
    localStorage.setItem('dear-hub-teacher-widgets', JSON.stringify(DEFAULT_WIDGETS));
  };

  const exportReport = () => {
    const rows = [['Student', 'Email', 'Status', 'Approved', 'Submitted', 'Total', 'Score']];
    students.forEach((s) => {
      const approved = s.submissions.filter((sub) => sub.status === 'approved').length;
      const submitted = s.submissions.filter((sub) => ['submitted', 'approved'].includes(sub.status)).length;
      const total = s.submissions.length;
      const score = total > 0 ? Math.round((approved / total) * 100) : 0;
      rows.push([`${s.first_name} ${s.last_name}`, s.email, getStatusLabel(s.submissions[0]?.status ?? 'not_started'), String(approved), String(submitted), String(total), `${score}%`]);
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dear-hub-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasWidget = (id: string) => widgets.filter((w) => w.enabled).some((w) => w.id === id);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Layout Editor Toggle */}
      <div className="flex items-center justify-end mb-4 gap-2">
        <button onClick={exportReport} className="flex items-center gap-2 text-xs text-app-muted hover:text-app-primary transition px-3 py-1.5 rounded-lg glass">
          <Download size={14} /> Export CSV
        </button>
        <button onClick={() => setEditingLayout(!editingLayout)} className="flex items-center gap-2 text-xs text-app-muted hover:text-app-primary transition px-3 py-1.5 rounded-lg glass">
          <Settings size={14} /> {editingLayout ? 'Done' : 'Customize'}
        </button>
      </div>

      {/* Layout Editor Panel */}
      {editingLayout && (
        <GlassCard className="p-5 mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-app-primary">Dashboard Widgets</h3>
            <button onClick={resetWidgets} className="text-xs text-app-muted hover:text-app-primary">Reset</button>
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
                {widget.enabled ? '✓' : '○'} {WIDGET_LABELS[widget.id]}
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* ═══ WELCOME ═══ */}
      {hasWidget('welcome') && (
        <div className="mb-8 animate-fade-in flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-app-primary">Teacher Overview</h1>
            <p className="text-app-secondary mt-1">Monitor your students' progress at a glance.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2">
              <Users size={16} className="text-[var(--primary-color)]" />
              <span className="text-sm text-app-secondary">{students.length} students</span>
            </div>
            {onlineStudents.length > 0 && (
              <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-app-secondary">{onlineStudents.length} online</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ STATS ═══ */}
      {hasWidget('stats') && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Students', value: stats.total, icon: <Users size={16} />, color: 'text-app-primary' },
            { label: 'Not Started', value: stats.red, icon: <AlertTriangle size={16} />, color: 'text-red-500' },
            { label: 'In Progress', value: stats.yellow, icon: <Clock size={16} />, color: 'text-amber-500' },
            { label: 'Submitted', value: stats.green, icon: <CheckCircle2 size={16} />, color: 'text-green-500' },
            { label: 'Class Average', value: `${classCompletionRate}%`, icon: <Target size={16} />, color: 'text-[var(--primary-color)]' },
          ].map((stat) => (
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

      {/* ═══ CHARTS ═══ */}
      {hasWidget('charts') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Grade Distribution */}
          <GlassCard className="p-5 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-[var(--primary-color)]" />
              <h3 className="text-sm font-semibold text-app-primary">Grade Distribution</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Not Started', count: gradeDistribution.notStarted, color: 'bg-red-400', textColor: 'text-red-500' },
                { label: 'Draft', count: gradeDistribution.draft, color: 'bg-amber-400', textColor: 'text-amber-500' },
                { label: 'Submitted', count: gradeDistribution.submitted, color: 'bg-blue-400', textColor: 'text-blue-500' },
                { label: 'Approved', count: gradeDistribution.approved, color: 'bg-green-400', textColor: 'text-green-500' },
              ].map((bar) => {
                const max = Math.max(...Object.values(gradeDistribution), 1);
                return (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-app-muted">{bar.label}</span>
                      <span className={`text-xs font-semibold ${bar.textColor}`}>{bar.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200/50 dark:bg-slate-700/50 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${bar.color}`} style={{ width: `${(bar.count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Top & Struggling */}
          <GlassCard className="p-5 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
              <Award size={18} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-app-primary">Student Leaderboard</h3>
            </div>
            <div className="space-y-1.5">
              {topStudents.length === 0 ? (
                <p className="text-sm text-app-muted py-4 text-center">No data yet.</p>
              ) : (
                topStudents.map((student, i) => (
                  <div key={student.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/5 transition">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      i === 1 ? 'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400' :
                      i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-slate-50 text-app-muted'
                    }`}>{i + 1}</span>
                    <Avatar url={student.avatar_url} name={`${student.first_name} ${student.last_name}`} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-app-primary truncate">{student.first_name} {student.last_name}</p>
                      <p className="text-[10px] text-app-muted">{student.approved} approved · {student.submitted} submitted</p>
                    </div>
                    <span className="text-xs font-semibold text-[var(--primary-color)]">{Math.round(student.score)}%</span>
                  </div>
                ))
              )}
            </div>

            {strugglingStudents.length > 0 && (
              <>
                <div className="border-t border-slate-200/30 dark:border-slate-700/30 my-3" />
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} className="text-red-500" />
                  <h4 className="text-xs font-semibold text-app-primary">Needs Attention</h4>
                </div>
                <div className="space-y-1.5">
                  {strugglingStudents.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => navigate(`/teacher/peek/${student.id}`)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/5 transition text-left"
                    >
                      <Avatar url={student.avatar_url} name={`${student.first_name} ${student.last_name}`} size={28} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-app-primary truncate">{student.first_name} {student.last_name}</p>
                        <p className="text-[10px] text-red-500">{Math.round(student.score)}% completion</p>
                      </div>
                      <ChevronRight size={12} className="text-app-muted" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </GlassCard>
        </div>
      )}

      {/* ═══ QUICK ACTIONS ═══ */}
      {hasWidget('quickactions') && (
        <GlassCard className="p-5 mb-6 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-app-primary">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'New DEAR', icon: <Plus size={20} />, path: '/teacher/create', color: 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' },
              { label: 'Grade', icon: <GraduationCap size={20} />, path: '/teacher/submissions', color: 'bg-green-500/10 text-green-600' },
              { label: 'Announce', icon: <Send size={20} />, path: '/teacher/announcements', color: 'bg-blue-500/10 text-blue-600' },
              { label: 'Analytics', icon: <BarChart3 size={20} />, path: '/teacher/analytics', color: 'bg-purple-500/10 text-purple-600' },
              { label: 'Live Activity', icon: <Activity size={20} />, path: '/teacher/live', color: 'bg-red-500/10 text-red-500' },
              { label: 'Messages', icon: <MessageSquare size={20} />, path: '/teacher/messages', color: 'bg-amber-500/10 text-amber-600' },
              { label: 'Manage', icon: <Users size={20} />, path: '/teacher/students', color: 'bg-teal-500/10 text-teal-600' },
              { label: 'All DEARs', icon: <Layers size={20} />, path: '/teacher/dears', color: 'bg-indigo-500/10 text-indigo-600' },
            ].map((action) => (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl ${action.color} hover:scale-105 transition-all`}
              >
                {action.icon}
                <span className="text-xs font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* ═══ DEARS ═══ */}
      {hasWidget('dears') && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-app-primary">Active DEARs</h2>
            <button onClick={() => navigate('/teacher/create')} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> New DEAR
            </button>
          </div>

          {dears.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={48} />}
              title="No DEARs yet"
              subtitle="Create your first DEAR assignment to get started."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dears.map((dear) => {
                const studentSubs = students.flatMap((s) => s.submissions.filter((sub) => sub.dear_id === dear.id));
                const completed = studentSubs.filter((s) => ['submitted', 'approved'].includes(s.status)).length;
                const approved = studentSubs.filter((s) => s.status === 'approved').length;
                const pct = students.length > 0 ? Math.round((completed / students.length) * 100) : 0;

                return (
                  <GlassCard key={dear.id} hover className="p-5 animate-slide-up">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-app-primary">{dear.week} — {dear.term}</h3>
                        <p className="text-sm text-app-muted">Due {formatDate(dear.due_date)}</p>
                      </div>
                      {isOverdue(dear.due_date) && <Badge color="red">Overdue</Badge>}
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-200/50 dark:bg-slate-700/50 overflow-hidden">
                        <div className="h-full gradient-bg rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-app-muted">{completed}/{students.length}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-app-muted mb-3">
                      <span>{approved} approved</span>
                      <span>{pct}% complete</span>
                    </div>

                    <button
                      onClick={() => navigate(`/teacher/grade/${dear.id}`)}
                      className="w-full text-sm text-[var(--primary-color)] font-medium hover:underline flex items-center justify-center gap-1"
                    >
                      Review submissions <ArrowUpRight size={14} />
                    </button>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ STUDENTS ═══ */}
      {hasWidget('students') && (
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-xl font-semibold text-app-primary">Students</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
                <input
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass-input rounded-xl pl-8 pr-8 py-2 text-sm w-48"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-primary">
                    <X size={12} />
                  </button>
                )}
              </div>
              {(['all', 'struggling', 'on_track', 'excellent'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStudentFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition capitalize ${
                    studentFilter === f ? 'glass text-[var(--primary-color)]' : 'text-app-secondary hover:opacity-80'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'struggling' ? '🔴 Struggling' : f === 'on_track' ? '🟡 On Track' : '🟢 Excellent'}
                </button>
              ))}
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <EmptyState
              icon={<Users size={48} />}
              title="No students found"
              subtitle="Try adjusting your filters."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredStudents.map((student) => {
                const latest = student.submissions[0];
                const status = latest?.status ?? 'not_started';
                const color = getStatusColor(status);
                const isOnline = onlineStudents.includes(student.id);
                const approved = student.submissions.filter((sub) => sub.status === 'approved').length;
                const total = student.submissions.length;
                const score = total > 0 ? Math.round((approved / total) * 100) : 0;

                return (
                  <GlassCard key={student.id} hover className="p-4 animate-slide-up">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative">
                        <Avatar url={student.avatar_url} name={`${student.first_name} ${student.last_name}`} size={44} />
                        {isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-app-primary truncate">{student.first_name} {student.last_name}</p>
                        <p className="text-xs text-app-muted truncate">{student.email}</p>
                      </div>
                      <span className={`status-dot status-${color}`} />
                    </div>

                    <div className="flex items-center justify-between mb-3">
                      <Badge color={color}>{getStatusLabel(status)}</Badge>
                      <span className="text-xs text-app-muted">{score}%</span>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => navigate(`/teacher/peek/${student.id}`)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg glass text-xs text-app-secondary hover:text-app-primary transition"
                      >
                        <Eye size={14} /> Peek
                      </button>
                      <button
                        onClick={() => navigate(`/teacher/messages/${student.id}`)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg glass text-xs text-app-secondary hover:text-app-primary transition"
                      >
                        <MessageSquare size={14} /> Message
                      </button>
                    </div>

                    {latest?.last_activity && (
                      <p className="text-[10px] text-app-muted mt-2">Last active {formatRelative(latest.last_activity)}</p>
                    )}
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
