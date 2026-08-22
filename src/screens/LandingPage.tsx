import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';
import { Columns3, PenLine, Radio, Bot, Bell, MessageSquare, Palette, SunMoon } from 'lucide-react';

const CAROUSEL_IMAGES = [
  '/assets/images/themes/Screenshot_2026-08-22_120328.png',
  '/assets/images/themes/Screenshot_2026-08-22_120416.png',
  '/assets/images/themes/Screenshot_2026-08-22_120426.png',
  '/assets/images/themes/image.png',
];

const QUOTES = [
  { text: 'The more that you read, the more things you will know. The more that you learn, the more places you\'ll go.', author: 'Dr. Seuss' },
  { text: 'Reading is to the mind what exercise is to the body.', author: 'Joseph Addison' },
  { text: 'A reader lives a thousand lives before he dies. The man who never reads lives only one.', author: 'George R.R. Martin' },
  { text: 'Books are a uniquely portable magic.', author: 'Stephen King' },
  { text: 'Today a reader, tomorrow a leader.', author: 'Margaret Fuller' },
  { text: 'The world belongs to those who read.', author: 'Anonymous' },
  { text: 'Reading is a discount ticket to everywhere.', author: 'Mary Schmich' },
  { text: 'Once you learn to read, you will be forever free.', author: 'Frederick Douglass' },
  { text: 'A book is a dream that you hold in your hand.', author: 'Neil Gaiman' },
  { text: 'There is no friend as loyal as a book.', author: 'Ernest Hemingway' },
  { text: 'Reading gives us someplace to go when we have to stay where we are.', author: 'Mason Cooley' },
  { text: 'The journey of a lifetime starts with the turning of a page.', author: 'Rachel Anders' },
  { text: 'Books let us into their souls and let us out to ours.', author: 'Harold Bloom' },
  { text: 'When you read a great book, you don\'t escape from life. You plunge deeper into it.', author: 'Matt Haig' },
];

const FAQS = [
  { q: 'What does DEAR stand for?', a: 'DEAR stands for "Drop Everything And Read" — a classroom practice where students set aside all other work and spend dedicated time reading.' },
  { q: 'How do I get started as a student?', a: 'Click "Student Sign In" on the home page, create your account, and you\'ll be guided through a quick profile setup. Your teacher\'s assignments will appear on your dashboard automatically.' },
  { q: 'How do I get started as a teacher?', a: 'Click "Teacher Portal" and sign in with your teacher email. You can then create DEAR assignments, upload PDFs, monitor student progress in real time, and grade submissions.' },
  { q: 'Can I read the PDF and write my summary at the same time?', a: 'Yes! The DEAR workspace has a split-screen view — the PDF reader sits on one side and a full word processor on the other. You can drag the divider to resize each side.' },
  { q: 'Does DEAR Hub work on my phone?', a: 'Absolutely. The entire app is responsive and works on phones, tablets, and desktops. The layout adapts automatically to your screen size.' },
  { q: 'Is my work saved automatically?', a: 'Yes. Everything you type in the word processor is auto-saved with a debounce, so you\'ll never lose progress. You can also submit your DEAR when you\'re done for teacher review.' },
  { q: 'What is the AI Checker?', a: 'The AI Checker analyzes student writing patterns to help teachers distinguish between human-written and AI-generated text, supporting academic integrity.' },
  { q: 'Can I customize how the app looks?', a: 'Yes! Both students and teachers can choose from 12 color themes, light or dark mode, multiple fonts, glass intensity, and dashboard layouts — all in Settings.' },
];

