import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { GlassCard, Badge, EmptyState, Spinner } from '@/components/ui';
import { getStatusColor, getStatusLabel, formatDate, isOverdue, getDaysUntil } from '@/lib/utils';
import type { Dear, DearSubmission } from '@/types';
import { Search, X, Filter, Bookmark, BookmarkCheck, ChevronRight, BookOpen, Clock, AlertTriangle } from 'lucide-react';

interface DearWithSubmission extends Dear {
  submission?: DearSubmission;
}

type FilterStatus = 'all' | 'not_started' | 'draft' | 'submitted' | 'approved' | 'overdue';
type SortBy = 'newest' | 'oldest' | 'due_soon' | 'status';

export function MyDearsPage() {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [dears, setDears] = useState<DearWithSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sort, setSort] = useState<SortBy>('newest');
  const [search, setSearch] = useState('');
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dear-hub-bookmarks') ?? '[]')); } catch { return new Set(); }
  });

  useEffect(() => { loadDears(); }, [profile]);

  const loadDears = async () => {
    const { data: dearData } = await supabase.from('dears').select('*').eq('status', 'active').order('created_at', { ascending: false });
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

  const filtered = dears
    .filter((d) => {
      const status = d.submission?.status ?? 'not_started';
      if (filter === 'overdue') return isOverdue(d.due_date) && status === 'not_started';
      if (filter !== 'all' && status !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return d.week.toLowerCase().includes(q) || d.term.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'oldest') return a.created_at.localeCompare(b.created_at);
      if (sort === 'due_soon') return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (sort === 'status') {
        const order: Record<string, number> = { not_started: 0, draft: 1, submitted: 2, approved: 3 };
        return (order[a.submission?.status ?? 'not_started'] ?? 0) - (order[b.submission?.status ?? 'not_started'] ?? 0);
      }
      return b.created_at.localeCompare(a.created_at);
    });

  const stats = {
    total: dears.length,
    notStarted: dears.filter((d) => (d.submission?.status ?? 'not_started') === 'not_started').length,
    draft: dears.filter((d) => d.submission?.status === 'draft').length,
    submitted: dears.filter((d) => ['submitted', 'approved'].includes(d.submission?.status ?? '')).length,
    overdue: dears.filter((d) => isOverdue(d.due_date) && (d.submission?.status ?? 'not_started') === 'not_started').length,
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <p className="text-sm font-medium text-[var(--primary-color)]">DEAR HUB</p>
        <h1 className="text-3xl font-semibold text-app-primary">My DEARs</h1>
        <p className="text-app-secondary mt-1">All your assignments in one place.</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-app-primary' },
          { label: 'New', value: stats.notStarted, color: 'text-red-500' },
          { label: 'Draft', value: stats.draft, color: 'text-amber-500' },
          { label: 'Done', value: stats.submitted, color: 'text-green-500' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-app-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
          <input type="text" placeholder="Search by week or term..." value={search} onChange={(e) => setSearch(e.target.value)} className="glass-input rounded-xl w-full pl-8 pr-8 py-2 text-sm" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-primary"><X size={12} /></button>}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortBy)} className="glass-input rounded-lg px-2 py-2 text-xs">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="due_soon">Due Soon</option>
          <option value="status">By Status</option>
        </select>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
        {([
          { key: 'all', label: 'All', count: stats.total },
          { key: 'not_started', label: 'Not Started', count: stats.notStarted },
          { key: 'draft', label: 'In Progress', count: stats.draft },
          { key: 'submitted', label: 'Submitted', count: stats.submitted },
          { key: 'overdue', label: 'Overdue', count: stats.overdue },
        ] as const).map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${filter === tab.key ? 'bg-[var(--primary-color)] text-white' : 'glass text-app-muted hover:text-app-primary'}`}>
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* DEAR list */}
      {filtered.length === 0 ? (
        <EmptyState icon={<BookOpen size={48} />} title="No DEARs found" subtitle="Try adjusting your filters." />
      ) : (
        <div className="space-y-3">
          {filtered.map((dear, i) => {
            const status = dear.submission?.status ?? 'not_started';
            const color = getStatusColor(status);
            const overdue = isOverdue(dear.due_date) && status === 'not_started';
            const days = getDaysUntil(dear.due_date);
            const isBookmarked = bookmarks.has(dear.id);

            return (
              <GlassCard key={dear.id} hover className="p-4 animate-slide-up" style={{ animationDelay: `${i * 30}ms` } as React.CSSProperties}>
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleBookmark(dear.id)} className="text-app-muted hover:text-[var(--primary-color)] transition shrink-0">
                    {isBookmarked ? <BookmarkCheck size={18} className="text-[var(--primary-color)]" /> : <Bookmark size={18} />}
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
                    {dear.submission?.feedback && (
                      <p className="text-xs text-app-secondary mt-1 line-clamp-1">Feedback: {dear.submission.feedback}</p>
                    )}
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
