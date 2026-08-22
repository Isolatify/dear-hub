import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { GlassCard, Badge, EmptyState, Avatar, Spinner } from '@/components/ui';
import { getStatusColor, getStatusLabel, formatRelative, formatDate, isOverdue } from '@/lib/utils';
import type { Dear, DearSubmission, Profile } from '@/types';

interface StudentWithSubmissions extends Profile {
  submissions: (DearSubmission & { dear: Dear })[];
}

export function TeacherDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentWithSubmissions[]>([]);
  const [dears, setDears] = useState<Dear[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlineStudents, setOnlineStudents] = useState<string[]>([]);

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('teacher-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dear_submissions' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dears' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadData())
      .subscribe();

    // Presence tracking
    const presenceChannel = supabase.channel('teacher-presence');
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

  const stats = {
    total: students.length,
    red: 0,
    yellow: 0,
    green: 0,
  };
  students.forEach((s) => {
    const latest = s.submissions[0];
    const status = latest?.status ?? 'not_started';
    const color = getStatusColor(status);
    if (color === 'red') stats.red++;
    else if (color === 'yellow') stats.yellow++;
    else if (color === 'green') stats.green++;
  });

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-semibold text-slate-800">Teacher Overview</h1>
        <p className="text-slate-500 mt-1">Monitor your students' progress at a glance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <GlassCard className="p-4 animate-slide-up">
          <p className="text-sm text-slate-500">Total Students</p>
          <p className="text-2xl font-semibold text-slate-800 mt-1">{stats.total}</p>
        </GlassCard>
        <GlassCard className="p-4 animate-slide-up">
          <p className="text-sm text-slate-500">Not Started</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="status-dot status-red" />
            <p className="text-2xl font-semibold text-red-500">{stats.red}</p>
          </div>
        </GlassCard>
        <GlassCard className="p-4 animate-slide-up">
          <p className="text-sm text-slate-500">In Progress</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="status-dot status-yellow" />
            <p className="text-2xl font-semibold text-amber-500">{stats.yellow}</p>
          </div>
        </GlassCard>
        <GlassCard className="p-4 animate-slide-up">
          <p className="text-sm text-slate-500">Submitted</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="status-dot status-green" />
            <p className="text-2xl font-semibold text-green-500">{stats.green}</p>
          </div>
        </GlassCard>
      </div>

      {/* Active DEARS */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-700">Active DEARS</h2>
          <button onClick={() => navigate('/teacher/create')} className="btn-primary flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New DEAR
          </button>
        </div>

        {dears.length === 0 ? (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
            title="No DEARS yet"
            subtitle="Create your first DEAR assignment to get started."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dears.map((dear, i) => {
              const studentSubs = students.flatMap((s) =>
                s.submissions.filter((sub) => sub.dear_id === dear.id)
              );
              const completed = studentSubs.filter((s) => ['submitted', 'approved'].includes(s.status)).length;

              return (
                <GlassCard key={dear.id} hover className="p-5 animate-slide-up">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">{dear.week} - {dear.term}</h3>
                      <p className="text-sm text-slate-500">Due {formatDate(dear.due_date)}</p>
                    </div>
                    {isOverdue(dear.due_date) && <Badge color="red">Overdue</Badge>}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full gradient-bg rounded-full transition-all"
                        style={{ width: `${students.length > 0 ? (completed / students.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{completed}/{students.length}</span>
                  </div>
                  <button
                    onClick={() => navigate(`/teacher/grade/${dear.id}`)}
                    className="text-sm text-[var(--primary-color)] font-medium hover:underline"
                  >
                    Review submissions →
                  </button>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Student list */}
      <div>
        <h2 className="text-xl font-semibold text-slate-700 mb-4">Students</h2>
        {students.length === 0 ? (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>}
            title="No students yet"
            subtitle="Students will appear here once they sign up."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {students.map((student, i) => {
              const latest = student.submissions[0];
              const status = latest?.status ?? 'not_started';
              const color = getStatusColor(status);
              const isOnline = onlineStudents.includes(student.id);

              return (
                <GlassCard key={student.id} hover className="p-4 animate-slide-up">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                      <Avatar url={student.avatar_url} name={`${student.first_name} ${student.last_name}`} size={44} />
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{student.first_name} {student.last_name}</p>
                      <p className="text-xs text-slate-400 truncate">{student.email}</p>
                    </div>
                    <span className={`status-dot status-${color}`} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge color={color}>{getStatusLabel(status)}</Badge>
                    <div className="flex gap-1">
                      <button
                        onClick={() => navigate(`/teacher/peek/${student.id}`)}
                        className="p-2 rounded-lg hover:bg-white/40 transition text-slate-500"
                        title="Peek at work"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      </button>
                      <button
                        onClick={() => navigate(`/teacher/messages/${student.id}`)}
                        className="p-2 rounded-lg hover:bg-white/40 transition text-slate-500"
                        title="Message"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                      </button>
                    </div>
                  </div>
                  {latest?.last_activity && (
                    <p className="text-xs text-slate-400 mt-2">Last active {formatRelative(latest.last_activity)}</p>
                  )}
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
