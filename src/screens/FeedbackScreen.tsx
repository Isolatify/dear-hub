import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { GlassCard, Avatar, Spinner } from '@/components/ui';
import type { Profile } from '@/types';
import { Search, X, ArrowLeft, MessageCircle, TrendingUp, Clock, ThumbsUp, Shield, Check, ChevronDown } from 'lucide-react';

type FeedbackPost = {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  author_id: string;
  created_at: string;
  vote_count?: number;
  comment_count?: number;
  admin_response?: string | null;
  admin_response_at?: string | null;
  author?: Profile;
};

type Filter = 'all' | 'idea' | 'bug' | 'request';
type StatusFilter = 'all' | 'open' | 'planned' | 'done';
type Sort = 'top' | 'new' | 'comments';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  planned: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  in_progress: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  closed: 'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400',
};

const CATEGORY_ICONS: Record<string, string> = {
  idea: '💡',
  bug: '🐛',
  request: '✨',
};

export function FeedbackScreen() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<Sort>('top');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('idea');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Array<{ id: string; body: string; author_id: string; created_at: string; author?: Profile }>>>({});
  const [commentText, setCommentText] = useState('');
  const [stats, setStats] = useState({ total: 0, open: 0, planned: 0, done: 0 });
  const [moderatingPost, setModeratingPost] = useState<string | null>(null);
  const [modStatus, setModStatus] = useState('');
  const [modResponse, setModResponse] = useState('');

  const load = async () => {
    const { data } = await supabase.from('feedback_posts').select('*, admin_response, admin_response_at').order('created_at', { ascending: false });
    const rows = (data ?? []) as FeedbackPost[];
    const ids = rows.map((post) => post.author_id);
    const { data: authors } = ids.length ? await supabase.from('profiles').select('*').in('id', ids) : { data: [] };
    const authorMap = new Map((authors ?? []).map((author) => [author.id, author as Profile]));
    const { data: votes } = profile ? await supabase.from('feedback_votes').select('post_id').eq('user_id', profile.id) : { data: [] };

    // Count comments per post
    const postIds = rows.map((p) => p.id);
    const { data: allComments } = postIds.length
      ? await supabase.from('feedback_comments').select('post_id').in('post_id', postIds)
      : { data: [] };
    const commentCounts = new Map<string, number>();
    (allComments ?? []).forEach((c: { post_id: string }) => {
      commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);
    });

    const enriched = rows.map((post) => ({
      ...post,
      author: authorMap.get(post.author_id),
      vote_count: post.vote_count ?? 0,
      comment_count: commentCounts.get(post.id) ?? 0,
    }));

    setPosts(enriched);
    setVoted(new Set((votes ?? []).map((vote) => vote.post_id)));
    setStats({
      total: enriched.length,
      open: enriched.filter((p) => p.status === 'open').length,
      planned: enriched.filter((p) => ['planned', 'in_progress'].includes(p.status)).length,
      done: enriched.filter((p) => p.status === 'done').length,
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const visiblePosts = useMemo(() => {
    return posts
      .filter((post) => {
        if (filter !== 'all' && post.category !== filter) return false;
        if (statusFilter !== 'all') {
          if (statusFilter === 'open' && post.status !== 'open') return false;
          if (statusFilter === 'planned' && !['planned', 'in_progress'].includes(post.status)) return false;
          if (statusFilter === 'done' && post.status !== 'done') return false;
        }
        if (search.trim()) {
          const q = search.toLowerCase();
          return post.title.toLowerCase().includes(q) || post.body.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === 'top') return (b.vote_count ?? 0) - (a.vote_count ?? 0);
        if (sort === 'comments') return (b.comment_count ?? 0) - (a.comment_count ?? 0);
        return b.created_at.localeCompare(a.created_at);
      });
  }, [posts, filter, statusFilter, sort, search]);

  const createPost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) { navigate('/auth'); return; }
    if (!title.trim() || !body.trim()) return;
    setPosting(true);
    await supabase.from('feedback_posts').insert({ title: title.trim(), body: body.trim(), category, author_id: profile.id });
    setTitle(''); setBody(''); setCategory('idea'); setPosting(false); setShowForm(false); load();
  };

  const toggleVote = async (post: FeedbackPost) => {
    if (!profile) { navigate('/auth'); return; }
    if (voted.has(post.id)) {
      await supabase.from('feedback_votes').delete().eq('post_id', post.id).eq('user_id', profile.id);
      setVoted((current) => { const next = new Set(current); next.delete(post.id); return next; });
    } else {
      await supabase.from('feedback_votes').insert({ post_id: post.id, user_id: profile.id });
      setVoted((current) => new Set(current).add(post.id));
    }
  };

  const toggleComments = async (postId: string) => {
    if (openPost === postId) { setOpenPost(null); return; }
    const { data } = await supabase.from('feedback_comments').select('*').eq('post_id', postId).order('created_at');
    const rows = (data ?? []) as Array<{ id: string; body: string; author_id: string; created_at: string }>;
    const { data: authors } = rows.length ? await supabase.from('profiles').select('*').in('id', rows.map((row) => row.author_id)) : { data: [] };
    const authorMap = new Map((authors ?? []).map((author) => [author.id, author as Profile]));
    setComments((current) => ({ ...current, [postId]: rows.map((row) => ({ ...row, author: authorMap.get(row.author_id) })) }));
    setOpenPost(postId);
  };

  const addComment = async (postId: string) => {
    if (!profile) { navigate('/auth'); return; }
    if (!commentText.trim()) return;
    const body = commentText.trim();
    const { data } = await supabase.from('feedback_comments').insert({ post_id: postId, author_id: profile.id, body }).select('id, body, author_id, created_at').maybeSingle();
    if (!data) return;
    setCommentText('');
    setComments((current) => ({ ...current, [postId]: [...(current[postId] ?? []), { ...data, author: profile }] }));
  };

  const moderatePost = async (postId: string) => {
    if (!isAdmin || !modStatus) return;
    const updates: Record<string, unknown> = {
      status: modStatus,
      admin_response: modResponse.trim() || null,
      admin_response_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('feedback_posts').update(updates).eq('id', postId);
    if (error) return;
    setModeratingPost(null);
    setModStatus('');
    setModResponse('');
    load();
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;

  return (
    <div className="min-h-screen px-4 py-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-xl glass text-app-secondary hover:text-app-primary transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="text-sm font-medium text-[var(--primary-color)]">DEAR HUB COMMUNITY</p>
              <h1 className="text-3xl font-semibold text-app-primary">Feedback</h1>
            </div>
          </div>
          {!profile && <button onClick={() => navigate('/auth')} className="btn-primary text-sm">Sign in</button>}
        </header>

        <p className="text-app-secondary mb-6 max-w-xl">Share ideas, report bugs, and help shape what we build next.</p>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, icon: <MessageCircle size={16} /> },
            { label: 'Open', value: stats.open, icon: <ThumbsUp size={16} /> },
            { label: 'Planned', value: stats.planned, icon: <Clock size={16} /> },
            { label: 'Done', value: stats.done, icon: <TrendingUp size={16} /> },
          ].map((stat) => (
            <div key={stat.label} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className="text-[var(--primary-color)]">{stat.icon}</div>
              <div>
                <p className="text-lg font-semibold text-app-primary">{stat.value}</p>
                <p className="text-xs text-app-muted">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
          <section>
            {/* Search */}
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
              <input
                type="text"
                placeholder="Search feedback..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="glass-input rounded-xl w-full pl-9 pr-8 py-2.5 text-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-primary">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex gap-1.5 overflow-x-auto">
                {(['all', 'idea', 'request', 'bug'] as Filter[]).map((item) => (
                  <button
                    key={item}
                    onClick={() => setFilter(item)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                      filter === item ? 'glass text-[var(--primary-color)]' : 'text-app-secondary hover:opacity-80'
                    }`}
                  >
                    {item === 'all' ? 'All' : `${CATEGORY_ICONS[item]} ${item}`}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="glass-input rounded-lg px-2 py-1.5 text-xs"
                >
                  <option value="all">All Status</option>
                  <option value="open">Open</option>
                  <option value="planned">Planned</option>
                  <option value="done">Done</option>
                </select>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="glass-input rounded-lg px-2 py-1.5 text-xs"
                >
                  <option value="top">Top Voted</option>
                  <option value="new">Newest</option>
                  <option value="comments">Most Discussed</option>
                </select>
              </div>
            </div>

            {/* Posts */}
            <div className="space-y-3">
              {visiblePosts.length === 0 ? (
                <GlassCard className="p-10 text-center">
                  <p className="text-app-muted">No feedback posts found.</p>
                </GlassCard>
              ) : (
                visiblePosts.map((post) => (
                  <GlassCard key={post.id} className="p-4 flex gap-4">
                    <button
                      onClick={() => toggleVote(post)}
                      className={`feedback-vote shrink-0 ${voted.has(post.id) ? 'active' : ''}`}
                      aria-label={`Vote for ${post.title}`}
                    >
                      <span>▲</span>
                      <strong>{(post.vote_count ?? 0) + (voted.has(post.id) ? 1 : 0)}</strong>
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-[var(--primary-color)] font-medium">
                          {CATEGORY_ICONS[post.category]} {post.category}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[post.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {post.status}
                        </span>
                        {isAdmin && post.author && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            by {post.author.first_name}
                          </span>
                        )}
                        {post.admin_response && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--primary-color)]/10 text-[var(--primary-color)]">
                            <Check size={10} className="inline -mt-0.5" /> Responded
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-semibold text-app-primary mt-1">{post.title}</h2>
                      <p className="text-sm text-app-secondary mt-1 whitespace-pre-wrap line-clamp-3">{post.body}</p>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex items-center gap-1.5">
                          <Avatar url={post.author?.avatar_url} name={`${post.author?.first_name ?? 'DEAR'} ${post.author?.last_name ?? 'Reader'}`} size={20} />
                          <span className="text-xs text-app-muted">
                            {post.author?.username ? `@${post.author.username}` : 'Anonymous'}
                          </span>
                        </div>
                        <span className="text-xs text-app-muted">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => toggleComments(post.id)}
                          className="ml-auto flex items-center gap-1 text-xs text-[var(--primary-color)] hover:underline"
                        >
                          <MessageCircle size={12} />
                          {post.comment_count ?? 0}
                        </button>
                      </div>
                      {openPost === post.id && (
                        <div className="mt-4 border-t border-slate-200/50 pt-3 space-y-3">
                          {(comments[post.id] ?? []).map((comment) => (
                            <div key={comment.id} className="flex gap-2">
                              <Avatar url={comment.author?.avatar_url} name={comment.author?.first_name ?? 'Reader'} size={24} />
                              <div>
                                <p className="text-sm text-app-secondary">
                                  <strong className="text-app-primary">
                                    {comment.author?.username ? `@${comment.author.username}` : 'Reader'}
                                  </strong>{' '}
                                  {comment.body}
                                </p>
                                <p className="text-[10px] text-app-muted mt-0.5">
                                  {new Date(comment.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          ))}
                          {profile && (
                            <div className="flex gap-2 mt-2">
                              <input
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addComment(post.id)}
                                className="glass-input rounded-xl px-3 py-2 flex-1 text-sm"
                                placeholder="Write a reply..."
                              />
                              <button onClick={() => addComment(post.id)} className="btn-primary px-3 py-2 text-sm rounded-xl">
                                Reply
                              </button>
                            </div>
                          )}
                          {/* Admin moderation panel */}
                          {isAdmin && (
                            <div className="mt-3 pt-3 border-t border-slate-200/50">
                              {post.admin_response && moderatingPost !== post.id && (
                                <div className="mb-3 p-3 rounded-xl bg-[var(--primary-color)]/5 border border-[var(--primary-color)]/20">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Shield size={12} className="text-[var(--primary-color)]" />
                                    <span className="text-[10px] font-semibold text-[var(--primary-color)] uppercase tracking-wide">Admin Response</span>
                                  </div>
                                  <p className="text-sm text-app-secondary">{post.admin_response}</p>
                                </div>
                              )}
                              {moderatingPost === post.id ? (
                                <div className="space-y-2 p-3 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50">
                                  <div className="relative">
                                    <select
                                      value={modStatus}
                                      onChange={(e) => setModStatus(e.target.value)}
                                      className="glass-input rounded-lg px-3 py-2 text-sm w-full appearance-none pr-8"
                                    >
                                      <option value="">Select action...</option>
                                      <option value="open">🔵 Reopen</option>
                                      <option value="planned">🟡 Accept — Planned</option>
                                      <option value="in_progress">🟣 In Progress</option>
                                      <option value="done">🟢 Complete</option>
                                      <option value="closed">⚫ Decline</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted pointer-events-none" />
                                  </div>
                                  <textarea
                                    value={modResponse}
                                    onChange={(e) => setModResponse(e.target.value)}
                                    className="glass-input rounded-lg px-3 py-2 text-sm w-full min-h-16 resize-y"
                                    placeholder="Response message (optional)..."
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => { setModeratingPost(null); setModStatus(''); setModResponse(''); }}
                                      className="btn-ghost px-3 py-1.5 text-xs rounded-lg"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => moderatePost(post.id)}
                                      disabled={!modStatus}
                                      className="btn-primary px-3 py-1.5 text-xs rounded-lg disabled:opacity-40"
                                    >
                                      Submit
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setModeratingPost(post.id); setModStatus(post.status); setModResponse(''); }}
                                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--primary-color)] hover:underline"
                                >
                                  <Shield size={12} />
                                  Moderate
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </GlassCard>
                ))
              )}
            </div>
          </section>

          {/* Sidebar */}
          <div className="space-y-4 sticky top-4">
            <GlassCard className="p-5">
              <h2 className="text-lg font-semibold text-app-primary">Share feedback</h2>
              <p className="text-sm text-app-muted mt-1">What should we improve?</p>
              {showForm ? (
                <form onSubmit={createPost} className="space-y-3 mt-4">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="glass-input rounded-xl w-full px-3 py-2.5 text-sm"
                    placeholder="Short title"
                    required
                  />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="glass-input rounded-xl w-full px-3 py-2.5 text-sm"
                  >
                    <option value="idea">💡 Idea</option>
                    <option value="request">✨ Feature Request</option>
                    <option value="bug">🐛 Bug Report</option>
                  </select>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="glass-input rounded-xl w-full px-3 py-2.5 min-h-28 resize-y text-sm"
                    placeholder="Tell us more..."
                    required
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowForm(false)} className="btn-ghost px-4 py-2 text-sm rounded-xl">
                      Cancel
                    </button>
                    <button disabled={posting} className="btn-primary flex-1 py-2 text-sm rounded-xl">
                      {posting ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </form>
              ) : (
                <button onClick={() => profile ? setShowForm(true) : navigate('/auth')} className="btn-primary w-full mt-4 py-2.5 text-sm rounded-xl">
                  New Post
                </button>
              )}
            </GlassCard>

            <GlassCard className="p-5">
              <h3 className="text-sm font-semibold text-app-primary mb-3">Guidelines</h3>
              <ul className="space-y-2 text-xs text-app-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--primary-color)] mt-0.5">•</span>
                  Search before posting to avoid duplicates
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--primary-color)] mt-0.5">•</span>
                  Be specific — include steps to reproduce bugs
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--primary-color)] mt-0.5">•</span>
                  Vote on existing ideas you support
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--primary-color)] mt-0.5">•</span>
                  Keep it respectful and constructive
                </li>
              </ul>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
