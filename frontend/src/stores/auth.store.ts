import { create } from 'zustand';
import { User } from '../types/api.types';
import { Role } from '../lib/constants';
import { authApi } from '../api/auth.api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshTokenString: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (userData: { email: string; password: string; name: string; role?: Role }) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  initializeFromStorage: () => Promise<void>;
  setUser: (user: User) => void;
  enterOfflineMode: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const token = localStorage.getItem('dealflow_access_token');
  let initialUser: User | null = null;
  const storedUser = localStorage.getItem('dealflow_user');
  if (storedUser) {
    try {
      initialUser = JSON.parse(storedUser);
    } catch {
      initialUser = null;
    }
  }

  return {
    user: initialUser,
    accessToken: token,
    refreshTokenString: localStorage.getItem('dealflow_refresh_token'),
    isAuthenticated: Boolean(token),
    isLoading: false,

  enterOfflineMode: () => {
    // Deprecated — no-op for real backend integration
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const data = await authApi.login({ email, password });
      localStorage.setItem('dealflow_access_token', data.accessToken);
      localStorage.setItem('dealflow_refresh_token', data.refreshToken);
      localStorage.setItem('dealflow_user', JSON.stringify(data.user));
      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshTokenString: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false });
      const message =
        err.response?.data?.detail ||
        err.response?.data?.title ||
        (err.code === 'ERR_NETWORK'
          ? 'Cannot connect to API Gateway (port 3000). Please verify the backend is running.'
          : err.message || 'Authentication failed');
      throw new Error(message);
    }
  },

  signup: async (userData) => {
    set({ isLoading: true });
    try {
      const user = await authApi.signup(userData);
      // Auto login after signup
      await get().login(userData.email, userData.password);
      set({ user, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false });
      const message =
        err.response?.data?.detail ||
        (err.code === 'ERR_NETWORK'
          ? 'Cannot connect to API Gateway (port 3000). Please verify the backend is running.'
          : err.message || 'Registration failed');
      throw new Error(message);
    }
  },

  logout: async () => {
    const rf = get().refreshTokenString;
    const token = get().accessToken;
    if (rf) {
      try {
        await authApi.logout(rf, token || undefined);
      } catch {
        // Continue local cleanup even if network request fails
      }
    }
    localStorage.removeItem('dealflow_access_token');
    localStorage.removeItem('dealflow_refresh_token');
    localStorage.removeItem('dealflow_user');
    set({
      user: null,
      accessToken: null,
      refreshTokenString: null,
      isAuthenticated: false,
    });
  },

  refreshToken: async () => {
    const rf = get().refreshTokenString;
    if (!rf) {
      get().logout();
      return;
    }
    try {
      const data = await authApi.refresh(rf);
      localStorage.setItem('dealflow_access_token', data.accessToken);
      set({ accessToken: data.accessToken });
    } catch {
      get().logout();
    }
  },

  initializeFromStorage: async () => {
    const token = localStorage.getItem('dealflow_access_token');
    if (!token) return;
    try {
      const me = await authApi.getMe(token);
      set({ user: me, isAuthenticated: true });
    } catch {
      // If token expired, attempt refresh
      await get().refreshToken();
    }
  },

  setUser: (user: User) => {
    set({ user });
  },
};
});
