import { create } from 'zustand';
import type { User as FirebaseUser } from 'firebase/auth';

export type CompanyId = 'rileys' | 'toyo';
export type CompanyAccess = 'rileys' | 'toyo' | 'all';

export interface CompanyInfo {
  id: CompanyId;
  name: string;
  fullName: string;
  shortCode: string;
  description: string;
}

export const COMPANIES: Record<CompanyId, CompanyInfo> = {
  rileys: {
    id: 'rileys',
    name: "Riley's",
    fullName: "Riley's Plant Operations",
    shortCode: 'RILEYS',
    description: 'Precision Manufacturing & Assembly Plants'
  },
  toyo: {
    id: 'toyo',
    name: "Toyo",
    fullName: "Toyo Manufacturing",
    shortCode: 'TOYO',
    description: 'High-Tolerance Plastics, Extrusions & Daily Dynamic Capacity'
  }
};

export interface UserProfile {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roleId: string;
  company?: CompanyAccess; // 'rileys' | 'toyo' | 'all'
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
  activeCompany: CompanyId;
  activeMonthArchive: string | null; // e.g. "2026-09" or null for current operations
  
  setAuth: (
    user: FirebaseUser | null,
    profile: UserProfile | null,
    tenant: TenantProfile | null,
    role: RoleProfile | null
  ) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
  setActiveCompany: (company: CompanyId) => void;
  setActiveMonthArchive: (monthKey: string | null) => void;
  getAvailableCompanies: () => CompanyInfo[];
  canAccessCompany: (company: CompanyId) => boolean;
  hasPermission: (module: string, action: string) => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  tenant: null,
  role: null,
  loading: true,
  activeCompany: 'rileys',
  activeMonthArchive: null,

  setAuth: (user, profile, tenant, role) => {
    // Determine initial active company
    let defaultCompany: CompanyId = 'rileys';
    if (profile) {
      if (profile.company === 'toyo') {
        defaultCompany = 'toyo';
      } else if (profile.company === 'rileys') {
        defaultCompany = 'rileys';
      } else {
        // Admin or 'all' - check localStorage or default to rileys
        const saved = typeof window !== 'undefined' ? localStorage.getItem('ppt_active_company') as CompanyId : null;
        if (saved && (saved === 'rileys' || saved === 'toyo')) {
          defaultCompany = saved;
        }
      }
    }

    // Synchronize tenant profile company name with active company
    const compInfo = COMPANIES[defaultCompany];
    const resolvedTenant = tenant ? {
      ...tenant,
      id: defaultCompany,
      companyName: compInfo.fullName
    } : {
      id: defaultCompany,
      companyName: compInfo.fullName,
      subscriptionPlan: 'ENTERPRISE',
      status: 'ACTIVE',
      createdAt: new Date()
    };

    set({ 
      user, 
      profile, 
      tenant: resolvedTenant, 
      role, 
      activeCompany: defaultCompany,
      loading: false 
    });
  },

  setActiveCompany: (company: CompanyId) => {
    const { canAccessCompany, tenant } = get();
    if (!canAccessCompany(company)) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem('ppt_active_company', company);
    }

    const compInfo = COMPANIES[company];
    const updatedTenant: TenantProfile = tenant ? {
      ...tenant,
      id: company,
      companyName: compInfo.fullName
    } : {
      id: company,
      companyName: compInfo.fullName,
      subscriptionPlan: 'ENTERPRISE',
      status: 'ACTIVE',
      createdAt: new Date()
    };

    set({ 
      activeCompany: company,
      tenant: updatedTenant 
    });
  },

  setActiveMonthArchive: (monthKey: string | null) => {
    set({ activeMonthArchive: monthKey });
  },

  isAdmin: () => {
    const { profile, role } = get();
    if (!profile) return false;
    if (profile.email === 'admin@gmail.com') return true;
    if (profile.roleId === 'super_admin' || role?.id === 'super_admin') return true;
    if (profile.company === 'all') return true;
    return false;
  },

  getAvailableCompanies: () => {
    const { profile, isAdmin } = get();
    if (!profile) return [COMPANIES.rileys];
    
    if (isAdmin() || profile.company === 'all') {
      return [COMPANIES.rileys, COMPANIES.toyo];
    }

    if (profile.company === 'toyo') {
      return [COMPANIES.toyo];
    }

    return [COMPANIES.rileys];
  },

  canAccessCompany: (company: CompanyId) => {
    const { profile, isAdmin } = get();
    if (!profile) return false;
    if (isAdmin() || profile.company === 'all') return true;
    if (profile.company === company) return true;
    if (!profile.company && company === 'rileys') return true; // legacy default
    return false;
  },

  setLoading: (loading) => set({ loading }),
  
  clearAuth: () => set({ 
    user: null, 
    profile: null, 
    tenant: null, 
    role: null, 
    activeCompany: 'rileys',
    loading: false 
  }),

  hasPermission: (module, action) => {
    const { profile, role, isAdmin } = get();
    if (!profile) return false;
    if (isAdmin()) return true;
    
    const permissions = profile.permissions || role?.permissions || [];
    const permissionKey = `${module}:${action}`;
    const allKey = `${module}:*`;
    
    return permissions.includes(permissionKey) || permissions.includes(allKey) || permissions.includes('*:*');
  },
}));

