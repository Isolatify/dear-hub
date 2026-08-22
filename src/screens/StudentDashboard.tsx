import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { GlassCard, Badge, EmptyState, Avatar } from '@/components/ui';
import { getStatusColor, getStatusLabel, formatDate, isOverdue, getDaysUntil } from '@/lib/utils';
import type { Dear, DearSubmission } from '@/types';

interface DearWithSubmission extends Dear {
  submission?: DearSubmission;
}

export function StudentDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [dears, setDears] = useState<DearWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'drafted' | 'missed'>('all');

  useEffect(() => {
    loadDears();

    const channel = supabase
      .channel('student-dears')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dears' }, () => loadDears())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dear_submissions' }, () => loadDears())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-semibold text-slate-800">
          Hi, {profile?.first_name}! 👋
        </h1>
        <p className="text-slate-500 mt-1">Here are your DEAR assignments. Pick one to get started.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <GlassCard className="p-4 animate-slide-up">
          <p className="text-sm text-slate-500">Total DEARS</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">{stats.total}</p>
        </GlassCard>
        <GlassCard className="p-4 animate-slide-up" >
          <p className="text-sm text-slate-500">Not Started</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="status-dot status-red" />
            <p className="text-2xl font-semibold text-red-500">{stats.notStarted}</p>
          </div>
        </GlassCard>
        <GlassCard className="p-4 animate-slide-up">
          <p className="text-sm text-slate-500">In Progress</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="status-dot status-yellow" />
            <p className="text-2xl font-semibold text-amber-500">{stats.inProgress}</p>
          </div>
        </GlassCard>
        <GlassCard className="p-4 animate-slide-up">
          <p className="text-sm text-slate-500">Submitted</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="status-dot status-green" />
            <p className="text-2xl font-semibold text-green-500">{stats.submitted}</p>
          </div>
        </GlassCard>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
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
                : 'text-slate-500 hover:bg-white/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* DEAR cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="border-2 border-slate-200 border-t-[var(--primary-color)] rounded-full animate-spin w-8 h-8" />
        </div>
      ) : filteredDears.length === 0 ? (
        <EmptyState
          icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>}
          title="No DEARS here yet"
          subtitle="Your assignments will appear in this category."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

                  <h3 className="text-lg font-semibold text-slate-800 mb-1">
                    {dear.week} - {dear.term}
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Due {formatDate(dear.due_date)}
                    {!overdue && days >= 0 && days <= 3 && (
                      <span className="ml-2 text-amber-500 font-medium">
                        {days === 0 ? 'Due today!' : `${days} day${days > 1 ? 's' : ''} left`}
                      </span>
                    )}
                  </p>

                  {dear.submission?.feedback && (
                    <div className="glass-input rounded-xl p-3 mb-3">
                      <p className="text-xs text-slate-400 mb-1">Teacher Feedback</p>
                      <p className="text-sm text-slate-600 line-clamp-2">{dear.submission.feedback}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
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
  );
}