const PARTNERS = [
  { name: 'Bolt', url: 'https://bolt.new', logo: '/assets/logo/bolt.svg', desc: 'AI-powered app builder' },
  { name: 'GitHub', url: 'https://github.com/Isolatify/dear-hub', logo: '/assets/logo/github.svg', desc: 'Source code & version control' },
  { name: 'The Isolatify Brand', url: '#isolatify', logo: '/assets/logo/ig.png', desc: 'Design & development', isPopup: true },
  { name: 'Vercel', url: 'https://vercel.com', logo: '/assets/logo/vercel.svg', desc: 'Deployment & hosting' },
  { name: 'Supabase', url: 'https://supabase.com', logo: '/assets/logo/supabase.svg', desc: 'Database & authentication' },
  { name: 'React', url: 'https://react.dev', logo: '/assets/logo/react.svg', desc: 'UI framework' },
  { name: 'TypeScript', url: 'https://www.typescriptlang.org', logo: '/assets/logo/ts.svg', desc: 'Type-safe JavaScript' },
  { name: 'Tailwind CSS', url: 'https://tailwindcss.com', logo: '/assets/logo/tailwindcss.svg', desc: 'Styling framework' },
  { name: 'pdf.js', url: 'https://mozilla.github.io/pdf.js/', logo: '/assets/logo/pdfjs.webp', desc: 'PDF rendering engine' },
  { name: 'Vite', url: 'https://vitejs.dev', logo: '/assets/logo/vite.svg', desc: 'Build tool & dev server' },
];

const FEATURES = [
  { icon: Columns3, title: 'Split-Screen Reader', desc: 'Read your PDF and write your summary side by side — no tab switching needed.' },
  { icon: PenLine, title: 'Full Word Processor', desc: 'Rich text editing with headings, lists, bold, italic, and more. Your work auto-saves.' },
  { icon: Radio, title: 'Real-Time Activity', desc: 'Teachers can see who\'s reading, who\'s writing, and who\'s stuck — all live.' },
  { icon: Bot, title: 'AI Checker', desc: 'Writing is analyzed for AI vs human patterns to support academic integrity.' },
  { icon: Bell, title: 'Announcements', desc: 'Teachers post updates; students see them instantly on their dashboard.' },
  { icon: MessageSquare, title: 'Messaging', desc: 'Built-in chat between teachers and students for quick questions and feedback.' },
  { icon: Palette, title: '12 Color Themes', desc: 'Personalize with themes like Fire, Ocean, Emerald, Midnight, and more.' },
  { icon: SunMoon, title: 'Light & Dark Mode', desc: 'Switch between light and dark mode anytime. The whole app adapts instantly.' },
];

const DIGITAL_VS_PAPER = [
  { digital: 'Auto-saves every keystroke — never lose work', paper: 'Lost papers, forgotten notebooks, spilled water' },
  { digital: 'Read PDF + write summary in one split screen', paper: 'Print PDFs, write in a separate notebook, switch back and forth' },
  { digital: 'Teacher sees progress live and gives instant feedback', paper: 'Teacher collects papers Friday, returns them Monday' },
  { digital: 'AI checker flags AI-generated text automatically', paper: 'No way to detect AI-written summaries' },
  { digital: 'Works on any device — phone, tablet, laptop', paper: 'Need a physical copy everywhere you go' },
  { digital: '12 themes, dark mode, custom layouts', paper: 'It\'s paper. It\'s white. That\'s it.' },
];

function getDailyQuote() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

