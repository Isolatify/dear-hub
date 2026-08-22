import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { GlassCard, Badge, EmptyState, Avatar, Spinner } from '@/components/ui';
import { formatRelative } from '@/lib/utils';
import type { Profile, DearSubmission, Dear } from '@/types';

export function LiveActivity() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<Profile[]>([]);
  const [submissions, setSubmissions] = useState<Map<string, DearSubmission & { dear: Dear }>>(new Map());
  const [onlineStudents, setOnlineStudents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();

    const subChannel = supabase
      .channel('live-submissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dear_submissions' }, (payload: any) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          loadSubmission(payload.new.student_id);
        } else {
          load();
        }
      })
      .subscribe();

    // Track student presence across all DEAR rooms
    const presenceChannel = supabase.channel('global-student-presence');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        setOnlineStudents(Object.keys(state));
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        setOnlineStudents((prev) => prev.includes(key) ? prev : [...prev, key]);
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setOnlineStudents((prev) => prev.filter((id) => id !== key));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  const load = async () => {
    const { data: studentData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('first_name');

    setStudents((studentData ?? []) as Profile[]);

    const { data: subData } = await supabase
      .from('dear_submissions')
      .select('*, dear:dears(*)')
      .order('last_activity', { ascending: false });

    const map = new Map<string, DearSubmission & { dear: Dear }>();
    (subData ?? []).forEach((s: any) => {
      if (!map.has(s.student_id)) map.set(s.student_id, s);
    });
    setSubmissions(map);
    setLoading(false);
  };

  const loadSubmission = async (studentId: string) => {
    const { data } = await supabase
      .from('dear_submissions')
      .select('*, dear:dears(*)')
      .eq('student_id', studentId)
      .order('last_activity', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setSubmissions((prev) => {
        const next = new Map(prev);
        next.set(studentId, data as DearSubmission & { dear: Dear });
        return next;
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-semibold text-slate-800">Live Activity</h1>
        <p className="text-slate-500 mt-1">See who's online and what students are working on right now.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <GlassCard className="p-4">
          <p className="text-sm text-slate-500">Online Now</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
            <p className="text-2xl font-semibold text-green-500">{onlineStudents.length}</p>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-sm text-slate-500">Working Now</p>
          <p className="text-2xl font-semibold text-amber-500 mt-1">
            {Array.from(submissions.values()).filter((s) => s.status === 'draft').length}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-sm text-slate-500">Submitted</p>
          <p className="text-2xl font-semibold text-green-500 mt-1">
            {Array.from(submissions.values()).filter((s) => ['submitted', 'approved'].includes(s.status)).length}
          </p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-sm text-slate-500">Not Started</p>
          <p className="text-2xl font-semibold text-red-500 mt-1">
            {students.length - submissions.size}
          </p>
        </GlassCard>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
          title="No students yet"
          subtitle="Students will appear here once they sign up."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {students.map((student) => {
            const sub = submissions.get(student.id);
            const isOnline = onlineStudents.includes(student.id);
            const isWorking = sub?.status === 'draft';

            return (
              <GlassCard key={student.id} hover className="p-4 animate-slide-up">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative">
                    <Avatar url={student.avatar_url} name={`${student.first_name} ${student.last_name}`} size={44} />
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 truncate">{student.first_name} {student.last_name}</p>
                    <div className="flex items-center gap-2">
                      {isOnline ? (
                        <Badge color="green">Online</Badge>
                      ) : sub?.last_activity ? (
                        <span className="text-xs text-slate-400">{formatRelative(sub.last_activity)}</span>
                      ) : (
                        <span className="text-xs text-slate-400">Never active</span>
                      )}
                    </div>
                  </div>
                </div>

                {sub ? (
                  <div className="glass-input rounded-lg p-2.5 mb-3">
                    <p className="text-xs text-slate-400">Working on</p>
                    <p className="text-sm text-slate-700">{sub.dear?.week} - {sub.dear?.term}</p>
                    {isWorking && isOnline && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs text-amber-500">Typing now...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mb-3">No DEAR started yet</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/teacher/peek/${student.id}`)}
                    className="flex-1 glass-input rounded-lg py-2 text-sm text-slate-600 hover:bg-white/60 transition flex items-center justify-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    Peek
                  </button>
                  <button
                    onClick={() => navigate(`/teacher/messages/${student.id}`)}
                    className="flex-1 glass-input rounded-lg py-2 text-sm text-slate-600 hover:bg-white/60 transition flex items-center justify-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    Message
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
