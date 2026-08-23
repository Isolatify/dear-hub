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
  const [editing, setEditing] = useState<Dear | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('dears').select('*').order('created_at', { ascending: false });
      setDears((data ?? []) as Dear[]);
      setLoading(false);
    };
    load();
  }, []);

  const updateDear = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const { data, error } = await supabase.from('dears').update({
      week: String(form.get('week') ?? '').trim(),
      term: String(form.get('term') ?? '').trim(),
      due_date: String(form.get('due_date') ?? ''),
      status: String(form.get('status') ?? 'active'),
      updated_at: new Date().toISOString(),
    }).eq('id', editing.id).select('*').single();
    if (error) window.alert(error.message);
    if (data) setDears((current) => current.map((dear) => dear.id === data.id ? data as Dear : dear));
    setSaving(false);
    setEditing(null);
  };

  const deleteDear = async (dear: Dear) => {
    if (!window.confirm(`Delete ${dear.week} - ${dear.term}? This also removes its submissions.`)) return;
    const { error } = await supabase.from('dears').delete().eq('id', dear.id);
    if (error) window.alert(error.message);
    else setDears((current) => current.filter((item) => item.id !== dear.id));
  };

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
                {dear.status === 'draft' ? <Badge color="yellow">Draft</Badge> : isOverdue(dear.due_date) && <Badge color="red">Overdue</Badge>}
              </div>
              <p className="text-sm text-app-secondary mb-4">Due {formatDate(dear.due_date)}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate(`/teacher/grade/${dear.id}`)} className="btn-primary text-sm">View submissions</button>
                <button onClick={() => setEditing(dear)} className="btn-ghost text-sm">Edit</button>
                <button onClick={() => deleteDear(dear)} className="text-sm text-red-500 hover:text-red-700">Delete</button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onClick={() => setEditing(null)}>
          <form className="glass rounded-2xl p-6 w-full max-w-md space-y-4" onSubmit={updateDear} onClick={(event) => event.stopPropagation()}>
            <div><h2 className="text-xl font-semibold text-app-primary">Edit DEAR</h2><p className="text-sm text-app-muted mt-1">Update the assignment details or save it as a draft.</p></div>
            <input name="week" defaultValue={editing.week} required className="glass-input w-full rounded-xl px-4 py-3" placeholder="Week" />
            <input name="term" defaultValue={editing.term} required className="glass-input w-full rounded-xl px-4 py-3" placeholder="Term" />
            <input name="due_date" type="date" defaultValue={editing.due_date} required className="glass-input w-full rounded-xl px-4 py-3" />
            <select name="status" defaultValue={editing.status} className="glass-input w-full rounded-xl px-4 py-3">
              <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
            </select>
            <div className="flex gap-2"><button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save changes'}</button><button type="button" onClick={() => setEditing(null)} className="btn-ghost flex-1">Cancel</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
