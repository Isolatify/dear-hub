import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { GlassCard, Badge, Spinner, Avatar } from '@/components/ui';
import { WordProcessor } from '@/components/WordProcessor';
import { formatRelative } from '@/lib/utils';
import type { Profile, DearSubmission, Dear } from '@/types';

export function PeekScreen() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Profile | null>(null);
  const [submissions, setSubmissions] = useState<(DearSubmission & { dear: Dear })[]>([]);
  const [selectedSub, setSelectedSub] = useState<DearSubmission & { dear: Dear } | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveContent, setLiveContent] = useState('');
  const [notified, setNotified] = useState(false);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    load();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [studentId]);

  const load = async () => {
    const { data: studentData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();
    setStudent(studentData as Profile);

    const { data: subData } = await supabase
      .from('dear_submissions')
      .select('*, dear:dears(*)')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false });

    const subs = (subData ?? []) as (DearSubmission & { dear: Dear })[];
    setSubmissions(subs);
    if (subs.length > 0) {
      setSelectedSub(subs[0]);
      setLiveContent(subs[0].content);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!selectedSub || !studentId) return;

    // Notify the student that teacher is peeking
    const dearId = selectedSub.dear_id;
    const channel = supabase.channel(`dear-workspace-${dearId}`);
    channelRef.current = channel;

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && !notified) {
        await channel.send({ type: 'broadcast', event: 'teacher-peek', payload: { teacher: true } });
        setNotified(true);
      }
    });

    // Listen for real-time updates to the submission
    const subChannel = supabase
      .channel(`peek-${selectedSub.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'dear_submissions',
        filter: `id=eq.${selectedSub.id}`,
      }, (payload: any) => {
        if (payload.new?.content) {
          setLiveContent(payload.new.content);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(subChannel);
      setNotified(false);
    };
  }, [selectedSub, studentId]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  if (!student) {
    return <div className="p-8 text-center"><p className="text-slate-500">Student not found.</p></div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <button
          onClick={() => navigate('/teacher/live')}
          className="text-sm text-slate-500 hover:text-slate-700 mb-2 flex items-center gap-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Back to Live Activity
        </button>
        <div className="flex items-center gap-4">
          <Avatar url={student.avatar_url} name={`${student.first_name} ${student.last_name}`} size={56} />
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">{student.first_name} {student.last_name}</h1>
            <p className="text-sm text-slate-500">{student.email}</p>
          </div>
          <Badge color="blue">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Live Peek
            </span>
          </Badge>
        </div>
      </div>

      {submissions.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <p className="text-slate-500">This student hasn't started any DEARs yet.</p>
        </GlassCard>
      ) : (
        <>
          {/* DEAR selector */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {submissions.map((sub) => (
              <button
                key={sub.id}
                onClick={() => { setSelectedSub(sub); setLiveContent(sub.content); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                  selectedSub?.id === sub.id
                    ? 'glass text-[var(--primary-color)]'
                    : 'text-slate-500 hover:bg-white/30'
                }`}
              >
                {sub.dear.week} - {sub.dear.term}
              </button>
            ))}
          </div>

          {/* Live content */}
          <GlassCard className="p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-slate-700">Live Document</h3>
              <span className="text-xs text-slate-400">
                Last update: {selectedSub?.last_activity ? formatRelative(selectedSub.last_activity) : 'N/A'}
              </span>
            </div>
            <div className="h-[500px]">
              <WordProcessor
                initialContent={liveContent}
                onChange={() => {}}
                readOnly
                showToolbar={false}
              />
            </div>
          </GlassCard>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => navigate(`/teacher/grade/${selectedSub?.dear_id}`)}
              className="btn-primary flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
              Go to Grading
            </button>
            <button
              onClick={() => navigate(`/teacher/messages/${student.id}`)}
              className="btn-ghost flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              Message
            </button>
          </div>
        </>
      )}
    </div>
  );
}
