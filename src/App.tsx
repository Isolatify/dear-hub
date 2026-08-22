import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { StudentNav } from '@/components/StudentNav';
import { TeacherNav } from '@/components/TeacherNav';
import { Spinner } from '@/components/ui';

import { AuthScreen } from '@/screens/AuthScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { ConfirmEmailScreen } from '@/screens/ConfirmEmailScreen';
import { LandingPage } from '@/screens/LandingPage';
import { TeacherLinkScreen } from '@/screens/TeacherLinkScreen';
import { StudentDashboard } from '@/screens/StudentDashboard';
import { DearWorkspace } from '@/screens/DearWorkspace';
import { AnnouncementsScreen } from '@/screens/AnnouncementsScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { TeacherDashboard } from '@/screens/TeacherDashboard';
import { CreateDear } from '@/screens/CreateDear';
import { ManageStudents } from '@/screens/ManageStudents';
import { LiveActivity } from '@/screens/LiveActivity';
import { GradeScreen } from '@/screens/GradeScreen';
import { PeekScreen } from '@/screens/PeekScreen';
import { TeacherDearsScreen } from '@/screens/TeacherDearsScreen';
import { TeacherSubmissionsScreen } from '@/screens/TeacherSubmissionsScreen';
import { TeacherAnalyticsScreen } from '@/screens/TeacherAnalyticsScreen';

function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <StudentNav />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <TeacherNav />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

function TeacherRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  if (!profile) {
    return <TeacherLinkScreen />;
  }

  if (profile.role !== 'teacher') {
    return <Navigate to="/dashboard" replace />;
  }

  return <TeacherLayout>{children}</TeacherLayout>;
}

function AppRoutes() {
  const { loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  return (
    <Routes>
      {/* Teacher sign-in (email-locked to gaghzy@gmail.com) */}
      <Route path="/teacher" element={<TeacherLinkScreen />} />

      {/* Teacher routes (require teacher profile) */}
      <Route path="/teacher/dashboard" element={<TeacherRoute><TeacherDashboard /></TeacherRoute>} />
      <Route path="/teacher/create" element={<TeacherRoute><CreateDear /></TeacherRoute>} />
      <Route path="/teacher/dears" element={<TeacherRoute><TeacherDearsScreen /></TeacherRoute>} />
      <Route path="/teacher/submissions" element={<TeacherRoute><TeacherSubmissionsScreen /></TeacherRoute>} />
      <Route path="/teacher/analytics" element={<TeacherRoute><TeacherAnalyticsScreen /></TeacherRoute>} />
      <Route path="/teacher/students" element={<TeacherRoute><ManageStudents /></TeacherRoute>} />
      <Route path="/teacher/live" element={<TeacherRoute><LiveActivity /></TeacherRoute>} />
      <Route path="/teacher/grade/:dearId" element={<TeacherRoute><GradeScreen /></TeacherRoute>} />
      <Route path="/teacher/peek/:studentId" element={<TeacherRoute><PeekScreen /></TeacherRoute>} />
      <Route path="/teacher/announcements" element={<TeacherRoute><AnnouncementsScreen isTeacher /></TeacherRoute>} />
      <Route path="/teacher/messages" element={<TeacherRoute><ChatScreen /></TeacherRoute>} />
      <Route path="/teacher/messages/:recipientId" element={<TeacherRoute><ChatScreen /></TeacherRoute>} />
      <Route path="/teacher/settings" element={<TeacherRoute><SettingsScreen isTeacher /></TeacherRoute>} />

      {/* Student routes (require auth + onboarding) */}
      <Route path="/dashboard" element={
        <ProtectedRoute><StudentLayout><StudentDashboard /></StudentLayout></ProtectedRoute>
      } />
      <Route path="/dear/:dearId" element={
        <ProtectedRoute><DearWorkspace /></ProtectedRoute>
      } />
      <Route path="/announcements" element={
        <ProtectedRoute><StudentLayout><AnnouncementsScreen isTeacher={false} /></StudentLayout></ProtectedRoute>
      } />
      <Route path="/messages" element={
        <ProtectedRoute><StudentLayout><ChatScreen /></StudentLayout></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute><StudentLayout><SettingsScreen isTeacher={false} /></StudentLayout></ProtectedRoute>
      } />

      {/* Auth route */}
      <Route path="/auth" element={<AuthScreen />} />
      <Route path="/confirm-email" element={<ConfirmEmailScreen />} />
      <Route path="/onboarding" element={<ProtectedRoute><OnboardingScreen /></ProtectedRoute>} />

      {/* Landing page */}
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<NavigateToHome />} />
    </Routes>
  );
}

function NavigateToHome() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Spinner size={40} /></div>;
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (session && !profile) {
    return <OnboardingScreen />;
  }

  if (profile?.role === 'teacher') {
    return <Navigate to="/teacher/dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
