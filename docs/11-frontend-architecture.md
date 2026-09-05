# DealFlow360 — Frontend Architecture

---

## 1. Overview

The frontend is a **React 18 SPA** built with Vite, TypeScript, and Tailwind CSS. It runs in two fundamentally separate runtime contexts:

| Context | Path Prefix | Audience | Auth Mechanism |
|---------|------------|----------|---------------|
| **Internal Workspace** | `/app/*` | Sales Rep, Manager, Finance, Admin | JWT access token (localStorage + interceptor) |
| **Customer Portal** | `/portal/*` | Customer (Portal User) | HttpOnly session cookie |

These are **not the same UI** — they have separate route trees, separate auth flows, separate layouts, and the portal has zero access to internal routes.

---

## 2. Project Structure

```
frontend/
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx                    # React root — renders RouterProvider
    ├── router.tsx                  # Root router: splits /app and /portal routes
    │
    ├── app/                        # Internal workspace
    │   ├── layout/
    │   │   ├── AppShell.tsx        # Sidebar + top nav + content area
    │   │   ├── TopNav.tsx          # Workspace top navigation
    │   │   └── Sidebar.tsx         # Navigation sidebar
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── SignupPage.tsx
    │   │   ├── DashboardPage.tsx   # Deal health + KPI dashboard
    │   │   ├── QuotationsPage.tsx  # List view + pipeline kanban
    │   │   ├── QuotationBuilderPage.tsx  # The main quote editor
    │   │   ├── QuotationApprovalPage.tsx # Approval screen
    │   │   ├── FulfillmentPage.tsx # Warehouse split screen
    │   │   ├── BillingPage.tsx     # Billing schedule + subscription management
    │   │   ├── ReportsPage.tsx     # Reporting with filters + export
    │   │   └── admin/              # Backend configuration pages
    │   │       ├── ProductsPage.tsx
    │   │       ├── PriceListsPage.tsx
    │   │       ├── DiscountTiersPage.tsx
    │   │       ├── ApprovalChainsPage.tsx
    │   │       ├── WarehousesPage.tsx
    │   │       ├── SubscriptionPlansPage.tsx
    │   │       └── UpsellRulesPage.tsx
    │   └── routes.tsx              # /app route definitions + auth guard
    │
    ├── portal/                     # Customer portal
    │   ├── layout/
    │   │   └── PortalShell.tsx     # Minimal portal shell (logo + signout)
    │   ├── pages/
    │   │   ├── PortalLoginPage.tsx # Email + password or magic link request
    │   │   ├── MagicLinkSentPage.tsx
    │   │   ├── MagicLinkVerifyPage.tsx  # Token verification redirect handler
    │   │   └── QuotationPortalPage.tsx  # THE portal quotation view + negotiate
    │   └── routes.tsx              # /portal route definitions + portal auth guard
    │
    ├── components/                 # Shared UI components
    │   ├── ui/                     # shadcn/ui base components
    │   │   ├── Button.tsx
    │   │   ├── Input.tsx
    │   │   ├── Dialog.tsx
    │   │   ├── Badge.tsx
    │   │   ├── Card.tsx
    │   │   ├── Table.tsx
    │   │   └── ...
    │   ├── forms/
    │   │   ├── ProductSearchCombobox.tsx
    │   │   ├── CustomerSelect.tsx
    │   │   └── DateRangePicker.tsx
    │   ├── feedback/
    │   │   ├── LoadingSpinner.tsx
    │   │   ├── ErrorBoundary.tsx
    │   │   ├── EmptyState.tsx
    │   │   └── AlertBanner.tsx
    │   └── domain/
    │       ├── QuotationStatusBadge.tsx
    │       ├── RiskScoreIndicator.tsx
    │       ├── MarginGauge.tsx
    │       └── ApprovalStepsList.tsx
    │
    ├── stores/                     # Zustand state stores
    │   ├── auth.store.ts           # Internal auth state
    │   ├── portal-auth.store.ts    # Portal auth state
    │   └── ui.store.ts             # Global UI state (sidebar, notifications)
    │
    ├── api/                        # API layer
    │   ├── client.ts               # Axios instance (internal)
    │   ├── portal-client.ts        # Axios instance (portal — cookie-based)
    │   ├── hooks/                  # TanStack Query hooks
    │   │   ├── useQuotations.ts
    │   │   ├── useQuotationBuilder.ts
    │   │   ├── useCatalog.ts
    │   │   ├── useFulfillment.ts
    │   │   ├── useBilling.ts
    │   │   ├── useAnalytics.ts
    │   │   └── usePortalQuotation.ts
    │   └── mutations/              # TanStack Mutation hooks
    │       ├── useCreateQuotation.ts
    │       ├── useAddQuotationLine.ts
    │       ├── useApproveQuotation.ts
    │       └── ...
    │
    ├── lib/
    │   ├── utils.ts                # cn(), formatCurrency(), formatDate()
    │   ├── constants.ts            # Route paths, status labels, colors
    │   └── validators.ts           # Shared Zod schemas (reused from backend)
    │
    └── types/
        ├── api.types.ts            # API response types (shared with backend)
        ├── quotation.types.ts
        ├── catalog.types.ts
        └── analytics.types.ts
```

