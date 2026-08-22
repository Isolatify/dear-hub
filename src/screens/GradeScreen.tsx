import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { GlassCard, Badge, Spinner, EmptyState, Avatar } from '@/components/ui';
import { PdfViewer } from '@/components/PdfViewer';
import { WordProcessor } from '@/components/WordProcessor';
import { analyzeText } from '@/lib/aiChecker';
import { getStatusLabel, getStatusColor, formatDate, formatRelative } from '@/lib/utils';
import type { Dear, DearSubmission, Profile, AiScore } from '@/types';

interface SubmissionWithStudent extends DearSubmission {
  student: Profile;
}

export function GradeScreen() {
  const { dearId } = useParams<{ dearId: string }>();
  const navigate = useNavigate();
  const [dear, setDear] = useState<Dear | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionWithStudent[]>([]);
  const [selected, setSelected] = useState<SubmissionWithStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState('');
  const [aiScore, setAiScore] = useState<AiScore | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`grade-${dearId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dear_submissions', filter: `dear_id=eq.${dearId}` }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dearId]);

  const load = async () => {
    const { data: dearData } = await supabase
      .from('dears')
      .select('*')
      .eq('id', dearId)
      .maybeSingle();
    setDear(dearData as Dear);

    const { data: subData } = await supabase
      .from('dear_submissions')
      .select('*')
      .eq('dear_id', dearId);

    if (!subData || subData.length === 0) {
      setLoading(false);
      return;
    }

    const studentIds = subData.map((s) => s.student_id);
    const { data: students } = await supabase
      .from('profiles')
      .select('*')
      .in('id', studentIds);

    const studentMap = new Map<string, Profile>();
    (students ?? []).forEach((s) => studentMap.set(s.id, s as Profile));

    const combined = subData.map((s) => ({
      ...(s as DearSubmission),
      student: studentMap.get(s.student_id)!,
    }));

    setSubmissions(combined.filter((s) => s.student));
    if (combined.length > 0 && !selected) {
      setSelected(combined[0]);
      setFeedback(combined[0].feedback ?? '');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selected) {
      setFeedback(selected.feedback ?? '');
      setAiScore(selected.ai_score as AiScore | null);
    }
  }, [selected]);

  const runAiCheck = () => {
    if (!selected) return;
    setAnalyzing(true);
    setTimeout(() => {
      const score = analyzeText(selected.content);
      setAiScore(score);

      supabase
        .from('dear_submissions')
        .update({
          ai_score: score as any,
          ai_analysis: score.verdict === 'likely_ai'
            ? `Likely AI (${score.ai_probability}% confidence)`
            : score.verdict === 'likely_human'
            ? `Likely Human (${score.human_probability}% confidence)`
            : `Mixed signals (${score.ai_probability}% AI / ${score.human_probability}% Human)`,
        })
        .eq('id', selected.id);

      setAnalyzing(false);
    }, 1500);
  };

  const handleApprove = async () => {
    if (!selected) return;
    setSaving(true);
    await supabase
      .from('dear_submissions')
      .update({
        status: 'approved',
        feedback: feedback || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);

    await supabase.from('activity_logs').insert({
      student_id: selected.student_id,
      action: 'dear_approved',
      detail: `${dear?.week} - ${dear?.term}`,
    });

    setSaving(false);
    setFeedback('');
    load();
  };

  const handleFail = async () => {
    if (!selected) return;
    setSaving(true);
    await supabase
      .from('dear_submissions')
      .update({
        status: 'failed',
        feedback: feedback || 'Please review and redo this DEAR.',
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);

    await supabase.from('activity_logs').insert({
      student_id: selected.student_id,
      action: 'dear_failed',
      detail: `${dear?.week} - ${dear?.term}`,
    });

    setSaving(false);
    setFeedback('');
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  if (!dear) {
    return <div className="p-8 text-center"><p className="text-slate-500">DEAR not found.</p></div>;
  }

  return (
    <div className="flex flex-col h-screen p-3 lg:p-4">
      {/* Header */}
      <GlassCard className="p-4 mb-3 flex items-center justify-between flex-wrap gap-3 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/teacher/dashboard')} className="p-2 rounded-lg hover:bg-white/40 transition text-slate-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Grade: {dear.week} - {dear.term}</h1>
            <p className="text-xs text-slate-500">Due {formatDate(dear.due_date)}</p>
          </div>
        </div>
      </GlassCard>

      {submissions.length === 0 ? (
        <EmptyState
          icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
          title="No submissions yet"
          subtitle="Students' work will appear here once they start."
        />
      ) : (
        <div className="flex-1 flex gap-3 min-h-0">
          {/* Student list */}
          <div className="w-64 flex-shrink-0 overflow-auto">
            <div className="glass rounded-xl p-2 space-y-1">
              <p className="text-xs font-medium text-slate-400 px-3 py-2">SUBMISSIONS</p>
              {submissions.map((sub) => {
                const color = getStatusColor(sub.status);
                const isSelected = selected?.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSelected(sub)}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition ${
                      isSelected ? 'glass text-[var(--primary-color)]' : 'hover:bg-white/30 text-slate-600'
                    }`}
                  >
                    <Avatar url={sub.student.avatar_url} name={`${sub.student.first_name} ${sub.student.last_name}`} size={32} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate">{sub.student.first_name} {sub.student.last_name}</p>
                      <p className="text-xs text-slate-400">{getStatusLabel(sub.status)}</p>
                    </div>
                    <span className={`status-dot status-${color}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main grading area */}
          <div className="flex-1 flex gap-3 min-h-0">
            {/* PDF + student work */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <div className="flex-1 min-h-0">
                <div className="glass rounded-xl px-3 py-2 mb-2 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <span className="text-sm font-medium text-slate-600">Original PDF</span>
                </div>
                <div className="h-[calc(50%-2rem)]">
                  <PdfViewer url={dear.pdf_url} />
                </div>
              </div>

              <div className="flex-1 min-h-0">
                <div className="glass rounded-xl px-3 py-2 mb-2 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                  <span className="text-sm font-medium text-slate-600">{selected?.student.first_name}'s Work</span>
                  {selected?.last_activity && (
                    <span className="text-xs text-slate-400 ml-auto">Last active {formatRelative(selected.last_activity)}</span>
                  )}
                </div>
                <div className="h-[calc(50%-2rem)]">
                  <WordProcessor
                    initialContent={selected?.content ?? ''}
                    onChange={() => {}}
                    readOnly
                    showToolbar={false}
                  />
                </div>
              </div>
            </div>

            {/* AI Checker + feedback */}
            <div className="w-80 flex-shrink-0 overflow-auto space-y-3">
              {/* AI Checker */}
              <GlassCard className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" /><path d="M12 8v4l3 3" /></svg>
                    AI Checker
                  </h3>
                  <button
                    onClick={runAiCheck}
                    disabled={analyzing}
                    className="btn-ghost text-sm py-1.5 px-3 flex items-center gap-1"
                  >
                    {analyzing ? <Spinner size={16} /> : 'Run Check'}
                  </button>
                </div>

                {aiScore ? (
                  <div className="space-y-3 animate-fade-in">
                    <div className={`glass-input rounded-xl p-3 text-center ${aiScore.verdict === 'likely_ai' ? 'border-red-300' : aiScore.verdict === 'likely_human' ? 'border-green-300' : 'border-amber-300'}`}>
                      <p className={`text-2xl font-bold ${aiScore.verdict === 'likely_ai' ? 'text-red-500' : aiScore.verdict === 'likely_human' ? 'text-green-500' : 'text-amber-500'}`}>
                        {aiScore.verdict === 'likely_ai' ? 'Likely AI' : aiScore.verdict === 'likely_human' ? 'Likely Human' : 'Mixed'}
                      </p>
                      <div className="flex justify-center gap-4 mt-2 text-sm">
                        <span className="text-red-500">AI: {aiScore.ai_probability}%</span>
                        <span className="text-green-500">Human: {aiScore.human_probability}%</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-400">SIGNALS DETECTED</p>
                      {aiScore.signals.map((sig, i) => (
                        <div key={i} className={`glass-input rounded-lg p-2.5 ${sig.points_to === 'ai' ? 'border-l-2 border-l-red-400' : 'border-l-2 border-l-green-400'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-medium text-slate-700">{sig.label}</p>
                            <Badge color={sig.points_to === 'ai' ? 'red' : 'green'}>{sig.weight}</Badge>
                          </div>
                          <p className="text-xs text-slate-500">{sig.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-4">Run the AI checker to analyze the student's writing patterns.</p>
                )}
              </GlassCard>

              {/* Feedback */}
              <GlassCard className="p-4">
                <h3 className="font-semibold text-slate-700 mb-3">Feedback</h3>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="glass-input w-full rounded-xl px-4 py-3 text-slate-800 resize-none"
                  rows={4}
                  placeholder="Write feedback for the student (optional)..."
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleApprove}
                    disabled={saving || !selected}
                    className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                    Approve
                  </button>
                  <button
                    onClick={handleFail}
                    disabled={saving || !selected}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition flex items-center justify-center gap-2"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    Fail
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">Failing sends the student back to redo the DEAR.</p>
              </GlassCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
