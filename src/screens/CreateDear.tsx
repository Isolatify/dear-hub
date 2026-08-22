import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { GlassCard, Spinner } from '@/components/ui';
import type { Dear } from '@/types';

export function CreateDear() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [term, setTerm] = useState('Term 1');
  const [week, setWeek] = useState('Week 1');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    setUploadProgress(0);
    setFileName(file.name);

    const fileName = `dear-${Date.now()}-${file.name}`;
    const path = `${profile.id}/${fileName}`;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const uploadEndpoint = `${supabaseUrl}/storage/v1/object/dear-files/${path}`;

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { data } = supabase.storage.from('dear-files').getPublicUrl(path);
        setPdfUrl(data.publicUrl);
        setUploadProgress(100);
        toast('PDF uploaded successfully!', 'success');
      } else {
        toast('Upload failed. Please try again.', 'error');
      }
      setUploading(false);
    };

    xhr.onerror = () => {
      toast('Upload failed. Please check your connection.', 'error');
      setUploading(false);
    };

    xhr.open('POST', uploadEndpoint);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.send(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdfUrl || !profile) {
      toast('Please upload a PDF first.', 'warning');
      return;
    }
    if (!dueDate) {
      toast('Please set a due date.', 'warning');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('dears').insert({
      teacher_id: profile.id,
      pdf_url: pdfUrl,
      term: term.trim(),
      week: week.trim(),
      due_date: dueDate,
      status: 'active',
    });

    if (error) {
      toast(error.message, 'error');
      setSaving(false);
      return;
    }

    toast('DEAR published successfully!', 'success');
    navigate('/teacher/dashboard');
  };

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6 animate-fade-in">
        <button
          onClick={() => navigate('/teacher/dashboard')}
          className="text-sm text-app-secondary hover:text-app-primary mb-2 flex items-center gap-1"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          Back
        </button>
        <h1 className="text-2xl font-semibold text-app-primary">Create New DEAR</h1>
        <p className="text-app-secondary mt-1">Upload a PDF magazine and set the week and term.</p>
      </div>

      <GlassCard className="p-6 animate-slide-up">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* PDF Upload */}
          <div>
            <label className="text-sm font-medium text-app-secondary mb-2 block">PDF Magazine</label>
            {pdfUrl ? (
              <div className="glass-input rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                  <span className="text-sm text-app-secondary">PDF uploaded successfully</span>
                </div>
                <button type="button" onClick={() => setPdfUrl(null)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
              </div>
            ) : (
              <label className="glass-input rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-white/60 transition border-dashed border-2 border-slate-200">
                {uploading ? (
                  <div className="w-full max-w-xs">
                    <div className="flex items-center justify-center mb-3">
                      <Spinner size={32} />
                    </div>
                    <p className="text-sm text-app-secondary text-center mb-2">Uploading {fileName}...</p>
                    <div className="w-full bg-slate-200/50 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="gradient-bg h-full rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-app-muted text-center mt-2">{uploadProgress}%</p>
                  </div>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    <p className="text-sm text-app-secondary mt-2">Click to upload a PDF</p>
                    <p className="text-xs text-app-muted mt-1">The magazine your students will read</p>
                  </>
                )}
                <input type="file" accept="application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
              </label>
            )}
          </div>

          {/* Week */}
          <div>
            <label className="text-sm font-medium text-app-secondary mb-1.5 block">Week</label>
            <input
              type="text"
              required
              value={week}
              onChange={(e) => setWeek(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-3"
              placeholder="e.g. Week 5"
            />
          </div>

          {/* Term */}
          <div>
            <label className="text-sm font-medium text-app-secondary mb-1.5 block">Term</label>
            <input
              type="text"
              required
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-3"
              placeholder="e.g. Term 1"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="text-sm font-medium text-app-secondary mb-1.5 block">Due Date</label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="glass-input w-full rounded-xl px-4 py-3"
            />
          </div>

          <div className="glass-input rounded-xl p-3 flex items-center gap-2 text-sm text-app-secondary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            The title will be: <strong className="text-app-primary">{week} - {term}</strong>
          </div>

          <button type="submit" disabled={saving || !pdfUrl} className="btn-primary w-full flex items-center justify-center gap-2">
            {saving ? <Spinner size={20} /> : 'Publish DEAR'}
          </button>
        </form>
      </GlassCard>
    </div>
  );
}
