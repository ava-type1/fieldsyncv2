import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Organization, UserRole, Permission } from '../types';

// Kam's default user - no auth needed
const DEFAULT_USER: User = {
  id: 'kam-local',
  email: 'kam@fieldsync.app',
  fullName: 'Kameron Martin',
  phone: '',
  organizationId: 'nobility-local',
  role: 'owner' as UserRole,
  permissions: ['*'] as Permission[],
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const DEFAULT_ORG: Organization = {
  id: 'nobility-local',
  name: 'Nobility Homes Contractor',
  type: 'subcontractor',
  settings: { requirePhotos: true, requireSignatures: true, timezone: 'America/New_York' },
  subscription: 'solo',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isLoading: boolean;
  isInitialized: boolean;

  setUser: (user: User | null) => void;
  setOrganization: (org: Organization | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  logout: () => void;

  hasPermission: (permission: Permission) => boolean;
  hasRole: (roles: UserRole[]) => boolean;
  isManager: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Auto-initialize with Kam's profile
      user: DEFAULT_USER,
      organization: DEFAULT_ORG,
      isLoading: false,
      isInitialized: true,

      setUser: (user) => set({ user }),
      setOrganization: (organization) => set({ organization }),
      setLoading: (isLoading) => set({ isLoading }),
      setInitialized: (isInitialized) => set({ isInitialized }),

      logout: () => set({
        user: DEFAULT_USER,
        organization: DEFAULT_ORG,
        isLoading: false,
      }),

      hasPermission: () => true, // Single user, all permissions
      hasRole: () => true,
      isManager: () => false, // Kam is a technician, not manager
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
