import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GlassCard, Spinner } from '@/components/ui';
import type { Dear, DearSubmission } from '@/types';

export function TeacherAnalyticsScreen() {
  const [stats, setStats] = useState({ students: 0, dears: 0, submissions: 0, completed: 0, drafts: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: students }, { data: dears }, { data: submissions }] = await Promise.all([
        supabase.from('profiles').select('id').eq('role', 'student'),
        supabase.from('dears').select('*'),
        supabase.from('dear_submissions').select('*'),
      ]);
      const assignments = (dears ?? []) as Dear[];
      const work = (submissions ?? []) as DearSubmission[];
      const today = new Date().toISOString().slice(0, 10);
      setStats({
        students: (students ?? []).length,
        dears: assignments.length,
        submissions: work.length,
        completed: work.filter((item) => ['submitted', 'approved'].includes(item.status)).length,
        drafts: work.filter((item) => item.status === 'draft').length,
        overdue: assignments.filter((item) => item.due_date < today && item.status === 'active').length,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  const completion = stats.submissions ? Math.round((stats.completed / stats.submissions) * 100) : 0;
  const cards = [
    ['Students', stats.students], ['Total DEARs', stats.dears], ['Submissions', stats.submissions],
    ['Completed', stats.completed], ['In progress', stats.drafts], ['Overdue DEARs', stats.overdue],
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8"><h1 className="text-3xl font-semibold text-app-primary">Analytics</h1><p className="text-app-secondary mt-1">A clear view of reading activity and submission progress.</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cards.map(([label, value]) => <GlassCard key={label} className="p-5"><p className="text-sm text-app-muted">{label}</p><p className="text-3xl font-semibold text-app-primary mt-2">{value}</p></GlassCard>)}
      </div>
      <GlassCard className="p-6 max-w-xl">
        <div className="flex justify-between mb-3"><h2 className="font-semibold text-app-primary">Submission completion</h2><span className="font-semibold gradient-text">{completion}%</span></div>
        <div className="h-3 rounded-full bg-slate-200/50 overflow-hidden"><div className="h-full gradient-bg rounded-full" style={{ width: `${completion}%` }} /></div>
        <p className="text-sm text-app-muted mt-3">{stats.completed} of {stats.submissions} recorded submissions are submitted or approved.</p>
      </GlassCard>
    </div>
  );
}
