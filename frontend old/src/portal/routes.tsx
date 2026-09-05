import { Outlet } from 'react-router-dom';
import { PortalShell } from './layout/PortalShell';
import { PortalLoginPage } from './pages/PortalLoginPage';
import { MagicLinkSentPage } from './pages/MagicLinkSentPage';
import { MagicLinkVerifyPage } from './pages/MagicLinkVerifyPage';
import { QuotationPortalPage } from './pages/QuotationPortalPage';

export function PortalAuthGuard() {
  return <Outlet />;
}

export const portalRoutes = {
  path: '/portal',
  element: <PortalShell />,
  children: [
    { path: 'auth/login', element: <PortalLoginPage /> },
    { path: 'auth/magic-link-sent', element: <MagicLinkSentPage /> },
    { path: 'auth/verify', element: <MagicLinkVerifyPage /> },
    {
      element: <PortalAuthGuard />,
      children: [
        { path: 'quotations/:id', element: <QuotationPortalPage /> },
      ],
    },
  ],
};
