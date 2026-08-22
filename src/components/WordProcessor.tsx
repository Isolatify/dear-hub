import { useEffect, useRef, useState } from 'react';

interface WordProcessorProps {
  initialContent: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  showToolbar?: boolean;
}

export function WordProcessor({
  initialContent,
  onChange,
  readOnly = false,
  showToolbar = true,
}: WordProcessorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = useState(0);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (editorRef.current && initialContent !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = initialContent || '';
      updateWordCount();
    }
  }, [initialContent]);

  const updateWordCount = () => {
    if (!editorRef.current) return;
    const text = editorRef.current.innerText || '';
    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
  };

  const exec = (command: string, value?: string) => {
    if (readOnly) return;
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleInput = () => {
    setSaved(false);
    updateWordCount();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    setSaved(true);
  };

  const toolBtn = (icon: React.ReactNode, command: string, value: string | undefined, title: string) => (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); exec(command, value); }}
      className="p-2 rounded-lg hover:bg-white/50 transition text-slate-600"
      title={title}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      {showToolbar && !readOnly && (
        <div className="glass rounded-xl p-2 mb-3 flex items-center gap-0.5 flex-wrap">
          {toolBtn(<strong>B</strong>, 'bold', undefined, 'Bold')}
          {toolBtn(<em>I</em>, 'italic', undefined, 'Italic')}
          {toolBtn(<u>U</u>, 'underline', undefined, 'Underline')}
          <div className="w-px h-6 bg-slate-200 mx-1" />
          {toolBtn(<span className="font-semibold">H1</span>, 'formatBlock', '<h1>', 'Heading 1')}
          {toolBtn(<span className="font-semibold">H2</span>, 'formatBlock', '<h2>', 'Heading 2')}
          {toolBtn(<span className="font-semibold">H3</span>, 'formatBlock', '<h3>', 'Heading 3')}
          {toolBtn(<span>P</span>, 'formatBlock', '<p>', 'Paragraph')}
          <div className="w-px h-6 bg-slate-200 mx-1" />
          {toolBtn(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>,
            'insertUnorderedList', undefined, 'Bullet List'
          )}
          {toolBtn(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" /><path d="M4 6h1v4" /><path d="M4 10v2" /><path d="M6 8h-2" /><path d="M4 18h1v-2" /><path d="M4 14h1v4" /></svg>,
            'insertOrderedList', undefined, 'Numbered List'
          )}
          <div className="w-px h-6 bg-slate-200 mx-1" />
          {toolBtn(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
            'justifyLeft', undefined, 'Align Left'
          )}
          {toolBtn(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
            'justifyCenter', undefined, 'Align Center'
          )}
          {toolBtn(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6" /><line x1="6" y1="12" x2="18" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>,
            'justifyRight', undefined, 'Align Right'
          )}
          <div className="w-px h-6 bg-slate-200 mx-1" />
          {toolBtn(
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V7" /><path d="M3 7l9 6 9-6" /></svg>,
            'formatBlock', '<blockquote>', 'Quote'
          )}
          <input
            type="color"
            onChange={(e) => exec('foreColor', e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
            title="Text Color"
          />
          <input
            type="color"
            onChange={(e) => exec('hiliteColor', e.target.value)}
            className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
            title="Highlight"
          />
          <div className="flex-1" />
          <select
            onChange={(e) => exec('fontSize', e.target.value)}
            className="glass-input rounded-lg px-2 py-1 text-sm text-slate-600"
            defaultValue="3"
          >
            <option value="2">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="6">X-Large</option>
          </select>
        </div>
      )}

      <div className="flex-1 overflow-auto glass rounded-xl p-6 bg-white/60">
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          onInput={handleInput}
          className="wp-content min-h-full text-slate-800 leading-relaxed"
          style={{ minHeight: '400px' }}
          data-placeholder="Start writing your summaries and reflections here..."
        />
      </div>

      <div className="flex items-center justify-between mt-2 px-2">
        <span className="text-xs text-slate-400">
          {wordCount} words
        </span>
        <span className={`text-xs ${saved ? 'text-green-500' : 'text-amber-500'}`}>
          {saved ? 'Saved' : 'Saving...'}
        </span>
      </div>
    </div>
  );
}
