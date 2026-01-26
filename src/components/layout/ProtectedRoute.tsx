import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

interface ProtectedRouteProps {
  children: ReactNode;
  requireOrg?: boolean;
}

export function ProtectedRoute({ children, requireOrg = true }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, organization, isLoading, isInitialized, setUser, setOrganization } = useAuthStore();
  const { initializeAuth } = useAuth();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasValidSession, setHasValidSession] = useState(false);

  // Always verify actual Supabase session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setHasValidSession(true);
          // If we have session but no local user, initialize
          if (!isInitialized) {
            await initializeAuth();
          }
        } else {
          // No valid session - clear any stale local state
          setHasValidSession(false);
          setUser(null);
          setOrganization(null);
        }
      } catch (error) {
        console.error('Session check failed:', error);
        setHasValidSession(false);
        setUser(null);
        setOrganization(null);
      } finally {
        setSessionChecked(true);
      }
    };

    checkSession();
  }, [initializeAuth, isInitialized, setUser, setOrganization]);

  // Show loading state while checking session
  if (!sessionChecked || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // No valid session - redirect to login
  if (!hasValidSession || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but no org and we require one - redirect to onboarding
  if (requireOrg && !organization) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
