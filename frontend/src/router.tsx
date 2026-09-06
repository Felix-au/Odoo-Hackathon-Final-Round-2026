import { createBrowserRouter, Navigate } from 'react-router-dom';
import { appRoutes } from './app/routes';
import { portalRoutes } from './portal/routes';
import { LoginPage } from './app/pages/LoginPage';
import { SignupPage } from './app/pages/SignupPage';
import { useAuthStore } from './stores/auth.store';
import { usePortalAuthStore } from './stores/portal-auth.store';

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated: isInternalAuth } = useAuthStore();
  const { isAuthenticated: isPortalAuth } = usePortalAuthStore();

  if (isPortalAuth) {
    return <Navigate to="/portal/quotations" replace />;
  }
  if (isInternalAuth) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children}</>;
}

export const router = createBrowserRouter([
  // Root Redirect to Workspace Dashboard
  {
    path: '/',
    element: <Navigate to="/app/dashboard" replace />,
  },

  // Internal Authentication (no shell)
  {
    path: '/login',
    element: (
      <GuestGuard>
        <LoginPage />
      </GuestGuard>
    ),
  },
  {
    path: '/signup',
    element: (
      <GuestGuard>
        <SignupPage />
      </GuestGuard>
    ),
  },

  // Internal Workspace Tree (/app/*)
  appRoutes,

  // Customer Portal Tree (/portal/*)
  portalRoutes,

  // Fallback 404
  {
    path: '*',
    element: (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#09090B]">
        <h1 className="text-4xl font-black text-white">404</h1>
        <p className="text-sm text-slate-400 mt-1 mb-4">Page not found</p>
        <a
          href="/app/dashboard"
          className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5"
        >
          Return to Dashboard
        </a>
      </div>
    ),
  },
]);
