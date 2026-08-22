# DEAR Hub

DEAR Hub is a focused reading and reflection workspace for classrooms and homeschool learning. It gives students one place to read a DEAR assignment, write a summary, track their progress, and submit their work while teachers manage assignments and review student activity from a live dashboard.

> **DEAR** means **Drop Everything And Read**.

## Live app

Try DEAR Hub at **[dear-hub.vercel.app](https://dear-hub.vercel.app)**.

Students can sign in or create an account from the app. Teacher access is restricted to the configured teacher account.

## Highlights

### For students

- Browse active DEAR assignments and see due dates, status, and completion progress.
- Read an uploaded PDF beside a rich-text writing workspace.
- Format writing with headings, lists, alignment, text color, highlighting, and block quotes.
- Auto-save drafts while writing and submit completed work for review.
- View teacher announcements and reply to them.
- Message the teacher directly through built-in chat.
- Receive live activity and presence updates.
- Customize the interface with light or dark mode, 12 color themes, layouts, fonts, glass intensity, and animation preferences.

### For teachers

- Create DEAR assignments by uploading a PDF and setting the term, week, and due date.
- Monitor student progress and online presence from a dashboard.
- Manage student accounts and profile information.
- Peek at current student work in real time.
- Review submissions alongside the source PDF.
- Approve or fail submissions with written feedback.
- Run a heuristic AI-writing analysis that reports likely human, likely AI, or mixed signals.
- Publish announcements and chat privately with students.

## Screenshots

The landing page includes an in-app product carousel. The source images are available in [`public/assets/images/themes`](public/assets/images/themes).

## Built with

- React 18 and TypeScript
- Vite
- React Router
- Tailwind CSS
- Supabase Auth, PostgreSQL, Storage, Realtime, and Row Level Security
- `pdfjs-dist` for PDF rendering
- `lucide-react` for icons
- `canvas-confetti` for submission feedback
- `date-fns` for date formatting

## Authentication and roles

Students can create an account with email/password or Google sign-in and complete a short profile onboarding flow. New profiles default to the `student` role.

The teacher portal is currently allowlisted in the UI to `gaghzy@gmail.com`. That account must exist in Supabase Auth and have a matching profile with `role = 'teacher'`. This is an application-specific access rule and should be changed before adapting DEAR Hub for multiple teachers.

## Project structure

```text
src/
	components/   Shared navigation, UI, PDF, and editor components
	context/      Authentication, theme, and toast providers
	lib/          Supabase client, realtime helpers, AI checker, utilities
	screens/      Landing, auth, student, and teacher views
	types/        Shared domain and theme types
supabase/
	migrations/   Database schema, RLS policies, storage buckets, and indexes
public/
	assets/       Logos and landing-page imagery
```

## Realtime behavior

Supabase Realtime powers assignment and submission refreshes, announcements, teacher activity views, workspace updates, and presence indicators. Realtime must be available for the live-monitoring features to work as intended.

## AI checker note

The AI Checker is a local heuristic analyzer, not a trained machine-learning detector. It evaluates signals such as sentence-length variation, vocabulary diversity, repeated wording, punctuation patterns, and common AI-associated phrases. Its result is an aid for teacher review and should not be treated as definitive proof of authorship.

## License

No license has been specified yet. Add a license file before distributing or accepting external contributions under a defined reuse policy.
