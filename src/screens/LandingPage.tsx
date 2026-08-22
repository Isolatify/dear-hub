import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center max-w-2xl animate-fade-in">
          <div className="inline-flex items-center justify-center mb-6">
            <Logo size={80} />
          </div>

          <h1 className="text-5xl font-bold gradient-text mb-4">DEAR Hub</h1>
          <p className="text-lg text-app-secondary mb-2">
            Drop Everything And Read — made simple.
          </p>
          <p className="text-sm text-app-muted mb-10 max-w-md mx-auto">
            A dedicated workspace for students to read, summarize, and reflect on their DEAR assignments — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/auth')}
              className="btn-primary px-8 py-3.5 text-base flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Student Sign In
            </button>
            <button
              onClick={() => navigate('/teacher')}
              className="btn-ghost px-8 py-3.5 text-base flex items-center justify-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
              Teacher Portal
            </button>
          </div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="px-4 pb-12">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-5 text-center animate-slide-up">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-bg mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <h3 className="font-medium text-app-primary mb-1">Read & Write</h3>
            <p className="text-xs text-app-muted">Split-screen PDF reader with a full word processor</p>
          </div>
          <div className="glass rounded-2xl p-5 text-center animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-bg mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3 className="font-medium text-app-primary mb-1">Real-Time</h3>
            <p className="text-xs text-app-muted">Live activity tracking and instant feedback</p>
          </div>
          <div className="glass rounded-2xl p-5 text-center animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl gradient-bg mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </div>
            <h3 className="font-medium text-app-primary mb-1">AI Checker</h3>
            <p className="text-xs text-app-muted">Writing analyzed for AI vs human patterns</p>
          </div>
        </div>
      </div>
    </div>
  );
}
