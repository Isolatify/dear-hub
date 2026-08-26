import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { GlassCard, Badge, EmptyState, Spinner } from '@/components/ui';
import { getStatusColor, getStatusLabel, formatDate, isOverdue, getDaysUntil } from '@/lib/utils';
import type { Dear, DearSubmission } from '@/types';
import { Bookmark, BookmarkCheck, ChevronRight, BookOpen } from 'lucide-react';

interface DearWithSubmission extends Dear { submission?: DearSubmission; }

export function BookmarksPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [dears, setDears] = useState<DearWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dear-hub-bookmarks') ?? '[]')); } catch { return new Set(); }
  });

  useEffect(() => { load(); }, [profile, bookmarks]);

  const load = async () => {
    if (bookmarks.size === 0) { setLoading(false); return; }
    const { data: dearData } = await supabase.from('dears').select('*').in('id', [...bookmarks]).eq('status', 'active');
    if (!dearData) { setLoading(false); return; }
    const { data: subs } = await supabase.from('dear_submissions').select('*').eq('student_id', profile?.id);
    const subMap = new Map<string, DearSubmission>();
    (subs ?? []).forEach((s) => subMap.set(s.dear_id, s as DearSubmission));
    setDears(dearData.map((d) => ({ ...(d as Dear), submission: subMap.get(d.id) })));
    setLoading(false);
  };

  const toggleBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('dear-hub-bookmarks', JSON.stringify([...next]));
      return next;
    });
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <p className="text-sm font-medium text-[var(--primary-color)]">DEAR HUB</p>
        <h1 className="text-3xl font-semibold text-app-primary">Bookmarks</h1>
        <p className="text-app-secondary mt-1">Your pinned DEARs for quick access.</p>
      </div>

      {bookmarks.size === 0 ? (
        <EmptyState
          icon={<Bookmark size={48} />}
          title="No bookmarks yet"
          subtitle="Pin DEARs from the dashboard or My DEARs page to find them quickly."
        />
      ) : (
        <div className="space-y-3">
          {dears.map((dear, i) => {
            const status = dear.submission?.status ?? 'not_started';
            const color = getStatusColor(status);
            const overdue = isOverdue(dear.due_date) && status === 'not_started';
            const days = getDaysUntil(dear.due_date);

            return (
              <GlassCard key={dear.id} hover className="p-4 animate-slide-up" style={{ animationDelay: `${i * 30}ms` } as React.CSSProperties}>
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleBookmark(dear.id)} className="text-[var(--primary-color)] hover:opacity-70 transition shrink-0">
                    <BookmarkCheck size={18} />
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/dear/${dear.id}`)}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`status-dot status-${color}`} />
                      <Badge color={color}>{getStatusLabel(status)}</Badge>
                      {overdue && <Badge color="red">Overdue</Badge>}
                      {!overdue && days >= 0 && days <= 3 && <span className="text-[10px] text-amber-500 font-medium">{days === 0 ? 'Due today!' : `${days}d left`}</span>}
                    </div>
                    <h3 className="text-base font-semibold text-app-primary">{dear.week} — {dear.term}</h3>
                    <p className="text-xs text-app-muted">Due {formatDate(dear.due_date)}</p>
                  </div>
                  <ChevronRight size={16} className="text-app-muted shrink-0" />
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
