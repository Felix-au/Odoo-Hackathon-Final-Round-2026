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

portalApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname.startsWith('/portal') && !window.location.pathname.includes('/auth')) {
      window.location.href = '/portal/auth/login?reason=session_expired';
    }
    return Promise.reject(error);
  }
);
