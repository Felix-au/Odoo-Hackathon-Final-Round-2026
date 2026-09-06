import { Outlet, Navigate } from 'react-router-dom';
import { PortalShell } from './layout/PortalShell';
import { PortalLoginPage } from './pages/PortalLoginPage';
import { PortalSignupPage } from './pages/PortalSignupPage';
import { MagicLinkSentPage } from './pages/MagicLinkSentPage';
import { MagicLinkVerifyPage } from './pages/MagicLinkVerifyPage';
import { QuotationPortalPage } from './pages/QuotationPortalPage';
import { usePortalAuthStore } from '../stores/portal-auth.store';
import { useAuthStore } from '../stores/auth.store';

export function PortalGuestGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated: isPortalAuth } = usePortalAuthStore();
  const { isAuthenticated: isInternalAuth } = useAuthStore();

  if (isPortalAuth) {
    return <Navigate to="/portal/quotations" replace />;
  }
  if (isInternalAuth) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <>{children}</>;
}

export function PortalAuthGuard() {
  return <Outlet />;
}

export const portalRoutes = {
  path: '/portal',
  children: [
    // Full-screen Dark Auth routes (guarded against already authenticated sessions)
    {
      path: 'auth/login',
      element: (
        <PortalGuestGuard>
          <PortalLoginPage />
        </PortalGuestGuard>
      ),
    },
    {
      path: 'auth/signup',
      element: (
        <PortalGuestGuard>
          <PortalSignupPage />
        </PortalGuestGuard>
      ),
    },
    { path: 'auth/magic-link-sent', element: <MagicLinkSentPage /> },
    { path: 'auth/verify', element: <MagicLinkVerifyPage /> },

    // Proposal viewer shell
    {
      element: <PortalShell />,
      children: [
        {
          element: <PortalAuthGuard />,
          children: [
            { index: true, element: <QuotationPortalPage /> },
            { path: 'quotations', element: <QuotationPortalPage /> },
            { path: 'quotations/:id', element: <QuotationPortalPage /> },
          ],
        },
      ],
    },
  ],
};
