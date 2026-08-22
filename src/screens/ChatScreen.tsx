import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { GlassCard, Avatar, Spinner, EmptyState } from '@/components/ui';
import { formatRelative } from '@/lib/utils';
import type { Profile, Message } from '@/types';

export function ChatScreen() {
  const { recipientId } = useParams<{ recipientId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [selectedContact, setSelectedContact] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [showCall, setShowCall] = useState<'voice' | 'video' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isTeacher = profile?.role === 'teacher';

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    if (isTeacher) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('first_name');
      setContacts((data ?? []) as Profile[]);
    } else {
      // Students can only chat with the teacher
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'teacher')
        .limit(1);
      setContacts((data ?? []) as Profile[]);
      if (data && data.length > 0) {
        setSelectedContact(data[0] as Profile);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (recipientId) {
      const contact = contacts.find((c) => c.id === recipientId);
      if (contact) setSelectedContact(contact);
    }
  }, [recipientId, contacts]);

  useEffect(() => {
    if (!selectedContact || !profile) return;

    loadMessages();

    const channel = supabase
      .channel(`chat-${[profile.id, selectedContact.id].sort().join('-')}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${selectedContact.id}`,
      }, () => loadMessages())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${profile.id}`,
      }, () => loadMessages())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedContact, profile]);

  const loadMessages = async () => {
    if (!selectedContact || !profile) return;

    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${profile.id},recipient_id.eq.${selectedContact.id}),and(sender_id.eq.${selectedContact.id},recipient_id.eq.${profile.id}))`)
      .order('created_at', { ascending: true });

    setMessages((data ?? []) as Message[]);

    // Mark received messages as read
    const unread = (data ?? []).filter((m: any) => m.recipient_id === profile.id && !m.read_at);
    if (unread.length > 0) {
      await Promise.all(unread.map((m: any) =>
        supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', m.id)
      ));
    }

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact || !profile) return;

    const { data } = await supabase.from('messages').insert({
      sender_id: profile.id,
      recipient_id: selectedContact.id,
      body: newMessage.trim(),
    }).select('*').maybeSingle();

    if (data) {
      setMessages((prev) => [...prev, data as Message]);
      setNewMessage('');
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const handleEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditText(msg.body);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    await supabase.from('messages').update({
      body: editText,
      edited: true,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId);

    setMessages((prev) => prev.map((m) => m.id === editingId ? { ...m, body: editText, edited: true } : m));
    setEditingId(null);
    setEditText('');
  };

  const handleDelete = async (msg: Message) => {
    await supabase.from('messages').delete().eq('id', msg.id);
    setMessages((prev) => prev.filter((m) => m.id !== msg.id));
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  return (
    <div className="flex h-screen p-3 lg:p-4">
      {/* Contact list (teacher only) */}
      {isTeacher && (
        <div className="w-64 flex-shrink-0 overflow-auto mr-3 hidden lg:block">
          <GlassCard className="p-2">
            <p className="text-xs font-medium text-slate-400 px-3 py-2">STUDENTS</p>
            {contacts.length === 0 ? (
              <p className="text-sm text-slate-400 px-3 py-4">No students yet.</p>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => { setSelectedContact(contact); navigate(`/teacher/messages/${contact.id}`); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl transition ${
                    selectedContact?.id === contact.id ? 'glass text-[var(--primary-color)]' : 'hover:bg-white/30 text-slate-600'
                  }`}
                >
                  <Avatar url={contact.avatar_url} name={`${contact.first_name} ${contact.last_name}`} size={32} />
                  <span className="text-sm font-medium truncate">{contact.first_name} {contact.last_name}</span>
                </button>
              ))
            )}
          </GlassCard>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedContact ? (
          <>
            {/* Chat header */}
            <GlassCard className="p-3 mb-3 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-3">
                <Avatar url={selectedContact.avatar_url} name={`${selectedContact.first_name} ${selectedContact.last_name}`} size={40} />
                <div>
                  <p className="font-medium text-slate-700">{selectedContact.first_name} {selectedContact.last_name}</p>
                  <p className="text-xs text-slate-400">{selectedContact.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCall('voice')}
                  className="p-2.5 rounded-xl glass-input hover:bg-white/60 transition text-slate-600"
                  title="Voice call"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                </button>
                <button
                  onClick={() => setShowCall('video')}
                  className="p-2.5 rounded-xl glass-input hover:bg-white/60 transition text-slate-600"
                  title="Video call"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                </button>
              </div>
            </GlassCard>

            {/* Messages */}
            <div className="flex-1 overflow-auto glass rounded-xl p-4 space-y-2 mb-3 bg-white/40">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-400">No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === profile?.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                        {editingId === msg.id ? (
                          <div className="glass-input rounded-2xl p-3">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full bg-transparent text-slate-800 resize-none text-sm"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex gap-2 mt-2">
                              <button onClick={handleSaveEdit} className="text-xs text-green-500 font-medium">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-xs text-slate-400">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`rounded-2xl px-4 py-2.5 ${
                              isOwn ? 'gradient-bg text-white' : 'glass text-slate-800'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                            <div className={`flex items-center gap-2 mt-1 ${isOwn ? 'text-white/60' : 'text-slate-400'}`}>
                              <span className="text-xs">{formatRelative(msg.created_at)}</span>
                              {msg.edited && <span className="text-xs italic">edited</span>}
                              {msg.read_at && isOwn && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                              )}
                            </div>
                          </div>
                        )}
                        {isOwn && editingId !== msg.id && (
                          <div className="opacity-0 group-hover:opacity-100 transition flex gap-1 mt-1 justify-end">
                            <button onClick={() => handleEdit(msg)} className="text-xs text-slate-400 hover:text-slate-600">Edit</button>
                            <span className="text-slate-300">·</span>
                            <button onClick={() => handleDelete(msg)} className="text-xs text-slate-400 hover:text-red-500">Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="glass-input flex-1 rounded-xl px-4 py-3 text-slate-800"
                placeholder="Type a message..."
              />
              <button type="submit" disabled={!newMessage.trim()} className="btn-primary px-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </form>
          </>
        ) : (
          <EmptyState
            icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
            title="Select a student to chat"
            subtitle="Choose someone from the list to start messaging."
          />
        )}
      </div>

      {/* Call overlay */}
      {showCall && selectedContact && (
        <CallOverlay
          type={showCall}
          contact={selectedContact}
          onClose={() => setShowCall(null)}
        />
      )}
    </div>
  );
}

function CallOverlay({
  type,
  contact,
  onClose,
}: {
  type: 'voice' | 'video';
  contact: Profile;
  onClose: () => void;
}) {
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md animate-fade-in">
      <div className="glass-dark rounded-3xl p-8 w-full max-w-md mx-4 text-center">
        <div className="mb-6">
          <div className="inline-block mb-4">
            {type === 'video' && !videoOff ? (
              <div className="w-32 h-32 rounded-2xl glass flex items-center justify-center">
                <Avatar url={contact.avatar_url} name={`${contact.first_name} ${contact.last_name}`} size={120} />
              </div>
            ) : (
              <Avatar url={contact.avatar_url} name={`${contact.first_name} ${contact.last_name}`} size={120} />
            )}
          </div>
          <h2 className="text-xl font-semibold text-white">{contact.first_name} {contact.last_name}</h2>
          <p className="text-sm text-slate-400 mt-1">
            {type === 'video' ? 'Video' : 'Voice'} call · {formatDuration(duration)}
          </p>
          <p className="text-xs text-slate-500 mt-2">Connecting...</p>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setMuted(!muted)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
              muted ? 'bg-white text-slate-800' : 'glass text-white'
            }`}
          >
            {muted ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95a5 5 0 0 1-8 0V12" /><path d="M12 19v4" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /></svg>
            )}
          </button>

          {type === 'video' && (
            <button
              onClick={() => setVideoOff(!videoOff)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition ${
                videoOff ? 'bg-white text-slate-800' : 'glass text-white'
              }`}
            >
              {videoOff ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
              )}
            </button>
          )}

          <button
            onClick={onClose}
            className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" transform="rotate(135)"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
