import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { GlassCard, EmptyState, Badge, Spinner, Avatar } from '@/components/ui';
import { formatDate, getStatusColor, getStatusLabel } from '@/lib/utils';
import type { Dear, DearSubmission, Profile } from '@/types';

type SubmissionRow = DearSubmission & { dear: Dear; student: Profile };

export function TeacherSubmissionsScreen() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dears, setDears] = useState<Dear[]>([]);
  const [selectedDear, setSelectedDear] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      const [dearsResult, subsResult] = await Promise.all([
        supabase.from('dears').select('*').order('created_at', { ascending: false }),
        supabase.from('dear_submissions').select('*, dear:dears(*)').order('updated_at', { ascending: false }),
      ]);

      const allDears = (dearsResult.data ?? []) as Dear[];
      setDears(allDears);

      // Auto-select the latest DEAR
      if (allDears.length > 0 && !selectedDear) {
        setSelectedDear(allDears[0].id);
      }

      const rows = (subsResult.data ?? []) as Array<DearSubmission & { dear: Dear }>;
      const ids = [...new Set(rows.map((row) => row.student_id))];
      const { data: students } = ids.length ? await supabase.from('profiles').select('*').in('id', ids) : { data: [] };
      const studentMap = new Map((students ?? []).map((student) => [student.id, student as Profile]));
      setSubmissions(rows.filter((row) => {
        const student = studentMap.get(row.student_id);
        return student && student.role === 'student';
      }).map((row) => ({ ...row, student: studentMap.get(row.student_id)! })));
      setLoading(false);
    };
    load();
  }, []);

  const selectedDearData = useMemo(() => dears.find((d) => d.id === selectedDear), [dears, selectedDear]);

  // Get submissions for the selected DEAR only
  const dearSubmissions = useMemo(() => {
    return submissions.filter((s) => s.dear_id === selectedDear);
  }, [submissions, selectedDear]);

  // Apply status filter
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return dearSubmissions;
    return dearSubmissions.filter((s) => s.status === statusFilter);
  }, [dearSubmissions, statusFilter]);

  const stats = useMemo(() => ({
    total: dearSubmissions.length,
    submitted: dearSubmissions.filter((s) => s.status === 'submitted').length,
    approved: dearSubmissions.filter((s) => s.status === 'approved').length,
    failed: dearSubmissions.filter((s) => s.status === 'failed').length,
    draft: dearSubmissions.filter((s) => s.status === 'draft' || s.status === 'not_started').length,
  }), [dearSubmissions]);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Submissions</h1>
          <p className="text-slate-500 mt-1">Review student work for the latest DEAR.</p>
        </div>
        <select
          value={selectedDear}
          onChange={(e) => setSelectedDear(e.target.value)}
          className="submissions-dear-select"
        >
          {dears.map((dear) => (
            <option key={dear.id} value={dear.id}>{dear.week} - {dear.term}</option>
          ))}
        </select>
      </div>

      {/* Selected DEAR info */}
      {selectedDearData && (
        <GlassCard className="p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">{selectedDearData.week} — {selectedDearData.term}</h2>
              <p className="text-sm text-slate-500">Due {formatDate(selectedDearData.due_date)}</p>
            </div>
            <Badge color={selectedDearData.status === 'active' ? 'green' : selectedDearData.status === 'draft' ? 'yellow' : 'slate'}>
              {selectedDearData.status}
            </Badge>
          </div>
        </GlassCard>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700' },
          { label: 'Submitted', value: stats.submitted, color: 'text-blue-500' },
          { label: 'Approved', value: stats.approved, color: 'text-green-500' },
          { label: 'Failed', value: stats.failed, color: 'text-red-500' },
        ].map((stat) => (
          <GlassCard key={stat.label} className="p-4 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
          </GlassCard>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {(['all', 'submitted', 'approved', 'failed', 'draft'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`submissions-tab ${statusFilter === status ? 'submissions-tab-active' : ''}`}
          >
            {status === 'all' ? 'All' : getStatusLabel(status)}
            {status !== 'all' && (
              <span className="submissions-tab-count">
                {status === 'submitted' ? stats.submitted : status === 'approved' ? stats.approved : status === 'failed' ? stats.failed : stats.draft}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Student list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
          title="No submissions found"
          subtitle={statusFilter !== 'all' ? 'Try a different filter.' : 'Students will appear once they start working.'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((submission) => (
            <div key={submission.id} className="submissions-row" onClick={() => navigate(`/teacher/grade/${submission.dear_id}`)}>
              <Avatar url={submission.student.avatar_url} name={`${submission.student.first_name} ${submission.student.last_name}`} size={40} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-700 truncate">{submission.student.first_name} {submission.student.last_name}</p>
                <p className="text-xs text-slate-400">{submission.student.email}</p>
              </div>
              <div className="hidden sm:flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Updated</p>
                  <p className="text-sm text-slate-500">{formatDate(submission.updated_at)}</p>
                </div>
                {submission.content && (
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Words</p>
                    <p className="text-sm text-slate-500">{submission.content.split(/\s+/).filter(Boolean).length}</p>
                  </div>
                )}
              </div>
              <Badge color={getStatusColor(submission.status)}>{getStatusLabel(submission.status)}</Badge>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-300"><polyline points="9 18 15 12 9 6" /></svg>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