export function LandingPage() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isolatifyPopup, setIsolatifyPopup] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = !!session && !!profile;
  const dailyQuote = getDailyQuote();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % CAROUSEL_IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePartnerClick = (partner: typeof PARTNERS[number]) => {
    if (partner.isPopup) {
      setIsolatifyPopup(true);
    } else {
      window.open(partner.url, '_blank');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'p-3' : 'p-0'
        }`}
      >
        <nav
          className={`flex items-center justify-between transition-all duration-300 ${
            scrolled
              ? 'glass rounded-2xl px-5 py-3 max-w-6xl mx-auto'
              : 'bg-transparent px-6 py-4 max-w-6xl mx-auto'
          }`}
        >
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Logo size={scrolled ? 32 : 36} />
            <span className="font-bold text-lg gradient-text">DEAR Hub</span>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-sm font-medium text-app-secondary hover:text-app-primary transition">
              Home
            </button>
            <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-app-secondary hover:text-app-primary transition">
              Features
            </button>
            <button onClick={() => scrollToSection('faq')} className="text-sm font-medium text-app-secondary hover:text-app-primary transition">
              FAQ
            </button>
            <a
              href="https://github.com/Isolatify/dear-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-app-secondary hover:text-app-primary transition"
              title="GitHub"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <button
              onClick={() => isLoggedIn ? navigate(profile?.role === 'teacher' ? '/teacher/dashboard' : '/dashboard') : window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="btn-primary px-5 py-2 text-sm flex items-center gap-2"
            >
              {isLoggedIn ? 'Enter' : 'Log In'}
            </button>
          </div>

          {/* Mobile menu */}
          <div className="md:hidden flex items-center gap-2">
            <a
              href="https://github.com/Isolatify/dear-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-app-secondary hover:text-app-primary transition"
              title="GitHub"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            <button
              onClick={() => isLoggedIn ? navigate(profile?.role === 'teacher' ? '/teacher/dashboard' : '/dashboard') : window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="btn-primary px-4 py-2 text-sm"
            >
              {isLoggedIn ? 'Enter' : 'Log In'}
            </button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="min-h-screen flex items-center justify-center px-4 pt-20">
        <div className="text-center max-w-3xl animate-fade-in">
          <div className="inline-flex items-center justify-center mb-6">
            <Logo size={88} />
          </div>

          <h1 className="text-5xl md:text-6xl font-bold gradient-text mb-4">DEAR Hub</h1>
          <p className="text-xl text-app-secondary mb-3">
            Drop Everything And Read — made simple.
          </p>
          <p className="text-base text-app-muted mb-10 max-w-lg mx-auto">
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
      </section>

      {/* Image Carousel */}
      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-app-primary text-center mb-8">See it in action</h2>
          <div className="relative rounded-3xl overflow-hidden glass p-2" ref={carouselRef}>
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-100 dark:bg-slate-800">
              {CAROUSEL_IMAGES.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`DEAR Hub screenshot ${i + 1}`}
                  className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ${
                    i === carouselIndex ? 'opacity-100' : 'opacity-0'
                  }`}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ))}
            </div>
            {/* Dots */}
            <div className="flex justify-center gap-2 mt-3">
              {CAROUSEL_IMAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCarouselIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === carouselIndex ? 'w-8 gradient-bg' : 'w-2 bg-slate-300 dark:bg-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Daily Quote */}
      <section className="px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-5xl mb-4 opacity-20">"</div>
          <blockquote className="text-xl md:text-2xl font-medium text-app-primary leading-relaxed mb-4">
            {dailyQuote.text}
          </blockquote>
          <p className="text-sm text-app-muted">— {dailyQuote.author}</p>
          <p className="text-xs text-app-muted mt-6">A new quote every day</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-app-primary text-center mb-3">Everything you need</h2>
          <p className="text-app-muted text-center mb-12 max-w-md mx-auto">
            From reading to writing to grading — DEAR Hub covers the entire DEAR workflow.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="glass rounded-2xl p-6 text-center animate-slide-up card-hover"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-bg mb-4">
                    <Icon size={26} color="white" strokeWidth={2} />
                  </div>
                  <h3 className="font-semibold text-app-primary mb-2">{feature.title}</h3>
                  <p className="text-sm text-app-muted leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Digital vs Paper */}
      <section className="px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-app-primary text-center mb-3">Why digital beats paper</h2>
          <p className="text-app-muted text-center mb-12 max-w-md mx-auto">
            This is why DEAR Hub was created — to leave paper behind.
          </p>
          <div className="glass rounded-3xl overflow-hidden">
            <div className="grid grid-cols-2 gap-px bg-slate-200/30 dark:bg-slate-700/30">
              <div className="glass p-5 text-center">
                <p className="text-sm font-bold gradient-text">DEAR Hub</p>
              </div>
              <div className="glass p-5 text-center">
                <p className="text-sm font-bold text-app-muted">Paper</p>
              </div>
            </div>
            {DIGITAL_VS_PAPER.map((row, i) => (
              <div key={i} className="grid grid-cols-2 gap-px bg-slate-200/30 dark:bg-slate-700/30">
                <div className="glass p-4 flex items-start gap-2">
                  <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                  <p className="text-sm text-app-secondary">{row.digital}</p>
                </div>
                <div className="glass p-4 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                  <p className="text-sm text-app-muted">{row.paper}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How Easy */}
      <section className="px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-app-primary text-center mb-3">How easy is it?</h2>
          <p className="text-app-muted text-center mb-12 max-w-md mx-auto">
            Three steps. That's it.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '1', title: 'Sign In', desc: 'Create your student account in seconds. Your teacher\'s assignments show up automatically.' },
              { step: '2', title: 'Read & Write', desc: 'Open a DEAR, read the PDF on the left, write your summary on the right. Everything auto-saves.' },
              { step: '3', title: 'Submit', desc: 'Click submit when you\'re done. Your teacher reviews your work and sends feedback instantly.' },
            ].map((item, i) => (
              <div key={item.step} className="glass rounded-2xl p-6 text-center animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full gradient-bg text-white font-bold text-lg mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-app-primary mb-2">{item.title}</h3>
                <p className="text-sm text-app-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners */}
      <section className="px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-app-primary text-center mb-3">Built with amazing partners</h2>
          <p className="text-app-muted text-center mb-12 max-w-md mx-auto">
            DEAR Hub wouldn't exist without these incredible tools and communities.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {PARTNERS.map((partner, i) => (
              <button
                key={partner.name}
                onClick={() => handlePartnerClick(partner)}
                className="glass rounded-2xl p-5 text-center card-hover animate-slide-up group flex flex-col items-center"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <img src={partner.logo} alt={partner.name} className="h-12 w-12 object-contain mb-2" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <p className="text-sm font-semibold text-app-primary group-hover:text-[var(--primary-color)] transition">{partner.name}</p>
                <p className="text-xs text-app-muted mt-1">{partner.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-4 py-20">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-app-primary text-center mb-3">Frequently asked questions</h2>
          <p className="text-app-muted text-center mb-12">Everything you might want to know.</p>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="glass rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <span className="text-sm font-medium text-app-primary">{faq.q}</span>
                  <svg
                    width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`shrink-0 text-app-muted transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 animate-slide-up">
                    <p className="text-sm text-app-secondary leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20">
        <div className="max-w-2xl mx-auto text-center glass rounded-3xl p-10">
          <h2 className="text-2xl font-bold text-app-primary mb-3">Ready to DEAR?</h2>
          <p className="text-app-muted mb-8">Join your class and start reading today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => navigate('/auth')} className="btn-primary px-8 py-3.5">
              Get Started
            </button>
            <button onClick={() => navigate('/teacher')} className="btn-ghost px-8 py-3.5">
              Teacher Portal
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-10 border-t border-slate-200/30 dark:border-slate-700/30">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-semibold text-app-primary">DEAR Hub</span>
          </div>
          <a
            href="https://github.com/Isolatify/dear-hub"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-app-secondary hover:text-app-primary transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            GitHub
          </a>
          <p className="text-sm text-app-muted">
            &copy; {new Date().getFullYear()} | The Isolatify Brand | All rights reserved
          </p>
        </div>
      </footer>

      {/* Isolatify popup */}
      {isolatifyPopup && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setIsolatifyPopup(false)}
        >
          <div
            className="glass-strong rounded-3xl p-8 max-w-md w-full animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold gradient-text">The Isolatify Brand</h3>
              <button onClick={() => setIsolatifyPopup(false)} className="text-app-muted hover:text-app-primary transition">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-app-secondary leading-relaxed">
              The Isolatify Brand is a mini-company that specializes in games (Isolation Games), apps (Isolatify Apps), animations (Isolation Animations) & design (Isolation Designs). This company is founded and ran by @Isolatify & started in 2024.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
