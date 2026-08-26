import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { GlassCard, Spinner } from '@/components/ui';
import type { Dear, DearSubmission } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  TrendingUp, Flame, Target, Award, BarChart3, Activity,
  CheckCircle2, Circle, Clock, BookOpen, Trophy, Zap,
} from 'lucide-react';

interface DearWithSubmission extends Dear { submission?: DearSubmission; }

const ACHIEVEMENTS = [
  { id: 'first', label: 'First Steps', desc: 'Submit your first DEAR', icon: '🎯', threshold: 1 },
  { id: 'five', label: 'Bookworm', desc: 'Submit 5 DEARs', icon: '🐛', threshold: 5 },
  { id: 'ten', label: 'Scholar', desc: 'Submit 10 DEARs', icon: '📚', threshold: 10 },
  { id: 'streak3', label: 'On Fire', desc: '3-day streak', icon: '🔥', threshold: 3 },
  { id: 'streak7', label: 'Unstoppable', desc: '7-day streak', icon: '⚡', threshold: 7 },
  { id: 'early', label: 'Early Bird', desc: 'Submit early 3 times', icon: '🐦', threshold: 3 },
  { id: 'perfect', label: 'Perfectionist', desc: 'Get approved 5 times', icon: '✨', threshold: 5 },
  { id: 'speed', label: 'Speed Writer', desc: 'Submit within 1 hour', icon: '💨', threshold: 1 },
];

