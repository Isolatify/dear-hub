import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PdfViewer } from '@/components/PdfViewer';
import { WordProcessor } from '@/components/WordProcessor';
import { GlassCard, Spinner, Badge } from '@/components/ui';
import { getStatusLabel, formatDate } from '@/lib/utils';
import type { Dear, DearSubmission } from '@/types';

export function DearWorkspace() {
  const { dearId } = useParams<{ dearId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [dear, setDear] = useState<Dear | null>(null);
  const [submission, setSubmission] = useState<DearSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);
  const [submitting, setSubmitting] = useState(false);
  const [teacherPeeking, setTeacherPeeking] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const loadDear = useCallback(async () => {
    if (!dearId || !profile) return;

    const { data: dearData } = await supabase
      .from('dears')
      .select('*')
      .eq('id', dearId)
      .maybeSingle();

    if (!dearData) {
      setLoading(false);
      return;
    }

    setDear(dearData as Dear);

    const { data: subData } = await supabase
      .from('dear_submissions')
      .select('*')
      .eq('dear_id', dearId)
      .eq('student_id', profile.id)
      .maybeSingle();

    if (subData) {
      setSubmission(subData as DearSubmission);
    } else {
      // Create a new submission
      const { data: newSub } = await supabase
        .from('dear_submissions')
        .insert({
          dear_id: dearId,
          student_id: profile.id,
          content: '',
          status: 'draft',
          last_activity: new Date().toISOString(),
        })
        .select('*')
        .maybeSingle();

      if (newSub) setSubmission(newSub as DearSubmission);
    }

    setLoading(false);
  }, [dearId, profile]);

  useEffect(() => {
    loadDear();
  }, [loadDear]);

  // Real-time: listen for teacher peeking
  useEffect(() => {
    if (!dearId || !profile) return;

    const channel = supabase
      .channel(`dear-workspace-${dearId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'dear_submissions',
        filter: `dear_id=eq.${dearId}`,
      }, (payload) => {
        const nextSubmission = payload.new as Partial<DearSubmission>;
        if (nextSubmission.student_id === profile.id) {
          setSubmission(nextSubmission as DearSubmission);
        }
      })
      .on('broadcast', { event: 'teacher-peek' }, () => {
        setTeacherPeeking(true);
        setTimeout(() => setTeacherPeeking(false), 5000);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dearId, profile]);

  // Track presence in this DEAR
  useEffect(() => {
    if (!dearId || !profile) return;

    const channel = supabase.channel(`presence-dear-${dearId}`, {
      config: { presence: { key: profile.id } },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user_id: profile.id, online_at: new Date().toISOString() });
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, [dearId, profile]);

  const handleContentChange = (content: string) => {
    if (!submission || !profile) return;

    // Debounce save
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);

    saveTimer.current = setTimeout(async () => {
      await supabase
        .from('dear_submissions')
        .update({
          content,
          last_activity: new Date().toISOString(),
          status: submission.status === 'not_started' ? 'draft' : submission.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', submission.id);

      setSaving(false);
    }, 1000);
  };

  const handleSubmit = async () => {
    if (!submission) return;
    setSubmitting(true);

    await supabase
      .from('dear_submissions')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', submission.id);

    // Log activity
    await supabase.from('activity_logs').insert({
      student_id: profile!.id,
      action: 'submitted_dear',
      detail: `${dear?.week} - ${dear?.term}`,
    });

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#22c55e', '#3b82f6', '#06b6d4', '#f59e0b'],
    });

    setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } }), 200);
    setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } }), 400);

    setSubmitting(false);
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size={40} />
      </div>
    );
  }

  if (!dear) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500">DEAR not found.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary mt-4">Back to Dashboard</button>
      </div>
    );
  }

  const status = submission?.status ?? 'not_started';

  return (
    <div className="flex flex-col h-screen p-3 lg:p-4">
      {/* Header */}
      <GlassCard className="p-4 mb-3 flex items-center justify-between flex-wrap gap-3 animate-fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg hover:bg-white/40 transition text-slate-600"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">{dear.week} - {dear.term}</h1>
            <p className="text-xs text-slate-500">Due {formatDate(dear.due_date)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {teacherPeeking && (
            <Badge color="blue">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                Teacher is peeking
              </span>
            </Badge>
          )}
          <Badge color={status === 'submitted' ? 'green' : status === 'draft' ? 'yellow' : 'red'}>
            {getStatusLabel(status)}
          </Badge>
          {status !== 'submitted' && status !== 'approved' && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary flex items-center gap-2"
            >
              {submitting ? <Spinner size={18} /> : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                  Submit DEAR
                </>
              )}
            </button>
          )}
        </div>
      </GlassCard>

      {/* Split view */}
      <div ref={workspaceRef} className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0 overflow-auto" onPointerMove={(event) => {
        if (event.buttons !== 1 || !workspaceRef.current || window.innerWidth < 1024) return;
        const bounds = workspaceRef.current.getBoundingClientRect();
        setSplitRatio(Math.max(25, Math.min(75, ((event.clientX - bounds.left) / bounds.width) * 100)));
      }}>
        {/* PDF side */}
        <div style={{ width: `${splitRatio}%` }} className="workspace-pane flex flex-col min-w-0">
          <div className="glass rounded-xl px-3 py-2 mb-2 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            <span className="text-sm font-medium text-slate-600">Reading Material</span>
          </div>
          <div className="flex-1 min-h-0">
            <PdfViewer url={dear.pdf_url} />
          </div>
        </div>

        {/* Drag handle */}
        <div className="hidden lg:flex items-center">
          <div
            className="w-1 h-32 rounded-full bg-slate-200/50 cursor-col-resize hover:bg-[var(--primary-color)] transition"
            title="Drag to resize"
          />
        </div>

        {/* Word processor side */}
        <div style={{ width: `${100 - splitRatio}%` }} className="workspace-pane flex flex-col min-w-0">
          <div className="glass rounded-xl px-3 py-2 mb-2 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
            <span className="text-sm font-medium text-slate-600">Your Work</span>
            <span className={`text-xs ml-auto ${saving ? 'text-amber-500' : 'text-green-500'}`}>
              {saving ? 'Saving...' : 'Saved'}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <WordProcessor
              initialContent={submission?.content ?? ''}
              onChange={handleContentChange}
              readOnly={status === 'submitted' || status === 'approved'}
            />
          </div>
        </div>
      </div>

      {/* Feedback banner */}
      {submission?.feedback && (
        <GlassCard className="p-4 mt-3 animate-slide-up">
          <p className="text-xs text-slate-400 mb-1">Teacher Feedback</p>
          <p className="text-sm text-slate-700">{submission.feedback}</p>
        </GlassCard>
      )}
    </div>
  );
}