---

## 3. Routing

### Root Router (`src/router.tsx`)

```tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';

const router = createBrowserRouter([
  // Internal Workspace
  {
    path: '/app',
    element: <InternalAuthGuard />,  // Checks JWT; redirects to /login if missing
    children: [
      { element: <AppShell />, children: [
        { index: true, element: <Navigate to="/app/dashboard" replace /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'quotations', element: <QuotationsPage /> },
        { path: 'quotations/new', element: <QuotationBuilderPage /> },
        { path: 'quotations/:id', element: <QuotationBuilderPage /> },
        { path: 'quotations/:id/approval', element: <QuotationApprovalPage /> },
        { path: 'quotations/:id/fulfillment', element: <FulfillmentPage /> },
        { path: 'quotations/:id/billing', element: <BillingPage /> },
        { path: 'reports', element: <ReportsPage /> },
        // Admin-only routes (wrapped in RoleGuard role=ADMIN)
        { path: 'admin', element: <AdminRoleGuard />, children: [
          { path: 'products', element: <ProductsPage /> },
          { path: 'price-lists', element: <PriceListsPage /> },
          { path: 'discount-tiers', element: <DiscountTiersPage /> },
          { path: 'approval-chains', element: <ApprovalChainsPage /> },
          { path: 'warehouses', element: <WarehousesPage /> },
          { path: 'subscription-plans', element: <SubscriptionPlansPage /> },
          { path: 'upsell-rules', element: <UpsellRulesPage /> },
        ]},
      ]},
    ],
  },

  // Auth pages (no shell)
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },

  // Customer Portal (completely separate tree)
  {
    path: '/portal',
    children: [
      { path: 'auth/login', element: <PortalLoginPage /> },
      { path: 'auth/magic-link-sent', element: <MagicLinkSentPage /> },
      { path: 'auth/verify', element: <MagicLinkVerifyPage /> },
      {
        element: <PortalAuthGuard />,  // Checks portal_session cookie
        children: [
          { path: 'quotations/:id', element: <QuotationPortalPage /> },
        ],
      },
    ],
  },

  // Redirects
  { path: '/', element: <Navigate to="/app/dashboard" replace /> },
  { path: '*', element: <NotFoundPage /> },
]);
```

---

## 4. Authentication State

### Internal Auth Store (`stores/auth.store.ts`)

```typescript
interface AuthState {
  user: { id: string; email: string; name: string; role: Role } | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  initializeFromStorage: () => void;
}

// Storage: accessToken in memory (Zustand); refreshToken in localStorage
// On app load: check localStorage for refreshToken → call /auth/refresh → restore session
```

### Axios Interceptors (`api/client.ts`)

```typescript
// Request interceptor: inject Authorization header
axiosInstance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: handle 401 → auto-refresh → retry
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      await useAuthStore.getState().refreshToken();
      return axiosInstance(error.config);
    }
    return Promise.reject(error);
  }
);
```

### Portal Auth Guard

