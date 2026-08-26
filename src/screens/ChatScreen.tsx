import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Avatar, Spinner, EmptyState } from '@/components/ui';
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
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isTeacher = profile?.role === 'teacher';

  useEffect(() => {
    loadContacts();
  }, []);

  const TEACHER_EMAILS = ['gaghzy@gmail.com'];

  const loadContacts = async () => {
    if (isTeacher) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('first_name');
      const filtered = (data ?? []).filter((s) => !TEACHER_EMAILS.includes(s.email));
      setContacts(filtered as Profile[]);
      if (filtered.length > 0 && !recipientId) {
        setSelectedContact(filtered[0] as Profile);
      }
      setLoading(false);
    } else {
      const [{ data: teacherData }, { data: studentData }, { data: permissionData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('role', 'teacher').limit(1),
        supabase.from('profiles').select('*').eq('role', 'student').order('first_name'),
        supabase.from('chat_permissions').select('student_a, student_b').eq('allowed', true),
      ]);
      const allowedIds = new Set<string>();
      (permissionData ?? []).forEach((permission) => {
        if (permission.student_a === profile?.id) allowedIds.add(permission.student_b);
        if (permission.student_b === profile?.id) allowedIds.add(permission.student_a);
      });
      const filteredStudents = (studentData ?? []).filter((student) => allowedIds.has(student.id) && !TEACHER_EMAILS.includes(student.email));
      const data = [...(teacherData ?? []), ...filteredStudents];
      setContacts(data as Profile[]);
      if (recipientId) {
        setSelectedContact((data as Profile[]).find((student) => student.id === recipientId) ?? null);
      }
      setLoading(false);
      if (teacherData && teacherData.length > 0 && !recipientId) {
        setSelectedContact(teacherData[0] as Profile);
      }
    }
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
      }, (payload) => {
        const msg = payload.new as Message;
        if (
          (msg.sender_id === profile.id && msg.recipient_id === selectedContact.id) ||
          (msg.sender_id === selectedContact.id && msg.recipient_id === profile.id)
        ) {
          loadMessages();
        }
      })
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

    const unread = (data ?? []).filter((m) => m.recipient_id === profile.id && !m.read_at);
    if (unread.length > 0) {
      await Promise.all(unread.map((m) =>
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
      inputRef.current?.focus();
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

  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toLocaleDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [] });
      }
      groups[groups.length - 1].messages.push(msg);
    });

    return groups;
  }, [messages]);

  // Format time for message bubbles
  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  return (
    <div className="whatsapp-layout">
      {/* ─── Sidebar ─── */}
      <div className={`whatsapp-sidebar ${selectedContact ? 'hidden lg:flex' : 'flex'}`}>
        {/* Sidebar header */}
        <div className="whatsapp-sidebar-header">
          <div className="flex items-center gap-3">
            <Avatar url={profile?.avatar_url} name={`${profile?.first_name} ${profile?.last_name}`} size={40} />
            <h2 className="text-lg font-semibold text-slate-800">Messages</h2>
          </div>
        </div>

        {/* Search */}
        <div className="whatsapp-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="whatsapp-search-icon"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isTeacher ? 'Search students...' : 'Search teachers...'}
            className="whatsapp-search-input"
          />
        </div>

        {/* Contact list */}
        <div className="whatsapp-contact-list">
          {filteredContacts.length === 0 ? (
            <div className="p-4 text-center text-sm text-slate-400">
              {searchQuery ? 'No results found.' : isTeacher ? 'No students yet.' : 'No contacts available.'}
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isSelected = selectedContact?.id === contact.id;
              return (
                <button
                  key={contact.id}
                  onClick={() => { setSelectedContact(contact); navigate(isTeacher ? `/teacher/messages/${contact.id}` : '/messages'); }}
                  className={`whatsapp-contact ${isSelected ? 'whatsapp-contact-active' : ''}`}
                >
                  <div className="whatsapp-contact-avatar">
                    <Avatar url={contact.avatar_url} name={`${contact.first_name} ${contact.last_name}`} size={48} />
                    <span className="whatsapp-online-dot" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="whatsapp-contact-name">{contact.first_name} {contact.last_name}</p>
                      <span className="whatsapp-contact-time text-[10px]">
                        {contact.last_sign_in ? formatRelative(contact.last_sign_in) : ''}
                      </span>
                    </div>
                    <p className="whatsapp-contact-email">{contact.email}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Chat Area ─── */}
      <div className={`whatsapp-chat ${!selectedContact ? 'hidden lg:flex' : 'flex'}`}>
        {selectedContact ? (
          <>
            {/* Chat header */}
            <div className="whatsapp-chat-header">
              <button
                onClick={() => setSelectedContact(null)}
                className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-white/40 transition text-slate-600"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <div className="flex items-center gap-3">
                <Avatar url={selectedContact.avatar_url} name={`${selectedContact.first_name} ${selectedContact.last_name}`} size={40} />
                <div>
                  <p className="font-semibold text-slate-800">{selectedContact.first_name} {selectedContact.last_name}</p>
                  <p className="text-xs text-slate-400">{selectedContact.email}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setShowCall('voice')} className="whatsapp-header-btn" title="Voice call">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                </button>
                <button onClick={() => setShowCall('video')} className="whatsapp-header-btn" title="Video call">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="whatsapp-messages">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <Avatar url={selectedContact.avatar_url} name={`${selectedContact.first_name} ${selectedContact.last_name}`} size={80} />
                  <p className="text-slate-400 text-sm">No messages yet. Say hello!</p>
                </div>
              ) : (
                groupedMessages.map((group) => (
                  <div key={group.date}>
                    <div className="whatsapp-date-label">
                      <span>{formatDateLabel(group.date)}</span>
                    </div>
                    {group.messages.map((msg) => {
                      const isOwn = msg.sender_id === profile?.id;
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1 group`}>
                          <div className={`whatsapp-bubble-wrapper ${isOwn ? 'whatsapp-bubble-own' : 'whatsapp-bubble-other'}`}>
                            {editingId === msg.id ? (
                              <div className="whatsapp-edit-box">
                                <input
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  className="whatsapp-edit-input"
                                  autoFocus
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                                />
                                <div className="flex gap-2 mt-1">
                                  <button onClick={handleSaveEdit} className="text-xs text-green-600 font-medium">Save</button>
                                  <button onClick={() => setEditingId(null)} className="text-xs text-slate-400">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="whatsapp-bubble-text">{msg.body}</p>
                                <div className={`whatsapp-bubble-meta ${isOwn ? 'whatsapp-bubble-meta-own' : ''}`}>
                                  <span>{formatTime(msg.created_at)}</span>
                                  {msg.edited && <span className="italic">edited</span>}
                                  {msg.read_at && isOwn && (
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-400"><polyline points="20 6 9 17 4 12" /></svg>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          {isOwn && editingId !== msg.id && (
                            <div className="whatsapp-msg-actions">
                              <button onClick={() => handleEdit(msg)} className="whatsapp-msg-action">Edit</button>
                              <button onClick={() => handleDelete(msg)} className="whatsapp-msg-action whatsapp-msg-action-delete">Del</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="whatsapp-input-bar">
              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="whatsapp-input"
                placeholder="Type a message..."
              />
              <button type="submit" disabled={!newMessage.trim()} className="whatsapp-send-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
              title={isTeacher ? 'Select a student' : 'No conversations yet'}
              subtitle={isTeacher ? 'Choose someone from the sidebar to start chatting.' : 'Your teacher will reach out soon.'}
            />
          </div>
        )}
      </div>

      {/* Call overlay */}
      {showCall && selectedContact && (
        <CallOverlay type={showCall} contact={selectedContact} onClose={() => setShowCall(null)} />
      )}
    </div>
  );
}

function CallOverlay({ type, contact, onClose }: { type: 'voice' | 'video'; contact: Profile; onClose: () => void }) {
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
          <p className="text-sm text-slate-400 mt-1">{type === 'video' ? 'Video' : 'Voice'} call · {formatDuration(duration)}</p>
          <p className="text-xs text-slate-500 mt-2">Connecting...</p>
        </div>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setMuted(!muted)} className={`w-14 h-14 rounded-full flex items-center justify-center transition ${muted ? 'bg-white text-slate-800' : 'glass text-white'}`}>
            {muted ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" /><path d="M17 16.95a5 5 0 0 1-8 0V12" /><path d="M12 19v4" /></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /></svg>
            )}
          </button>
          {type === 'video' && (
            <button onClick={() => setVideoOff(!videoOff)} className={`w-14 h-14 rounded-full flex items-center justify-center transition ${videoOff ? 'bg-white text-slate-800' : 'glass text-white'}`}>
              {videoOff ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
              )}
            </button>
          )}
          <button onClick={onClose} className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" transform="rotate(135)"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
