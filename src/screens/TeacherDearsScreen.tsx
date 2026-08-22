import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { GlassCard, EmptyState, Badge, Spinner } from '@/components/ui';
import { formatDate, isOverdue } from '@/lib/utils';
import type { Dear } from '@/types';

export function TeacherDearsScreen() {
  const navigate = useNavigate();
  const [dears, setDears] = useState<Dear[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('dears').select('*').order('created_at', { ascending: false });
      setDears((data ?? []) as Dear[]);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-app-primary">DEARs</h1>
          <p className="text-app-secondary mt-1">All DEAR assignments, including past and archived work.</p>
        </div>
        <button onClick={() => navigate('/teacher/create')} className="btn-primary">Create DEAR</button>
      </div>
      {dears.length === 0 ? (
        <EmptyState icon={<span className="text-3xl">+</span>} title="No DEARs yet" subtitle="Create your first assignment to get started." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dears.map((dear) => (
            <GlassCard key={dear.id} hover className="p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-app-primary">{dear.week} - {dear.term}</h2>
                  <p className="text-sm text-app-muted mt-1">Created {formatDate(dear.created_at)}</p>
                </div>
                {isOverdue(dear.due_date) && dear.status === 'active' && <Badge color="red">Overdue</Badge>}
              </div>
              <p className="text-sm text-app-secondary mb-4">Due {formatDate(dear.due_date)}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(`/teacher/grade/${dear.id}`)} className="btn-primary text-sm">View submissions</button>
                <button onClick={() => navigate(`/teacher/grade/${dear.id}`)} className="btn-ghost text-sm">Open DEAR</button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
