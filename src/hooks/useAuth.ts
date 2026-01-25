import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import type { User, Organization } from '../types';

export function useAuth() {
  const navigate = useNavigate();
  const { setUser, setOrganization, setLoading, setInitialized, logout: clearAuth } = useAuthStore();

  const initializeAuth = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        // Fetch user profile
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userError || !userData) {
          // User exists in auth but not in users table yet
          setUser({
            id: session.user.id,
            email: session.user.email!,
            fullName: '',
            organizationId: '',
            role: 'technician',
            permissions: [],
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setOrganization(null);
        } else {
          setUser(userData as User);

          // Fetch organization if user has one
          if (userData.organization_id) {
            const { data: orgData } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', userData.organization_id)
              .single();

            if (orgData) {
              setOrganization(orgData as unknown as Organization);
            }
          }
        }
      } else {
        setUser(null);
        setOrganization(null);
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setUser(null);
      setOrganization(null);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [setUser, setOrganization, setLoading, setInitialized]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          await initializeAuth();
          return { success: true };
        }

        return { success: false, error: 'Login failed' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Login failed';
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [initializeAuth, setLoading]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          // Create basic user record (will be completed in onboarding)
          setUser({
            id: data.user.id,
            email: data.user.email!,
            fullName: '',
            organizationId: '',
            role: 'technician',
            permissions: [],
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          setOrganization(null);
          return { success: true };
        }

        return { success: false, error: 'Sign up failed' };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sign up failed';
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [setUser, setOrganization, setLoading]
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  return {
    initializeAuth,
    login,
    signUp,
    logout,
  };
}
