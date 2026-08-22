import { useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui';
import { AuthScreen } from '@/screens/AuthScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, needsOnboarding } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={40} />
      </div>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (needsOnboarding) {
    return <OnboardingScreen />;
  }

  return <>{children}</>;
}
