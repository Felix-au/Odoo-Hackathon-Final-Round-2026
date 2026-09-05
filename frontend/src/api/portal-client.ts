import axios from 'axios';

const baseURL = import.meta.env.VITE_PORTAL_BASE_URL || 'http://localhost:3000/portal/v1';

export const portalApiClient = axios.create({
  baseURL,
  withCredentials: true, // Sends and receives HttpOnly session cookie
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

portalApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('portal_session_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

portalApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname.startsWith('/portal') && !window.location.pathname.includes('/auth')) {
      localStorage.removeItem('portal_session_token');
      localStorage.removeItem('portal_customer');
      window.location.href = '/portal/auth/login?reason=session_expired';
    }
    return Promise.reject(error);
  }
);
