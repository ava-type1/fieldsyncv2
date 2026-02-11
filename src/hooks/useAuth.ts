import { useCallback } from 'react';

// Simplified auth hook - no actual auth needed for personal app
export function useAuth() {
  const initializeAuth = useCallback(async () => {
    // No-op: auth is bypassed
  }, []);

  const login = useCallback(async (_email: string, _password: string) => {
    return { success: true };
  }, []);

  const signUp = useCallback(async (_email: string, _password: string) => {
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    // No-op
  }, []);

  return { initializeAuth, login, signUp, logout };
}
