import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Organization, UserRole, Permission } from '../types';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setOrganization: (org: Organization | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  logout: () => void;

  // Helpers
  hasPermission: (permission: Permission) => boolean;
  hasRole: (roles: UserRole[]) => boolean;
  isManager: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      isLoading: true,
      isInitialized: false,

      setUser: (user) => set({ user }),
      setOrganization: (organization) => set({ organization }),
      setLoading: (isLoading) => set({ isLoading }),
      setInitialized: (isInitialized) => set({ isInitialized }),

      logout: () =>
        set({
          user: null,
          organization: null,
          isLoading: false,
        }),

      hasPermission: (permission) => {
        const { user } = get();
        if (!user) return false;
        // Owner and admin have all permissions
        if (user.role === 'owner' || user.role === 'admin') return true;
        return user.permissions.includes(permission);
      },

      hasRole: (roles) => {
        const { user } = get();
        if (!user) return false;
        return roles.includes(user.role);
      },

      isManager: () => {
        const { user } = get();
        if (!user) return false;
        return ['owner', 'admin', 'manager'].includes(user.role);
      },
    }),
    {
      name: 'fieldsync-auth',
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
      }),
    }
  )
);
