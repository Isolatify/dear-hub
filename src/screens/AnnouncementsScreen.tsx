import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { GlassCard, Avatar, Spinner, EmptyState, Badge } from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';
import { formatRelative } from '@/lib/utils';
import type { Announcement, AnnouncementReply, Profile } from '@/types';

export function AnnouncementsScreen({ isTeacher }: { isTeacher: boolean }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<(Announcement & { replies: (AnnouncementReply & { student: Profile })[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ title: '', body: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('announcements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_replies' }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    const { data: annData } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (!annData || annData.length === 0) {
      setAnnouncements([]);
      setLoading(false);
      return;
    }

    const { data: replyData } = await supabase
      .from('announcement_replies')
      .select('*, student:profiles(*)')
      .order('created_at', { ascending: true });

    const replyMap = new Map<string, (AnnouncementReply & { student: Profile })[]>();
    (replyData ?? []).forEach((r: any) => {
      const arr = replyMap.get(r.announcement_id) ?? [];
      arr.push(r);
      replyMap.set(r.announcement_id, arr);
    });

    const combined = annData.map((a) => ({
      ...(a as Announcement),
      replies: replyMap.get(a.id) ?? [],
    }));

    setAnnouncements(combined);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    await supabase.from('announcements').insert({
      teacher_id: profile.id,
      title: title.trim(),
      body: body.trim(),
    });

    setTitle('');
    setBody('');
    setShowForm(false);
    toast('Announcement posted', 'success');
    load();
  };

  const handleEdit = (ann: Announcement) => {
    setEditingId(ann.id);
    setEditData({ title: ann.title, body: ann.body });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await supabase.from('announcements').update({
      title: editData.title,
      body: editData.body,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId);
    setEditingId(null);
    toast('Announcement updated', 'success');
    load();
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    await supabase.from('announcements').delete().eq('id', id);
    toast('Announcement deleted', 'success');
    load();
  };

  const handleReply = async (annId: string) => {
    if (!profile || !replyText.trim()) return;

    await supabase.from('announcement_replies').insert({
      announcement_id: annId,
      student_id: profile.id,
      body: replyText.trim(),
    });

    setReplyText('');
    setReplyingTo(null);
    toast('Reply posted', 'success');
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Announcements</h1>
          <p className="text-slate-500 mt-1">
            {isTeacher ? 'Share updates with all your students.' : 'Updates from Ms. Ghada'}
          </p>
        </div>
        {isTeacher && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Announcement
          </button>
        )}
      </div>

      {showForm && isTeacher && (
        <GlassCard className="p-6 mb-6 animate-slide-up">
          <form onSubmit={handleCreate} className="space-y-4">
            <input
              type="text"
              required
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-3 text-slate-800"
            />
            <textarea
              required
              placeholder="Write your announcement..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-3 text-slate-800 resize-none"
              rows={4}
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1">Post Announcement</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancel</button>
            </div>
          </form>
        </GlassCard>
      )}

      {announcements.length === 0 ? (
        <EmptyState
          icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>}
          title="No announcements yet"
          subtitle={isTeacher ? 'Create your first announcement to notify students.' : 'Check back later for updates.'}
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <GlassCard key={ann.id} className="p-5 animate-slide-up">
              {editingId === ann.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="glass-input w-full rounded-xl px-4 py-3 text-slate-800"
                  />
                  <textarea
                    value={editData.body}
                    onChange={(e) => setEditData({ ...editData, body: e.target.value })}
                    className="glass-input w-full rounded-xl px-4 py-3 text-slate-800 resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} className="btn-primary flex-1">Save</button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost flex-1">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-slate-800">{ann.title}</h3>
                    {isTeacher && (
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(ann)} className="p-1.5 rounded-lg hover:bg-white/40 text-slate-400">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(ann.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-slate-600 whitespace-pre-wrap">{ann.body}</p>
                  <p className="text-xs text-slate-400 mt-2">{formatRelative(ann.created_at)}</p>

                  {/* Replies */}
                  {ann.replies.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200/50 space-y-3">
                      <p className="text-xs font-medium text-slate-400">REPLIES</p>
                      {ann.replies.map((reply) => (
                        <div key={reply.id} className="flex items-start gap-2">
                          <Avatar url={reply.student?.avatar_url} name={`${reply.student?.first_name} ${reply.student?.last_name}`} size={28} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-700">{reply.student?.first_name} {reply.student?.last_name}</span>
                              <span className="text-xs text-slate-400">{formatRelative(reply.created_at)}</span>
                            </div>
                            <p className="text-sm text-slate-600 mt-0.5">{reply.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply input (students only) */}
                  {!isTeacher && (
                    <div className="mt-3 pt-3 border-t border-slate-200/50">
                      {replyingTo === ann.id ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a public reply..."
                            className="glass-input flex-1 rounded-xl px-4 py-2.5 text-slate-800 text-sm"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') handleReply(ann.id); }}
                          />
                          <button onClick={() => handleReply(ann.id)} className="btn-primary text-sm px-4">Reply</button>
                          <button onClick={() => setReplyingTo(null)} className="btn-ghost text-sm px-3">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setReplyingTo(ann.id)}
                          className="text-sm text-[var(--primary-color)] font-medium hover:underline"
                        >
                          Reply publicly
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDeleteId}
        title="Delete Announcement"
        message="Delete this announcement? All replies will be removed too."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
