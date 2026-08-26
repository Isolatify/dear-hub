import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let pdfDoc: PDFDocumentProxy | null = null;

    const render = async () => {
      setLoading(true);
      setLoadProgress(0);
      setCurrentPage(0);

      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = await import('pdfjs-dist/build/pdf.worker.min.mjs?url').then((m) => m.default);

        const loadingParams = {
          url,
          onProgress: ({ loaded, total }: { loaded: number; total: number }) => {
            if (total > 0) {
              setLoadProgress(Math.min(100, Math.round((loaded / total) * 100)));
            }
          },
        } as Parameters<typeof pdfjs.getDocument>[0];
        const loadingTask = pdfjs.getDocument(loadingParams);
        pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        const total = pdfDoc.numPages;
        setNumPages(total);

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        for (let i = 1; i <= total; i++) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: (zoom / 100) * 1.5, rotation });

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.maxWidth = '100%';
          canvas.style.height = 'auto';
          canvas.style.margin = '0 auto 12px';
          canvas.style.display = 'block';
          canvas.style.borderRadius = '8px';
          canvas.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';

          container.appendChild(canvas);
          await page.render({ canvas, canvasContext: ctx, viewport }).promise;
          setCurrentPage(i);
        }

        setLoadProgress(100);
        setLoading(false);
      } catch (err) {
        console.error('PDF render error:', err);
        setLoading(false);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);">Failed to load PDF. <a href="${url}" target="_blank" style="color:var(--primary-color);">Open in new tab</a></div>`;
        }
      }
    };

    render();

    return () => {
      cancelled = true;
      if (pdfDoc) pdfDoc.cleanup();
    };
  }, [url, zoom, rotation]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="glass rounded-xl p-2 mb-3 flex items-center gap-1 flex-wrap">
        <button
          onClick={() => setZoom(Math.max(50, zoom - 25))}
          className="p-2 rounded-lg hover:bg-white/40 dark:hover:bg-white/10 transition text-app-secondary"
          title="Zoom out"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="8" y1="11" x2="14" y2="11" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        </button>
        <span className="text-sm text-app-secondary px-2 min-w-[50px] text-center">{zoom}%</span>
        <button
          onClick={() => setZoom(Math.min(200, zoom + 25))}
          className="p-2 rounded-lg hover:bg-white/40 dark:hover:bg-white/10 transition text-app-secondary"
          title="Zoom in"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        </button>
        <div className="w-px h-6 bg-slate-200/50 mx-1" />
        <button
          onClick={() => setZoom(100)}
          className="px-3 py-1.5 rounded-lg hover:bg-white/40 dark:hover:bg-white/10 transition text-sm text-app-secondary"
          title="Fit to width"
        >
          Fit
        </button>
        <button
          onClick={() => setRotation((rotation + 90) % 360)}
          className="p-2 rounded-lg hover:bg-white/40 dark:hover:bg-white/10 transition text-app-secondary"
          title="Rotate"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
        </button>
        <div className="flex-1" />
        {loading && numPages > 0 && (
          <span className="text-xs text-app-muted px-2">{currentPage}/{numPages} pages</span>
        )}
        <a
          href={url}
          download
          className="p-2 rounded-lg hover:bg-white/40 dark:hover:bg-white/10 transition text-app-secondary"
          title="Download"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        </a>
        <button
          onClick={() => window.open(url, '_blank')}
          className="p-2 rounded-lg hover:bg-white/40 dark:hover:bg-white/10 transition text-app-secondary"
          title="Open in new tab"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
        </button>
      </div>

      {/* Loading progress bar */}
      {loading && (
        <div className="glass rounded-xl p-4 mb-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="border-2 border-slate-200 dark:border-slate-600 border-t-[var(--primary-color)] rounded-full animate-spin w-5 h-5 shrink-0" />
            <span className="text-sm text-app-secondary">
              {loadProgress < 100 ? `Loading PDF... ${loadProgress}%` : 'Rendering pages...'}
            </span>
            {numPages > 0 && currentPage > 0 && (
              <span className="text-xs text-app-muted ml-auto">{currentPage}/{numPages}</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-slate-200/50 dark:bg-slate-700/50 overflow-hidden">
            <div
              className="h-full gradient-bg rounded-full transition-all duration-300"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* PDF content */}
      <div className="flex-1 overflow-auto glass rounded-xl p-4">
        <div ref={containerRef} />
      </div>
    </div>
  );
}