```typescript
// PortalAuthGuard checks for portal_session cookie presence
// Verifies with backend: GET /portal/v1/auth/me (if 401 → redirect to /portal/auth/login)
// Portal sessions are HttpOnly cookies — JS cannot read them directly
// Guard calls a verification endpoint on mount
```

---

## 5. State Management

### Zustand Stores

```typescript
// ui.store.ts — global UI state
interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  notifications: Notification[];
  addNotification: (n: Notification) => void;
  dismissNotification: (id: string) => void;
}
```

### TanStack Query — Server State

All API data (quotations, products, etc.) is managed by TanStack Query:

```typescript
// hooks/useQuotations.ts
export function useQuotations(filters: QuotationFilters) {
  return useQuery({
    queryKey: ['quotations', filters],
    queryFn: () => api.get('/quotations', { params: filters }),
    staleTime: 30_000,         // 30 seconds before background refetch
    gcTime: 5 * 60_000,       // 5 minutes in memory
  });
}

// hooks/useQuotationBuilder.ts
export function useQuotationBuilder(quotationId: string) {
  return useQuery({
    queryKey: ['quotation', quotationId],
    queryFn: () => api.get(`/quotations/${quotationId}`),
    staleTime: 10_000,   // shorter stale time for live-editing context
    refetchOnWindowFocus: true,
  });
}
```

---

## 6. Key Page Descriptions

### QuotationBuilderPage

The most complex page. Contains:

**Layout** (two-column on wide screens):
- Left (2/3): Cart area with product search, line items table, totals
- Right (1/3): Upsell/cross-sell panel

**Components**:
- `ProductSearchCombobox` — searchable product selector (debounced API call)
- `QuotationLineTable` — editable table with +/- quantity, discount input per line
- `RiskScoreIndicator` — color-coded gauge (green → yellow → red)
- `MarginGauge` — shows overall margin %
- `UpsellPanel` — ranked suggestion cards with "Add to Quote" + "Dismiss"
- `QuotationActionBar` — Submit, Save, Send buttons

**Real-time updates**:
- When line discount changes → debounce 300ms → optimistic update local state → PUT /lines/:id → sync with server response
- `RiskScoreIndicator` and `MarginGauge` update immediately from server response

### QuotationApprovalPage

**Components**:
- `RiskScoreBreakdown` — shows blended score + per-line violations
- `ApprovalStepsList` — shows required approvers with current status (pending/done)
- `ApprovalActionPanel` — Approve / Reject / Return for Revision buttons with reason text area
- `AuditTrailTable` — immutable log of all past actions

**Role-gated rendering**:
- Approve/Reject/Return buttons only visible to users with correct role for current pending step
- Read-only view for Sales Reps and uninvolved roles

### FulfillmentPage

**Components**:
- `WarehouseSplitTable` — shows recommended split per warehouse per product
- `StockAvailabilityBadge` — green/yellow/red per warehouse
- `AcceptSplitButton`
- `ManualOverrideForm` — editable quantity inputs per warehouse
- `BackorderAlert` — shown when backorder items exist; includes "Consolidate" button

### BillingPage

**Components**:
- `OneTimeInvoiceCard` — shows invoice amount, status, due date, Pay button
- `RecurringLinesList` — list of subscription lines
- `BillingScheduleTable` — upcoming charge dates and amounts
- `SubscriptionActions` — Change Quantity (with proration preview), Cancel buttons

### DashboardPage

**Components**:
- `KPIGrid` — cards for total revenue, quotation count, avg margin, pending approvals
- `DealHealthPanel` — list of alerts (stalled / anomaly / slippage)
- `PipelineStatusBar` — horizontal bar showing % per stage
- `AlertCard` — clickable card per alert; navigates to quotation on click
- `NudgeActionMenu` — Email Nudge / Escalate / Resolve options per alert

### QuotationPortalPage (Customer Portal)

**Components**:
- `PortalQuotationHeader` — customer name, status badge, valid-until date
- `PortalLineItemsTable` — read-only table of lines
- `NegotiationForm` — line comments + proposed overall discount + message
- `SubmitNegotiationButton`
- `ConfirmQuotationButton` (prominent CTA)
- `NegotiationHistory` — past negotiation submissions and status

