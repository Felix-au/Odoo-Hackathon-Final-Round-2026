import { create } from 'zustand';
import { PortalCustomer } from '../types/api.types';
import { portalApiClient } from '../api/portal-client';

interface PortalAuthState {
  customer: PortalCustomer | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  requestMagicLink: (email: string) => Promise<void>;
  verifyMagicLink: (token: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerCustomer: (data: { email: string; password: string; companyName?: string; contactName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

function getStoredCustomer(): PortalCustomer | null {
  try {
    const raw = localStorage.getItem('portal_customer');
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore parse error
  }
  return null;
}

const initialToken = localStorage.getItem('portal_session_token');
const initialCustomer = getStoredCustomer();

if (initialToken) {
  portalApiClient.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

export const usePortalAuthStore = create<PortalAuthState>((set) => ({
  customer: initialCustomer || (initialToken ? {
    customerId: 'cust-000000-0000-0000-0000-000000000001',
    email: 'acme@example.com',
    name: 'Acme Corp',
  } : null),
  sessionToken: initialToken,
  isAuthenticated: !!initialToken,
  isLoading: false,

  requestMagicLink: async (email: string) => {
    set({ isLoading: true });
    try {
      console.log(`[Portal] Dispatching magic link for ${email}`);
      await portalApiClient.post('/auth/magic-link', { email: email.trim() });
    } finally {
      set({ isLoading: false });
    }
  },

  verifyMagicLink: async (token: string) => {
    set({ isLoading: true });
    try {
      if (!token) throw new Error('Invalid or missing magic link token');
      const res = await portalApiClient.get(`/auth/verify?token=${encodeURIComponent(token)}`);
      const { sessionToken, customerId, email } = res.data;

      localStorage.setItem('portal_session_token', sessionToken);
      portalApiClient.defaults.headers.common['Authorization'] = `Bearer ${sessionToken}`;

      const customer: PortalCustomer = {
        customerId,
        email: email || 'customer@dealflow360.com',
        name: (email || 'Client').split('@')[0].toUpperCase(),
      };
      localStorage.setItem('portal_customer', JSON.stringify(customer));

      set({
        customer,
        sessionToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  loginWithPassword: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await portalApiClient.post('/auth/login', {
        email: email.trim(),
        password,
      });
      const { sessionToken, customerId } = res.data;

      localStorage.setItem('portal_session_token', sessionToken);
      portalApiClient.defaults.headers.common['Authorization'] = `Bearer ${sessionToken}`;

      const customer: PortalCustomer = {
        customerId,
        email: email.trim(),
        name: email.split('@')[0].toUpperCase(),
      };
      localStorage.setItem('portal_customer', JSON.stringify(customer));

      set({
        customer,
        sessionToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  registerCustomer: async (data: { email: string; password: string; companyName?: string; contactName?: string }) => {
    set({ isLoading: true });
    try {
      const res = await portalApiClient.post('/auth/register', {
        ...data,
        email: data.email.trim(),
      });
      const { sessionToken, customerId, email, name } = res.data;

      localStorage.setItem('portal_session_token', sessionToken);
      portalApiClient.defaults.headers.common['Authorization'] = `Bearer ${sessionToken}`;

      const customer: PortalCustomer = {
        customerId,
        email,
        name: name || email.split('@')[0].toUpperCase(),
      };
      localStorage.setItem('portal_customer', JSON.stringify(customer));

      set({
        customer,
        sessionToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      await portalApiClient.post('/auth/logout');
    } catch {
      // Ignore network errors on logout
    }
    localStorage.removeItem('portal_session_token');
    localStorage.removeItem('portal_customer');
    delete portalApiClient.defaults.headers.common['Authorization'];
    set({
      customer: null,
      sessionToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  checkSession: async () => {
    const token = localStorage.getItem('portal_session_token');
    if (token) {
      portalApiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      set({ sessionToken: token, isAuthenticated: true });
    }
  },
}));
