import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { GlassCard, Badge, EmptyState, Spinner, Avatar } from '@/components/ui';
import { getStatusColor, getStatusLabel, formatDate, isOverdue } from '@/lib/utils';
import type { Dear, DearSubmission, Profile } from '@/types';

interface DearWithSubs extends Dear {
  submissions: (DearSubmission & { student: Profile })[];
  completed: number;
  total: number;
}

export function DearsScreen() {
  const navigate = useNavigate();
  const [dears, setDears] = useState<DearWithSubs[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('teacher-dears')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dears' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dear_submissions' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    const { data: dearData } = await supabase
      .from('dears')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: studentData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('first_name');

    const { data: subData } = await supabase
      .from('dear_submissions')
      .select('*, student:profiles!dear_submissions_student_id_fkey(*)')
      .order('updated_at', { ascending: false });

    const studentMap = new Map<string, Profile>();
    (studentData ?? []).forEach((s) => studentMap.set(s.id, s as Profile));
    setStudents((studentData ?? []) as Profile[]);

    const subByDear = new Map<string, (DearSubmission & { student: Profile })[]>();
    (subData ?? []).forEach((s: any) => {
      const arr = subByDear.get(s.dear_id) ?? [];
      const student = s.student as Profile;
      arr.push({ ...(s as DearSubmission), student });
      subByDear.set(s.dear_id, arr);
    });

    const combined = (dearData ?? []).map((d) => {
      const subs = subByDear.get(d.id) ?? [];
      const completed = subs.filter((s) => ['submitted', 'approved'].includes(s.status)).length;
      return {
        ...(d as Dear),
        submissions: subs,
        completed,
        total: studentData?.length ?? 0,
      };
    });

    setDears(combined);
    setLoading(false);
  };

  const filteredDears = dears.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'active') return d.status === 'active';
    if (filter === 'archived') return d.status === 'archived';
    return true;
  });

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-semibold text-app-primary">All DEARS</h1>
        <p className="text-app-secondary mt-1">View every DEAR assignment and who completed them.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { key: 'all', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'archived', label: 'Archived' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filter === tab.key
                ? 'glass text-[var(--primary-color)]'
                : 'text-app-secondary hover:opacity-80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredDears.length === 0 ? (
        <EmptyState
          icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
          title="No DEARS yet"
          subtitle="Create your first DEAR assignment to get started."
        />
      ) : (
        <div className="space-y-3">
          {filteredDears.map((dear, i) => {
            const overdue = isOverdue(dear.due_date) && dear.status === 'active';
            const isExpanded = expandedId === dear.id;

            return (
              <GlassCard key={dear.id} className="p-5 animate-slide-up" >
                <div style={{ animationDelay: `${i * 50}ms` }}>
                  {/* Header row */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : dear.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${dear.status === 'active' ? 'gradient-bg' : 'bg-slate-300 dark:bg-slate-600'}`}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-app-primary">{dear.week} - {dear.term}</h3>
                        <p className="text-sm text-app-muted">
                          Due {formatDate(dear.due_date)}
                          {overdue && <span className="ml-2 text-red-500 font-medium">Overdue</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge color={dear.status === 'active' ? 'green' : 'gray'}>
                        {dear.status === 'active' ? 'Active' : 'Archived'}
                      </Badge>
                      <div className="hidden sm:flex items-center gap-2">
                        <div className="w-24 h-2 rounded-full bg-slate-200/50 dark:bg-slate-700/50 overflow-hidden">
                          <div
                            className="h-full gradient-bg rounded-full transition-all"
                            style={{ width: `${dear.total > 0 ? (dear.completed / dear.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-app-muted whitespace-nowrap">{dear.completed}/{dear.total}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/teacher/grade/${dear.id}`); }}
                        className="text-sm text-[var(--primary-color)] font-medium hover:underline whitespace-nowrap"
                      >
                        Review →
                      </button>
                      <svg
                        width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-app-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded: submissions list */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-200/30 dark:border-slate-700/30 animate-slide-up">
                      {dear.submissions.length === 0 ? (
                        <p className="text-sm text-app-muted text-center py-4">No submissions yet for this DEAR.</p>
                      ) : (
                        <div className="space-y-2">
                          {dear.submissions.map((sub) => {
                            const color = getStatusColor(sub.status);
                            return (
                              <div
                                key={sub.id}
                                className="flex items-center gap-3 glass-input rounded-xl p-3 cursor-pointer hover:opacity-80 transition"
                                onClick={() => navigate(`/teacher/grade/${dear.id}`)}
                              >
                                <Avatar url={sub.student.avatar_url} name={`${sub.student.first_name} ${sub.student.last_name}`} size={36} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-app-primary truncate">
                                    {sub.student.first_name} {sub.student.last_name}
                                  </p>
                                  <p className="text-xs text-app-muted">
                                    {sub.status === 'not_started' ? 'Not started' : sub.status === 'draft' ? 'In progress' : sub.submitted_at ? `Submitted ${formatDate(sub.submitted_at)}` : getStatusLabel(sub.status)}
                                  </p>
                                </div>
                                <span className={`status-dot status-${color}`} />
                                <Badge color={color}>{getStatusLabel(sub.status)}</Badge>
                              </div>
                            );
                          })}
                          {/* Students who haven't started */}
                          {students.filter((s) => !dear.submissions.some((sub) => sub.student_id === s.id)).map((student) => (
                            <div key={student.id} className="flex items-center gap-3 glass-input rounded-xl p-3 opacity-50">
                              <Avatar url={student.avatar_url} name={`${student.first_name} ${student.last_name}`} size={36} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-app-primary truncate">
                                  {student.first_name} {student.last_name}
                                </p>
                                <p className="text-xs text-app-muted">Not started</p>
                              </div>
                              <span className="status-dot status-red" />
                              <Badge color="red">Not Started</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
