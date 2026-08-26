import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Badge, Spinner, EmptyState, Avatar } from '@/components/ui';
import { PdfViewer } from '@/components/PdfViewer';
import { WordProcessor } from '@/components/WordProcessor';
import { analyzeTextWithSapling } from '@/lib/aiChecker';
import { getStatusLabel, getStatusColor, formatDate, formatRelative } from '@/lib/utils';
import type { Dear, DearSubmission, Profile, AiScore } from '@/types';

interface SubmissionWithStudent extends DearSubmission {
  student: Profile;
}

export function GradeScreen() {
  const { dearId } = useParams<{ dearId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [dear, setDear] = useState<Dear | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionWithStudent[]>([]);
  const [selected, setSelected] = useState<SubmissionWithStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [aiScore, setAiScore] = useState<AiScore | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMobileList, setShowMobileList] = useState(true);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`grade-${dearId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dear_submissions', filter: `dear_id=eq.${dearId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dearId]);

  const load = async () => {
    const { data: dearData } = await supabase.from('dears').select('*').eq('id', dearId).maybeSingle();
    setDear(dearData as Dear);

    const { data: subData } = await supabase.from('dear_submissions').select('*').eq('dear_id', dearId);
    if (!subData || subData.length === 0) { setLoading(false); return; }

    const studentIds = subData.map((s) => s.student_id);
    const { data: students } = await supabase.from('profiles').select('*').in('id', studentIds);
    const studentMap = new Map<string, Profile>();
    (students ?? []).forEach((s) => studentMap.set(s.id, s as Profile));

    const combined = subData.map((s) => ({ ...(s as DearSubmission), student: studentMap.get(s.student_id)! }));
    setSubmissions(combined.filter((s) => s.student && s.student.role === 'student'));

    if (combined.length > 0) {
      if (!selected) {
        const firstUngraded = combined.find((s) => s.status === 'submitted') ?? combined[0];
        setSelected(firstUngraded);
        setFeedback(firstUngraded.feedback ?? '');
      } else {
        const updated = combined.find((s) => s.id === selected.id);
        if (updated) { setSelected(updated); setFeedback(updated.feedback ?? ''); }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selected) {
      setFeedback(selected.feedback ?? '');
      setAiScore(selected.ai_score as AiScore | null);

      // Auto-run AI check if no score exists and student has content
      if (!selected.ai_score && selected.content && selected.content.trim().length > 50) {
        runAiCheck();
      }
    }
  }, [selected?.id]);

  const runAiCheck = async () => {
    if (!selected || !selected.content) return;
    setAnalyzing(true);
    try {
      const score = await analyzeTextWithSapling(selected.content);
      setAiScore(score);
      await supabase.from('dear_submissions').update({
        ai_score: score as any,
        ai_analysis: score.verdict === 'likely_ai'
          ? `Likely AI (${score.ai_probability}% confidence)`
          : score.verdict === 'likely_human'
          ? `Likely Human (${score.human_probability}% confidence)`
          : `Mixed signals (${score.ai_probability}% AI / ${score.human_probability}% Human)`,
      }).eq('id', selected.id);
    } catch (err) {
      console.error('AI check failed:', err);
      toast('AI check failed. Try again.', 'error');
    }
    setAnalyzing(false);
  };

  const goToNext = async () => {
    // Re-fetch fresh data instead of relying on stale state
    const { data: dearData } = await supabase.from('dears').select('*').eq('id', dearId).maybeSingle();
    const { data: subData } = await supabase.from('dear_submissions').select('*').eq('dear_id', dearId);
    if (!subData || subData.length === 0) { navigate('/teacher/submissions'); return; }

    const studentIds = subData.map((s) => s.student_id);
    const { data: students } = await supabase.from('profiles').select('*').in('id', studentIds);
    const studentMap = new Map<string, Profile>();
    (students ?? []).forEach((s) => studentMap.set(s.id, s as Profile));
    const freshSubs = subData.map((s) => ({ ...(s as DearSubmission), student: studentMap.get(s.student_id)! })).filter((s) => s.student && s.student.role === 'student');

    const next = freshSubs.find((s) => s.id !== selected?.id && s.status !== 'approved' && s.status !== 'failed');
    setSubmissions(freshSubs);
    if (next) {
      setSelected(next);
      setFeedback(next.feedback ?? '');
      setAiScore(next.ai_score as AiScore | null);
    } else {
      toast('All submissions graded!', 'success');
      navigate('/teacher/submissions');
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    setSaving(true);
    await supabase.from('dear_submissions').update({
      status: 'approved', feedback: feedback || null,
      reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', selected.id);
    await supabase.from('activity_logs').insert({ student_id: selected.student_id, action: 'dear_approved', detail: `${dear?.week} - ${dear?.term}` });
    toast(`Approved ${selected.student.first_name}'s work`, 'success');
    setFeedback('');
    setSaving(false);
    goToNext();
  };

  const handleFail = async () => {
    if (!selected) return;
    setSaving(true);
    await supabase.from('dear_submissions').update({
      status: 'failed', feedback: feedback || 'Please review and redo this DEAR.',
      reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq('id', selected.id);
    await supabase.from('activity_logs').insert({ student_id: selected.student_id, action: 'dear_failed', detail: `${dear?.week} - ${dear?.term}` });
    toast(`Failed ${selected.student.first_name}'s work`, 'info');
    setFeedback('');
    setSaving(false);
    goToNext();
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  if (!dear) return <div className="p-8 text-center"><p className="text-slate-500">DEAR not found.</p><button onClick={() => navigate('/teacher/submissions')} className="btn-primary mt-4">Back</button></div>;

  const gradedCount = submissions.filter((s) => s.status === 'approved' || s.status === 'failed').length;
  const progress = submissions.length > 0 ? (gradedCount / submissions.length) * 100 : 0;

  return (
    <div className="grade-layout">
      {/* ─── Student Sidebar ─── */}
      <div className={`grade-sidebar ${showMobileList ? '' : 'hidden lg:block'}`}>
        <div className="grade-sidebar-header">
          <button onClick={() => navigate('/teacher/submissions')} className="p-2 rounded-lg hover:bg-white/40 transition text-slate-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-slate-800 truncate">{dear.week} — {dear.term}</h2>
            <p className="text-xs text-slate-400">{gradedCount}/{submissions.length} graded</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="grade-progress-bar">
          <div className="grade-progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Student list */}
        <div className="grade-student-list">
          {submissions.map((sub) => {
            const isSelected = selected?.id === sub.id;
            const statusColor = getStatusColor(sub.status);
            return (
              <button
                key={sub.id}
                onClick={() => { setSelected(sub); setShowMobileList(false); }}
                className={`grade-student-item ${isSelected ? 'grade-student-item-active' : ''}`}
              >
                <Avatar url={sub.student.avatar_url} name={`${sub.student.first_name} ${sub.student.last_name}`} size={36} />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-slate-700 truncate">{sub.student.first_name} {sub.student.last_name}</p>
                  <p className="text-xs text-slate-400">{getStatusLabel(sub.status)}</p>
                </div>
                <span className={`status-dot status-${statusColor}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className={`grade-main ${showMobileList ? 'hidden lg:flex' : 'flex'}`}>
        {/* Mobile back button */}
        <div className="lg:hidden flex items-center gap-2 mb-3">
          <button onClick={() => setShowMobileList(true)} className="p-2 rounded-lg hover:bg-white/40 transition text-slate-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div>
            <p className="text-sm font-medium text-slate-700">{selected?.student.first_name} {selected?.student.last_name}</p>
            <p className="text-xs text-slate-400">{getStatusLabel(selected?.status ?? 'draft')}</p>
          </div>
        </div>

        {submissions.length === 0 ? (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
            title="No submissions yet"
            subtitle="Students' work will appear here once they start."
          />
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row gap-3 min-h-0">
            {/* PDF + Student Work */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              {/* Original PDF */}
              <div className="flex-1 min-h-[200px]">
                <div className="grade-pane-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <span>Original PDF</span>
                </div>
                <div className="h-[calc(100%-2rem)]">
                  <PdfViewer url={dear.pdf_url} />
                </div>
              </div>

              {/* Student Work */}
              <div className="flex-1 min-h-[200px]">
                <div className="grade-pane-header">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                  <span>{selected?.student.first_name}'s Work</span>
                  {selected?.last_activity && <span className="text-xs text-slate-400 ml-auto">Last active {formatRelative(selected.last_activity)}</span>}
                </div>
                <div className="h-[calc(100%-2rem)]">
                  <WordProcessor initialContent={selected?.content ?? ''} onChange={() => {}} readOnly showToolbar={false} />
                </div>
              </div>
            </div>

            {/* AI + Feedback Panel */}
            <div className="w-full lg:w-80 flex-shrink-0 overflow-auto space-y-3">
              {/* AI Checker */}
              <div className="grade-panel">
                <div className="grade-panel-header">
                  <h3 className="font-semibold text-slate-700">AI Checker</h3>
                  <button onClick={runAiCheck} disabled={analyzing} className="grade-panel-btn">
                    {analyzing ? <><Spinner size={14} /> Analyzing...</> : 'Run Check'}
                  </button>
                </div>

                {aiScore ? (
                  <div className="space-y-3 animate-fade-in">
                    {/* Verdict */}
                    <div className={`grade-verdict ${aiScore.verdict === 'likely_ai' ? 'grade-verdict-ai' : aiScore.verdict === 'likely_human' ? 'grade-verdict-human' : 'grade-verdict-mixed'}`}>
                      <p className={`text-xl font-bold ${aiScore.verdict === 'likely_ai' ? 'text-red-500' : aiScore.verdict === 'likely_human' ? 'text-green-500' : 'text-amber-500'}`}>
                        {aiScore.verdict === 'likely_ai' ? 'Likely AI' : aiScore.verdict === 'likely_human' ? 'Likely Human' : 'Mixed'}
                      </p>
                      <div className="flex justify-center gap-6 mt-2">
                        <span className="text-sm text-red-500">AI {aiScore.ai_probability}%</span>
                        <span className="text-sm text-green-500">Human {aiScore.human_probability}%</span>
                      </div>
                      {/* Visual bar */}
                      <div className="h-2 rounded-full bg-slate-200 mt-3 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${aiScore.ai_probability}%`, background: aiScore.ai_probability > 60 ? '#ef4444' : aiScore.ai_probability > 40 ? '#f59e0b' : '#22c55e' }} />
                      </div>
                    </div>

                    {/* Signals */}
                    {aiScore.signals.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-400 uppercase">Signals</p>
                        {aiScore.signals.map((sig, i) => (
                          <div key={i} className={`grade-signal ${sig.points_to === 'ai' ? 'grade-signal-ai' : 'grade-signal-human'}`}>
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-xs font-medium text-slate-700">{sig.label}</p>
                              <Badge color={sig.points_to === 'ai' ? 'red' : 'green'}>{sig.weight}</Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">{sig.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">Run the AI checker to analyze this submission.</p>
                )}
              </div>

              {/* Feedback + Actions */}
              <div className="grade-panel">
                <h3 className="font-semibold text-slate-700 mb-3">Feedback</h3>
                {selected?.status === 'approved' || selected?.status === 'failed' ? (
                  <div className="mb-3">
                    <p className="text-sm text-slate-500 italic">This submission has already been {selected.status}.</p>
                  </div>
                ) : (
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="grade-textarea"
                    rows={4}
                    placeholder="Write feedback for the student..."
                  />
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleApprove}
                    disabled={saving || !selected || selected.status === 'approved' || selected.status === 'failed'}
                    className={`grade-action-btn grade-action-approve ${selected?.status === 'approved' || selected?.status === 'failed' ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    {selected?.status === 'approved' ? 'Approved' : 'Approve'}
                  </button>
                  <button
                    onClick={handleFail}
                    disabled={saving || !selected || selected.status === 'approved' || selected.status === 'failed'}
                    className={`grade-action-btn grade-action-fail ${selected?.status === 'approved' || selected?.status === 'failed' ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    {selected?.status === 'failed' ? 'Failed' : 'Fail'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">Failing sends the student back to redo this DEAR.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
