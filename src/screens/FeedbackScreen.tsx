import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { GlassCard, Avatar, Spinner } from '@/components/ui';
import type { Profile } from '@/types';

type FeedbackPost = { id: string; title: string; body: string; category: string; status: string; author_id: string; created_at: string; vote_count?: number; author?: Profile };
type Filter = 'all' | 'idea' | 'bug' | 'request';

export function FeedbackScreen() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('idea');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Array<{ id: string; body: string; author_id: string; created_at: string; author?: Profile }>>>({});
  const [commentText, setCommentText] = useState('');

  const load = async () => {
    const { data } = await supabase.from('feedback_posts').select('*').order('created_at', { ascending: false });
    const rows = (data ?? []) as FeedbackPost[];
    const ids = rows.map((post) => post.author_id);
    const { data: authors } = ids.length ? await supabase.from('profiles').select('*').in('id', ids) : { data: [] };
    const authorMap = new Map((authors ?? []).map((author) => [author.id, author as Profile]));
    const { data: votes } = profile ? await supabase.from('feedback_votes').select('post_id').eq('user_id', profile.id) : { data: [] };
    setPosts(rows.map((post) => ({ ...post, author: authorMap.get(post.author_id) })));
    setVoted(new Set((votes ?? []).map((vote) => vote.post_id)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const visiblePosts = useMemo(() => posts.filter((post) => filter === 'all' || post.category === filter).sort((a, b) => sort === 'new' ? b.created_at.localeCompare(a.created_at) : (b.vote_count ?? 0) - (a.vote_count ?? 0)), [posts, filter, sort]);

  const createPost = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !title.trim() || !body.trim()) return;
    setPosting(true);
    await supabase.from('feedback_posts').insert({ title: title.trim(), body: body.trim(), category, author_id: profile.id });
    setTitle(''); setBody(''); setCategory('idea'); setPosting(false); load();
  };

  const toggleVote = async (post: FeedbackPost) => {
    if (!profile) return;
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
    if (!profile || !commentText.trim()) return;
    const body = commentText.trim();
    const { data } = await supabase.from('feedback_comments').insert({ post_id: postId, author_id: profile.id, body }).select('id, body, author_id, created_at').maybeSingle();
    if (!data) return;
    setCommentText('');
    setComments((current) => ({ ...current, [postId]: [...(current[postId] ?? []), { ...data, author: profile }] }));
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;

  return <div className="p-4 lg:p-8 max-w-6xl mx-auto">
    <div className="mb-8"><p className="text-sm font-medium text-[var(--primary-color)]">DEAR HUB COMMUNITY</p><h1 className="text-4xl font-semibold text-app-primary mt-2">Feedback</h1><p className="text-app-secondary mt-2 max-w-xl">Share ideas, report bugs, and help shape what we build next.</p></div>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><div className="flex gap-2 overflow-x-auto">{(['all', 'idea', 'request', 'bug'] as Filter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={`px-3 py-2 rounded-xl text-sm capitalize ${filter === item ? 'glass text-[var(--primary-color)]' : 'text-app-secondary'}`}>{item === 'all' ? 'All posts' : item}</button>)}</div><select value={sort} onChange={(event) => setSort(event.target.value as 'top' | 'new')} className="glass-input rounded-xl px-3 py-2 text-sm"><option value="top">Top voted</option><option value="new">Newest</option></select></div>
        <div className="space-y-3">{visiblePosts.length === 0 ? <GlassCard className="p-10 text-center"><p className="text-app-muted">No feedback posts yet.</p></GlassCard> : visiblePosts.map((post) => <GlassCard key={post.id} className="p-4 flex gap-4"><button onClick={() => toggleVote(post)} className={`feedback-vote shrink-0 ${voted.has(post.id) ? 'active' : ''}`} aria-label={`Vote for ${post.title}`}><span>▲</span><strong>{(post.vote_count ?? 0) + (voted.has(post.id) ? 1 : 0)}</strong></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs uppercase tracking-wide text-[var(--primary-color)]">{post.category}</span><span className="text-xs text-app-muted">{post.status}</span></div><h2 className="text-lg font-semibold text-app-primary mt-1">{post.title}</h2><p className="text-sm text-app-secondary mt-1 whitespace-pre-wrap">{post.body}</p><div className="flex items-center gap-2 mt-4"><Avatar url={post.author?.avatar_url} name={`${post.author?.first_name ?? 'DEAR'} ${post.author?.last_name ?? 'Reader'}`} size={24} /><span className="text-xs text-app-muted">{post.author?.username ? `@${post.author.username}` : 'DEAR reader'}</span><button onClick={() => toggleComments(post.id)} className="ml-auto text-xs text-[var(--primary-color)]">{openPost === post.id ? 'Hide discussion' : 'Discuss'}</button></div>{openPost === post.id && <div className="mt-4 border-t border-slate-200/50 pt-3 space-y-3">{(comments[post.id] ?? []).map((comment) => <div key={comment.id} className="flex gap-2"><Avatar url={comment.author?.avatar_url} name={comment.author?.first_name ?? 'Reader'} size={24} /><p className="text-sm text-app-secondary"><strong className="text-app-primary">{comment.author?.username ? `@${comment.author.username}` : 'Reader'}</strong> {comment.body}</p></div>)}<div className="flex gap-2"><input value={commentText} onChange={(event) => setCommentText(event.target.value)} className="glass-input rounded-xl px-3 py-2 text-sm flex-1" placeholder="Add a comment..." /><button onClick={() => addComment(post.id)} className="btn-primary text-sm">Send</button></div></div>}</div></GlassCard>)}</div>
      </section>
      <GlassCard className="p-5 sticky top-4"><h2 className="text-lg font-semibold text-app-primary">Share feedback</h2><p className="text-sm text-app-muted mt-1">What should we improve?</p><form onSubmit={createPost} className="space-y-3 mt-5"><input value={title} onChange={(event) => setTitle(event.target.value)} className="glass-input rounded-xl w-full px-3 py-2.5" placeholder="Short title" required /><select value={category} onChange={(event) => setCategory(event.target.value)} className="glass-input rounded-xl w-full px-3 py-2.5"><option value="idea">Idea</option><option value="request">Feature request</option><option value="bug">Bug report</option></select><textarea value={body} onChange={(event) => setBody(event.target.value)} className="glass-input rounded-xl w-full px-3 py-2.5 min-h-32 resize-y" placeholder="Tell us more..." required /><button disabled={posting} className="btn-primary w-full">{posting ? 'Posting...' : 'Post feedback'}</button></form></GlassCard>
    </div>
  </div>;
}
