import { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';

const CURRENT_VERSION = '1.1.0';
const STORAGE_KEY = 'dear-hub-seen-version';

const LATEST_CHANGES = [
  'Mega dashboards with 14 student & 8 teacher widgets',
  'WhatsApp-style messaging with call overlay',
  'Sapling AI Detection API integration',
  'GradeScreen remake with split pane & auto AI check',
  'ManageStudents with search & expandable cards',
  'Browser alerts replaced with glass ConfirmModal',
  'PDF rotation bug fix & submission locking',
  'Mobile responsiveness across all screens',
];

export function UpdatePopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== CURRENT_VERSION) {
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={dismiss}
    >
      <div
        className="glass-strong rounded-3xl p-7 max-w-md w-full animate-scale-in relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-1 gradient-bg" />

        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-app-muted hover:text-app-primary transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-white shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-app-primary">What's New</h3>
            <p className="text-xs text-app-muted">DEAR Hub v{CURRENT_VERSION}</p>
          </div>
        </div>

        <ul className="space-y-2 mb-5">
          {LATEST_CHANGES.map((change, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-app-secondary">
              <span className="text-[var(--primary-color)] mt-1 shrink-0">•</span>
              {change}
            </li>
          ))}
        </ul>

        <button onClick={dismiss} className="btn-primary w-full py-2.5 text-sm rounded-xl">
          Got it!
        </button>
      </div>
    </div>
  );
}
