import { create } from 'zustand';
import type { User as FirebaseUser } from 'firebase/auth';

export interface UserProfile {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roleId: string;
  status: string;
  createdAt: any;
  isFirstLogin?: boolean;
  permissions?: string[];
}

export interface TenantProfile {
  id: string;
  companyName: string;
  subscriptionPlan: string;
  status: string;
  createdAt: any;
}

export interface RoleProfile {
  id: string;
  name: string;
  permissions: string[];
}

interface AuthState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  tenant: TenantProfile | null;
  role: RoleProfile | null;
  loading: boolean;
  setAuth: (
    user: FirebaseUser | null,
    profile: UserProfile | null,
    tenant: TenantProfile | null,
    role: RoleProfile | null
  ) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  hasPermission: (module: string, action: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  tenant: null,
  role: null,
  loading: true,

  setAuth: (user, profile, tenant, role) => set({ user, profile, tenant, role, loading: false }),
  setLoading: (loading) => set({ loading }),
  clearAuth: () => set({ user: null, profile: null, tenant: null, role: null, loading: false }),

  hasPermission: (module, action) => {
    const { profile, role } = get();
    if (!profile) return false;
    
    // admin@gmail.com is superadmin and has absolute access
    if (profile.email === 'admin@gmail.com') return true;
    
    const permissions = profile.permissions || role?.permissions || [];
    const permissionKey = `${module}:${action}`;
    const allKey = `${module}:*`;
    
    return permissions.includes(permissionKey) || permissions.includes(allKey) || permissions.includes('*:*');
  },
}));