export function ProgressPage() {
  const { profile } = useAuth();
  const [dears, setDears] = useState<DearWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [heatmap, setHeatmap] = useState<number[]>([]);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [goalTarget, setGoalTarget] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dear-hub-goal') ?? '{}').target ?? 5; } catch { return 5; }
  });

  useEffect(() => { load(); }, [profile]);

  const load = async () => {
    const { data: dearData } = await supabase.from('dears').select('*').eq('status', 'active').order('created_at', { ascending: false });
    if (!dearData) { setLoading(false); return; }
    const { data: subs } = await supabase.from('dear_submissions').select('*').eq('student_id', profile?.id);
    const subMap = new Map<string, DearSubmission>();
    (subs ?? []).forEach((s) => subMap.set(s.dear_id, s as DearSubmission));
    const combined = dearData.map((d) => ({ ...(d as Dear), submission: subMap.get(d.id) }));
    setDears(combined);

    // Heatmap
    const twelveWeeksAgo = new Date(); twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
    const { data: logs } = await supabase.from('activity_logs').select('created_at').eq('student_id', profile?.id).gte('created_at', twelveWeeksAgo.toISOString());
    const dayCounts = new Map<string, number>();
    (logs ?? []).forEach((l: any) => { const d = new Date(l.created_at).toDateString(); dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1); });
    const hm: number[] = [];
    for (let i = 83; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); hm.push(dayCounts.get(d.toDateString()) ?? 0); }
    setHeatmap(hm);

    // Streak
    const submittedDates = combined.filter((d) => d.submission?.submitted_at).map((d) => new Date(d.submission!.submitted_at!).toDateString());
    const unique = [...new Set(submittedDates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    let cur = 0, longest = 0, temp = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) { const d = new Date(today); d.setDate(d.getDate() - i); if (unique.includes(d.toDateString())) { temp++; if (i < unique.length) cur = temp; } else { longest = Math.max(longest, temp); temp = 0; } }
    longest = Math.max(longest, temp, cur);
    setStreak(cur); setLongestStreak(longest);
    setLoading(false);
  };

  const stats = {
    total: dears.length,
    submitted: dears.filter((d) => ['submitted', 'approved'].includes(d.submission?.status ?? '')).length,
    approved: dears.filter((d) => d.submission?.status === 'approved').length,
    draft: dears.filter((d) => d.submission?.status === 'draft').length,
    notStarted: dears.filter((d) => (d.submission?.status ?? 'not_started') === 'not_started').length,
  };

  const completionRate = stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;
  const approvalRate = stats.submitted > 0 ? Math.round((stats.approved / stats.submitted) * 100) : 0;
  const goalProgress = Math.min(stats.submitted / Math.max(goalTarget, 1), 1);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <p className="text-sm font-medium text-[var(--primary-color)]">DEAR HUB</p>
        <h1 className="text-3xl font-semibold text-app-primary">My Progress</h1>
        <p className="text-app-secondary mt-1">Track your reading and writing journey.</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Completion', value: `${completionRate}%`, icon: <TrendingUp size={18} />, color: 'text-[var(--primary-color)]' },
          { label: 'Approval Rate', value: `${approvalRate}%`, icon: <Award size={18} />, color: 'text-green-500' },
          { label: 'Current Streak', value: `${streak}d`, icon: <Flame size={18} />, color: 'text-orange-500' },
          { label: 'Longest Streak', value: `${longestStreak}d`, icon: <Zap size={18} />, color: 'text-amber-500' },
        ].map((s) => (
          <GlassCard key={s.label} className="p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-app-muted">{s.label}</p>
              <span className={s.color}>{s.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Completion ring */}
        <GlassCard className="p-5 animate-slide-up">
          <h3 className="text-sm font-semibold text-app-primary mb-4">Overall Completion</h3>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200/50 dark:text-slate-700/50" />
                <circle cx="48" cy="48" r="42" fill="none" stroke="var(--primary-color)" strokeWidth="8" strokeDasharray={`${completionRate * 2.64} 264`} strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-app-primary">{completionRate}%</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-xs"><span className="text-app-muted">Approved</span><span className="font-semibold text-green-500">{stats.approved}</span></div>
              <div className="flex justify-between text-xs"><span className="text-app-muted">Submitted</span><span className="font-semibold text-blue-500">{stats.submitted}</span></div>
              <div className="flex justify-between text-xs"><span className="text-app-muted">In Progress</span><span className="font-semibold text-amber-500">{stats.draft}</span></div>
              <div className="flex justify-between text-xs"><span className="text-app-muted">Not Started</span><span className="font-semibold text-red-500">{stats.notStarted}</span></div>
            </div>
          </div>
        </GlassCard>

        {/* Goal */}
        <GlassCard className="p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-app-primary">Monthly Goal</h3>
            <button onClick={() => { const v = prompt('Set monthly goal:', String(goalTarget)); if (v && !isNaN(Number(v)) && Number(v) > 0) { setGoalTarget(Number(v)); localStorage.setItem('dear-hub-goal', JSON.stringify({ target: Number(v), current: stats.submitted, period: 'monthly' })); } }} className="text-xs text-[var(--primary-color)] hover:underline">Edit</button>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-200/50 dark:text-slate-700/50" />
                <circle cx="48" cy="48" r="42" fill="none" stroke="#10b981" strokeWidth="8" strokeDasharray={`${goalProgress * 264} 264`} strokeLinecap="round" className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-center">
                <span className="text-sm font-bold text-app-primary">{stats.submitted}/{goalTarget}</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-app-secondary">{stats.submitted >= goalTarget ? '🎉 Goal reached!' : `${goalTarget - stats.submitted} more to go`}</p>
              <p className="text-xs text-app-muted mt-1">Submissions this month</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Streak dots */}
      <GlassCard className="p-5 mb-6 animate-slide-up">
        <div className="flex items-center gap-2 mb-3">
          <Flame size={18} className="text-orange-500" />
          <h3 className="text-sm font-semibold text-app-primary">Submission Streak</h3>
        </div>
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          {heatmap.map((count, i) => {
            const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3;
            const colors = ['bg-slate-200/40 dark:bg-slate-700/40', 'bg-[var(--primary-color)]/20', 'bg-[var(--primary-color)]/50', 'bg-[var(--primary-color)]'];
            return <div key={i} className={`w-3 h-3 rounded-[3px] shrink-0 ${colors[level]}`} title={`${count} activities`} />;
          })}
        </div>
        <div className="flex items-center gap-1 mt-2 justify-end">
          <span className="text-[9px] text-app-muted">Less</span>
          {[0, 1, 2, 3].map((l) => <div key={l} className={`w-3 h-3 rounded-[3px] ${l === 0 ? 'bg-slate-200/40 dark:bg-slate-700/40' : l === 1 ? 'bg-[var(--primary-color)]/20' : l === 2 ? 'bg-[var(--primary-color)]/50' : 'bg-[var(--primary-color)]'}`} />)}
          <span className="text-[9px] text-app-muted">More</span>
        </div>
      </GlassCard>

      {/* Achievements */}
      <GlassCard className="p-5 animate-slide-up">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={18} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-app-primary">Achievements</h3>
          <span className="text-xs text-app-muted ml-auto">{ACHIEVEMENTS.filter((a) => stats.submitted >= a.threshold).length}/{ACHIEVEMENTS.length}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ACHIEVEMENTS.map((a) => {
            const unlocked = stats.submitted >= a.threshold;
            return (
              <div key={a.id} className={`p-3 rounded-xl text-center transition ${unlocked ? 'bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/30' : 'glass opacity-50'}`}>
                <div className="text-2xl mb-1">{a.icon}</div>
                <p className="text-xs font-semibold text-app-primary">{a.label}</p>
                <p className="text-[10px] text-app-muted mt-0.5">{a.desc}</p>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}
