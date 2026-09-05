import { createBrowserRouter, Navigate } from 'react-router-dom';
import { appRoutes } from './app/routes';
import { portalRoutes } from './portal/routes';
import { LoginPage } from './app/pages/LoginPage';
import { SignupPage } from './app/pages/SignupPage';

export const router = createBrowserRouter([
  // Root Redirect to Workspace Dashboard
  {
    path: '/',
    element: <Navigate to="/app/dashboard" replace />,
  },

  // Internal Authentication (no shell)
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },

  // Internal Workspace Tree (/app/*)
  appRoutes,

  // Customer Portal Tree (/portal/*)
  portalRoutes,

  // Fallback 404
  {
    path: '*',
    element: (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#0B0D11]">
        <h1 className="text-4xl font-black text-white">404</h1>
        <p className="text-sm text-slate-400 mt-1 mb-4">Page not found</p>
        <a
          href="/app/dashboard"
          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
        >
          Return to Dashboard
        </a>
      </div>
    ),
  },
]);