---

## 7. Forms & Validation

All forms use **React Hook Form + Zod resolver**:

```typescript
// Example: Login form
const loginSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
  resolver: zodResolver(loginSchema),
});
```

**Validation patterns**:
- Discount input: `z.number().min(0).max(100)`
- Quantity input: `z.number().int().min(1)`
- Email: `z.string().email()`
- Reason (reject/return): `z.string().min(10, 'Reason must be at least 10 characters')`

---

## 8. Loading, Error, and Empty States

Every data-fetching component handles three states:

```tsx
function QuotationsList() {
  const { data, isLoading, isError, error } = useQuotations(filters);

  if (isLoading) return <LoadingSpinner label="Loading quotations..." />;
  
  if (isError) return (
    <ErrorBanner
      title="Failed to load quotations"
      detail={error.message}
      action={<Button onClick={() => refetch()}>Retry</Button>}
    />
  );
  
  if (data?.data.length === 0) return (
    <EmptyState
      icon={<FileTextIcon />}
      title="No quotations yet"
      description="Create your first quotation to get started"
      action={<Button onClick={() => navigate('/app/quotations/new')}>New Quotation</Button>}
    />
  );
  
  return <QuotationCardGrid quotations={data.data} />;
}
```

---

## 9. Notifications

Using **Sonner** toast library:

```typescript
import { toast } from 'sonner';

// Success
toast.success('Quotation approved successfully');

// Error
toast.error('Failed to submit quotation', { description: error.detail });

// Info
toast.info('Quotation sent to customer portal');

// Warning (re-entered approval)
toast.warning('Terms changed — quotation re-entered approval flow');
```

---

## 10. Accessibility

- All interactive elements have unique IDs for E2E testing
- Form labels linked to inputs via `htmlFor` / `id`
- Status badges include `aria-label` with full text (not just color)
- Modals use `role="dialog"` and manage focus trap
- Loading spinners include `aria-label="Loading..."` and `role="status"`
- Keyboard navigation for all forms and tables
- Color is never the sole indicator of status (always includes text/icon)

---

## 11. Responsive Design

| Breakpoint | Layout |
|-----------|--------|
| `<768px` (mobile) | Single column; sidebar collapsed; simplified tables |
| `768–1280px` (tablet) | Two column where possible; sidebar toggle |
| `>1280px` (desktop) | Three-column quotation builder; full sidebar |

The QuotationBuilderPage upsell panel collapses to a slide-over drawer on mobile.

---

## 12. Implementation Checkpoints — Frontend Architecture

**CHECK-FE-001**
- **Covers**: REQ-F-008, REQ-SEC-002
- **Precondition**: Frontend deployed; customer portal login working
- **Action**: Portal user navigates to `/app/quotations` directly
- **Expected**: Redirected to `/login` (internal login) — not portal login
- **Verification**: Playwright E2E test

**CHECK-FE-002**
- **Covers**: REQ-SEC-007 (frontend)
- **Precondition**: User's access token expires
- **Action**: Wait for token expiry (or force it); make any authenticated API call
- **Expected**: Token silently refreshed via interceptor; user sees no interruption
- **Verification**: Unit test on axios interceptor

**CHECK-FE-003**
- **Covers**: REQ-NF-007
- **Precondition**: App loaded
- **Action**: Navigate to `/app/quotations`; measure time to interactive
- **Expected**: First meaningful paint < 2s on localhost; Quotation list rendered
- **Verification**: Playwright performance test

**CHECK-FE-004**
- **Covers**: REQ-F-095, REQ-PERF-001
- **Precondition**: QuotationBuilderPage open with a line
- **Action**: Change discount from 5% to 18% in line discount input
- **Expected**: RiskScoreIndicator and MarginGauge update within 500ms of server response
- **Verification**: Playwright test with timing assertion

**CHECK-FE-005**
- **Covers**: REQ-ROLE-002, REQ-ROLE-005
- **Precondition**: Internal user with role=SALES_REP logged in
- **Action**: Navigate to `/app/admin/products`
- **Expected**: Redirected or shows 403 error — Admin-only route guarded
- **Verification**: Playwright role-based access test
