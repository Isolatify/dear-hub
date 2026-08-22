import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('dear_submissions').select('*, dear:dears(*)').order('updated_at', { ascending: false });
      const rows = (data ?? []) as Array<DearSubmission & { dear: Dear }>;
      const ids = rows.map((row) => row.student_id);
      const { data: students } = ids.length ? await supabase.from('profiles').select('*').in('id', ids) : { data: [] };
      const studentMap = new Map((students ?? []).map((student) => [student.id, student as Profile]));
      setSubmissions(rows.filter((row) => studentMap.has(row.student_id)).map((row) => ({ ...row, student: studentMap.get(row.student_id)! })));
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-app-primary">Submissions</h1>
        <p className="text-app-secondary mt-1">Review current and past student submissions.</p>
      </div>
      {submissions.length === 0 ? (
        <EmptyState icon={<span className="text-3xl">✓</span>} title="No submissions yet" subtitle="Student work will appear here after a DEAR is started." />
      ) : (
        <div className="space-y-3">
          {submissions.map((submission) => (
            <GlassCard key={submission.id} className="p-4 flex flex-wrap items-center gap-4">
              <Avatar url={submission.student.avatar_url} name={`${submission.student.first_name} ${submission.student.last_name}`} size={44} />
              <div className="flex-1 min-w-[180px]">
                <p className="font-medium text-app-primary">{submission.student.username ? `@${submission.student.username}` : `${submission.student.first_name} ${submission.student.last_name}`}</p>
                <p className="text-sm text-app-muted">{submission.student.first_name} {submission.student.last_name} · {submission.dear.week} - {submission.dear.term}</p>
              </div>
              <div className="text-sm text-app-secondary">Updated {formatDate(submission.updated_at)}</div>
              <Badge color={getStatusColor(submission.status)}>{getStatusLabel(submission.status)}</Badge>
              <button onClick={() => navigate(`/teacher/grade/${submission.dear_id}`)} className="btn-primary text-sm">Review</button>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
