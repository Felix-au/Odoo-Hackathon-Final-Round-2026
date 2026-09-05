import axios from 'axios';
import { User, AuthTokens } from '../types/api.types';
import { Role } from '../lib/constants';

const GATEWAY_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

export const authHttp = axios.create({
  baseURL: GATEWAY_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<AuthTokens> => {
    const res = await authHttp.post('/auth/login', credentials);
    return res.data;
  },

  signup: async (data: { email: string; password: string; name: string; role?: Role }): Promise<User> => {
    const res = await authHttp.post('/auth/signup', data);
    return res.data;
  },

  refresh: async (refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> => {
    const res = await authHttp.post('/auth/refresh', { refreshToken });
    return res.data;
  },

  logout: async (refreshToken: string, token?: string): Promise<void> => {
    await authHttp.post(
      '/auth/logout',
      { refreshToken },
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
  },

  getMe: async (token: string): Promise<User> => {
    const res = await authHttp.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  getUsers: async (token: string, page = 1, pageSize = 50): Promise<{ data: User[]; total: number }> => {
    const res = await authHttp.get(`/auth/users?page=${page}&pageSize=${pageSize}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  },

  updateUserRole: async (token: string, userId: string, role: Role): Promise<User> => {
    try {
      const res = await authHttp.patch(
        `/auth/users/${userId}/role`,
        { role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    } catch {
      const res = await authHttp.put(
        `/auth/users/${userId}/role`,
        { role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data;
    }
  },
};
