import { Outlet } from 'react-router-dom';
import { PortalShell } from './layout/PortalShell';
import { PortalLoginPage } from './pages/PortalLoginPage';
import { PortalSignupPage } from './pages/PortalSignupPage';
import { MagicLinkSentPage } from './pages/MagicLinkSentPage';
import { MagicLinkVerifyPage } from './pages/MagicLinkVerifyPage';
import { QuotationPortalPage } from './pages/QuotationPortalPage';

export function PortalAuthGuard() {
  return <Outlet />;
}

export const portalRoutes = {
  path: '/portal',
  children: [
    // Full-screen 50/50 split Dark Auth routes
    { path: 'auth/login', element: <PortalLoginPage /> },
    { path: 'auth/signup', element: <PortalSignupPage /> },

    // Proposal viewer & email confirmation shell
    {
      element: <PortalShell />,
      children: [
        { path: 'auth/magic-link-sent', element: <MagicLinkSentPage /> },
        { path: 'auth/verify', element: <MagicLinkVerifyPage /> },
        {
          element: <PortalAuthGuard />,
          children: [
            { path: 'quotations/:id', element: <QuotationPortalPage /> },
          ],
        },
      ],
    },
  ],
};
