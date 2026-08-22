import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { GlassCard, EmptyState, Avatar, Spinner } from '@/components/ui';
import { formatRelative } from '@/lib/utils';
import type { Profile, ActivityLog, DearSubmission, Dear } from '@/types';

interface StudentWithActivity extends Profile {
  logs: ActivityLog[];
  submissions: (DearSubmission & { dear: Dear })[];
  lastActive: string | null;
}

export function ManageStudents() {
  const [students, setStudents] = useState<StudentWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState({ first: '', last: '' });
  const [addingStudent, setAddingStudent] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Array<{ student_a: string; student_b: string; allowed: boolean }>>([]);
  const [permissionA, setPermissionA] = useState('');
  const [permissionB, setPermissionB] = useState('');

  useEffect(() => {
    load();
    const channel = supabase
      .channel('manage-students')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const load = async () => {
    const { data: studentData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('first_name');

    if (!studentData) { setLoading(false); return; }

    const { data: logData } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    const { data: subData } = await supabase
      .from('dear_submissions')
      .select('*, dear:dears(*)')
      .order('updated_at', { ascending: false });

    const { data: permissionData } = await supabase
      .from('chat_permissions')
      .select('student_a, student_b, allowed');
    setPermissions((permissionData ?? []) as Array<{ student_a: string; student_b: string; allowed: boolean }>);

    const logMap = new Map<string, ActivityLog[]>();
    (logData ?? []).forEach((l) => {
      const arr = logMap.get(l.student_id) ?? [];
      arr.push(l as ActivityLog);
      logMap.set(l.student_id, arr);
    });

    const subMap = new Map<string, (DearSubmission & { dear: Dear })[]>();
    (subData ?? []).forEach((s) => {
      const arr = subMap.get(s.student_id) ?? [];
      arr.push(s);
      subMap.set(s.student_id, arr);
    });

    const combined = studentData.map((s) => ({
      ...(s as Profile),
      logs: logMap.get(s.id) ?? [],
      submissions: subMap.get(s.id) ?? [],
      lastActive: subMap.get(s.id)?.[0]?.last_activity ?? null,
    }));

    setStudents(combined);
    setLoading(false);
  };

  const updatePermission = async () => {
    if (!permissionA || !permissionB || permissionA === permissionB) return;
    const existing = permissions.find((permission) =>
      (permission.student_a === permissionA && permission.student_b === permissionB)
      || (permission.student_a === permissionB && permission.student_b === permissionA)
    );
    const [studentA, studentB] = [permissionA, permissionB].sort();
    const { data } = await supabase.from('chat_permissions').upsert({
      student_a: studentA,
      student_b: studentB,
      allowed: !existing?.allowed,
    }, { onConflict: 'student_a,student_b' }).select('student_a, student_b, allowed').maybeSingle();
    if (data) setPermissions((current) => [...current.filter((permission) => !(permission.student_a === data.student_a && permission.student_b === data.student_b)), data]);
  };

  const handleEdit = (student: Profile) => {
    setEditingId(student.id);
    setEditName({ first: student.first_name, last: student.last_name });
  };

  const handleSave = async (id: string) => {
    await supabase
      .from('profiles')
      .update({ first_name: editName.first, last_name: editName.last, updated_at: new Date().toISOString() })
      .eq('id', id);
    setEditingId(null);
    load();
  };

  const handleDelete = async (student: Profile) => {
    if (!confirm(`Remove ${student.first_name} ${student.last_name}? This will delete their account and all data.`)) return;

    // Delete profile and all related data (cascades)
    await supabase.from('profiles').delete().eq('id', student.id);
    load();
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { data, error: signUpError } = await supabase.auth.admin.createUser({
      email: newEmail,
      password: newPassword,
      email_confirm: true,
      user_metadata: { first_name: newFirst, last_name: newLast },
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        email: newEmail,
        first_name: newFirst,
        last_name: newLast,
        role: 'student',
      });
    }

    setAddingStudent(false);
    setNewEmail(''); setNewPassword(''); setNewFirst(''); setNewLast('');
    load();
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Manage Students</h1>
          <p className="text-slate-500 mt-1">Add, edit, or remove students.</p>
        </div>
        <button onClick={() => setAddingStudent(true)} className="btn-primary flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add Student
        </button>
      </div>

      {addingStudent && (
        <GlassCard className="p-6 mb-6 animate-slide-up">
          <h3 className="font-semibold text-slate-700 mb-4">New Student Account</h3>
          {error && <div className="glass-input rounded-xl px-4 py-3 mb-4 text-sm text-red-600">{error}</div>}
          <form onSubmit={handleAddStudent} className="grid grid-cols-2 gap-4">
            <input type="text" required placeholder="First name" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} className="glass-input rounded-xl px-4 py-3 text-slate-800" />
            <input type="text" required placeholder="Last name" value={newLast} onChange={(e) => setNewLast(e.target.value)} className="glass-input rounded-xl px-4 py-3 text-slate-800" />
            <input type="email" required placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="glass-input rounded-xl px-4 py-3 text-slate-800" />
            <input type="password" required placeholder="Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="glass-input rounded-xl px-4 py-3 text-slate-800" />
            <div className="col-span-2 flex gap-2">
              <button type="submit" className="btn-primary flex-1">Create Account</button>
              <button type="button" onClick={() => setAddingStudent(false)} className="btn-ghost flex-1">Cancel</button>
            </div>
          </form>
        </GlassCard>
      )}

      <GlassCard className="p-6 mb-6">
        <h2 className="font-semibold text-app-primary mb-1">Student chat permissions</h2>
        <p className="text-sm text-app-muted mb-4">Allow or block student-to-student conversations. Teacher messages remain separate.</p>
        <div className="flex flex-col md:flex-row gap-3">
          <select value={permissionA} onChange={(e) => setPermissionA(e.target.value)} className="glass-input rounded-xl px-3 py-2.5 flex-1">
            <option value="">Choose first student</option>
            {students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}
          </select>
          <select value={permissionB} onChange={(e) => setPermissionB(e.target.value)} className="glass-input rounded-xl px-3 py-2.5 flex-1">
            <option value="">Choose second student</option>
            {students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}
          </select>
          <button onClick={updatePermission} className="btn-primary">Toggle access</button>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {permissions.filter((permission) => permission.allowed).map((permission) => {
            const first = students.find((student) => student.id === permission.student_a);
            const second = students.find((student) => student.id === permission.student_b);
            return first && second ? <span key={`${permission.student_a}-${permission.student_b}`} className="text-xs glass-input rounded-full px-3 py-1.5">@{first.username ?? first.first_name} + @{second.username ?? second.first_name}</span> : null;
          })}
        </div>
      </GlassCard>

      {students.length === 0 ? (
        <EmptyState
          icon={<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>}
          title="No students yet"
          subtitle="Add your first student to get started."
        />
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <GlassCard key={student.id} className="p-4 animate-slide-up">
              <div className="flex items-center gap-4">
                <Avatar url={student.avatar_url} name={`${student.first_name} ${student.last_name}`} size={48} />
                <div className="flex-1 min-w-0">
                  {editingId === student.id ? (
                    <div className="flex gap-2">
                      <input value={editName.first} onChange={(e) => setEditName({ ...editName, first: e.target.value })} className="glass-input rounded-lg px-3 py-1.5 text-sm text-slate-800" />
                      <input value={editName.last} onChange={(e) => setEditName({ ...editName, last: e.target.value })} className="glass-input rounded-lg px-3 py-1.5 text-sm text-slate-800" />
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-slate-700">{student.first_name} {student.last_name}</p>
                      <p className="text-sm text-slate-400">{student.email}</p>
                    </>
                  )}
                </div>
                <div className="hidden md:block text-right">
                  <p className="text-xs text-slate-400">Last active</p>
                  <p className="text-sm text-slate-600">{student.lastActive ? formatRelative(student.lastActive) : 'Never'}</p>
                </div>
                <div className="hidden lg:block text-right">
                  <p className="text-xs text-slate-400">DEARs</p>
                  <p className="text-sm text-slate-600">{student.submissions.length}</p>
                </div>
                {editingId === student.id ? (
                  <div className="flex gap-2">
                    <button onClick={() => handleSave(student.id)} className="p-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-2 rounded-lg glass-input text-slate-500">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(student)} className="p-2 rounded-lg hover:bg-white/40 transition text-slate-500" title="Edit">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(student)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition" title="Delete">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>
                )}
              </div>

              {student.logs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200/50">
                  <p className="text-xs text-slate-400 mb-2">RECENT ACTIVITY</p>
                  <div className="space-y-1">
                    {student.logs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">{formatRelative(log.created_at)}</span>
                        <span className="text-slate-600">{log.action.replace(/_/g, ' ')}</span>
                        {log.detail && <span className="text-slate-400">- {log.detail}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
