import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { AppShell } from './layout/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { CatalogPage } from './pages/CatalogPage';
import { QuotationsPage } from './pages/QuotationsPage';
import { QuotationBuilderPage } from './pages/QuotationBuilderPage';
import { QuotationApprovalPage } from './pages/QuotationApprovalPage';
import { FulfillmentPage } from './pages/FulfillmentPage';
import { BillingPage } from './pages/BillingPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ReportsPage } from './pages/ReportsPage';
import { ProductsPage } from './pages/admin/ProductsPage';
import { DiscountTiersPage } from './pages/admin/DiscountTiersPage';
import { ApprovalChainsPage } from './pages/admin/ApprovalChainsPage';
import { WarehousesPage } from './pages/admin/WarehousesPage';

export function InternalAuthGuard() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export function AdminRoleGuard() {
  const { user } = useAuthStore();
  if (user?.role !== 'ADMIN' && user?.role !== 'SALES_MANAGER') {
    return (
      <div className="p-8 text-center bg-[#12151C] rounded-2xl border border-red-500/20 max-w-lg mx-auto mt-10">
        <h2 className="text-base font-bold text-red-400">403 — Unauthorized Access</h2>
        <p className="text-xs text-slate-400 mt-1">
          This administration section requires ADMIN or SALES_MANAGER privileges.
        </p>
      </div>
    );
  }
  return <Outlet />;
}

export const appRoutes = {
  path: '/app',
  element: <InternalAuthGuard />,
  children: [
    {
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/app/dashboard" replace /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'users', element: <UsersPage /> },
        { path: 'catalog', element: <CatalogPage /> },
        { path: 'quotations', element: <QuotationsPage /> },
        { path: 'quotations/:id', element: <QuotationBuilderPage /> },
        { path: 'quotations/:id/approval', element: <QuotationApprovalPage /> },
        { path: 'quotations/:id/fulfillment', element: <FulfillmentPage /> },
        { path: 'quotations/:id/billing', element: <BillingPage /> },
        { path: 'fulfillment', element: <FulfillmentPage /> },
        { path: 'billing', element: <BillingPage /> },
        { path: 'analytics', element: <AnalyticsPage /> },
        { path: 'reports', element: <ReportsPage /> },
        {
          path: 'admin',
          element: <AdminRoleGuard />,
          children: [
            { path: 'products', element: <ProductsPage /> },
            { path: 'discount-tiers', element: <DiscountTiersPage /> },
            { path: 'approval-chains', element: <ApprovalChainsPage /> },
            { path: 'warehouses', element: <WarehousesPage /> },
          ],
        },
      ],
    },
  ],
};
