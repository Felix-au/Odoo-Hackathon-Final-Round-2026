import { create } from 'zustand';
import { PortalCustomer } from '../types/api.types';

interface PortalAuthState {
  customer: PortalCustomer | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requestMagicLink: (email: string) => Promise<void>;
  verifyMagicLink: (token: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const usePortalAuthStore = create<PortalAuthState>((set) => ({
  customer: {
    customerId: 'c1000000-0000-0000-0000-000000000001',
    email: 'acme@example.com',
    name: 'Acme Corp',
  },
  sessionToken: 'portal_sess_active',
  isAuthenticated: true,
  isLoading: false,

  requestMagicLink: async (email) => {
    set({ isLoading: true });
    try {
      console.log(`[Portal] Dispatching magic link for ${email}`);
      await new Promise((r) => setTimeout(r, 600));
      // Always succeeds with 202 to avoid disclosing registered emails
    } finally {
      set({ isLoading: false });
    }
  },

  verifyMagicLink: async (token) => {
    set({ isLoading: true });
    try {
      await new Promise((r) => setTimeout(r, 500));
      if (!token) throw new Error('Invalid or missing magic link token');
      const customer: PortalCustomer = {
        customerId: 'c1000000-0000-0000-0000-000000000001',
        email: 'acme@example.com',
        name: 'Acme Corp',
      };
      set({
        customer,
        sessionToken: token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  loginWithPassword: async (email) => {
    set({ isLoading: true });
    try {
      await new Promise((r) => setTimeout(r, 500));
      const customer: PortalCustomer = {
        customerId: 'c1000000-0000-0000-0000-000000000001',
        email,
        name: email.split('@')[0].toUpperCase(),
      };
      set({
        customer,
        sessionToken: `sess_${Date.now()}`,
        isAuthenticated: true,
        isLoading: false,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({
      customer: null,
      sessionToken: null,
      isAuthenticated: false,
    });
  },

  checkSession: async () => {
    // In production, calls GET /portal/v1/auth/me
  },
}));
