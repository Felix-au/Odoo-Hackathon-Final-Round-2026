# DealFlow360 — Frontend: Internal Workspace Modules

---

## Module 1: Authentication Pages

### Pages
- `/login` — `LoginPage.tsx`
- `/signup` — `SignupPage.tsx`

### Components

#### `LoginPage.tsx`
```tsx
// State: React Hook Form, auth loading state
// API: POST /api/v1/auth/login
// On success: store token → navigate to /app/dashboard
// On error: show toast error (never reveal username existence)

interface LoginForm {
  email: string;   // validated: z.string().email()
  password: string; // validated: z.string().min(1)
}

// Loading state: button disabled + spinner during request
// Error state: form-level error message "Invalid email or password"
```

#### `SignupPage.tsx`
```tsx
interface SignupForm {
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  role: 'SALES_REP' | 'SALES_MANAGER' | 'FINANCE' | 'ADMIN';
}
// Validation: password complexity rules + confirmPassword match
// API: POST /api/v1/auth/signup
// On success: auto-login → navigate to /app/dashboard
```

### Checkpoints

**CHECK-FE-LOGIN-001**
- Valid credentials → 200 → store token → redirect to `/app/dashboard`
- **Test**: `login.e2e.test.ts`

**CHECK-FE-LOGIN-002**
- Invalid credentials → show error "Invalid email or password" → no redirect
- **Test**: `login.e2e.test.ts`

**CHECK-FE-LOGIN-003**
- Unauthenticated access to `/app/quotations` → redirect to `/login`
- **Test**: `auth-guard.e2e.test.ts`

---

## Module 2: Sales Workspace Navigation

### Components

#### `TopNav.tsx`
```tsx
// Props: none (reads from auth store)
// State: active tab (Quotations | Pipeline)
// Actions:
//   - "Quotations" → navigate('/app/quotations')
//   - "Pipeline" → navigate('/app/quotations?view=pipeline')
//   - "Reload Data" → invalidate all TanStack Query caches
//   - "Go to Back-end" → navigate('/app/admin/products') [Admin/Manager only]
//   - "Close Workspace" → logout → navigate('/login')
```

**Implements**: REQ-F-070, REQ-F-071, REQ-F-072, REQ-F-073, REQ-F-074

### Checkpoints

**CHECK-FE-NAV-001**
- "Reload Data" button click → all stale queries invalidated → data refetched
- **Test**: `nav.test.tsx > Reload Data invalidates cache`

---

## Module 3: Quotation List & Pipeline View

### Page: `QuotationsPage.tsx`

**Two view modes** (toggled by URL param `?view=list|pipeline`):

#### List View
```tsx
// API: GET /api/v1/quotations (with filter params)
// Components:
//   - FilterBar: status, date range, rep (if Manager/Admin), customer search
//   - QuotationCard: customer name, amount, status badge, risk score chip, last activity
//   - Pagination controls

interface QuotationCardProps {
  id: string;
  customer: { name: string; tier: 'BRONZE' | 'SILVER' | 'GOLD' };
  totalAmount: string;
  status: QuotationStatus;
  blendedRiskScore: number;
  repName: string;
  lastActivityAt: string;
}

// Loading: skeleton cards (ShimmerCard x4)
// Empty: EmptyState with "Create First Quotation" CTA
// Click: navigate(`/app/quotations/${id}`)
```

#### Pipeline View (Kanban)
```tsx
// API: GET /api/v1/quotations/pipeline
// Components:
//   - KanbanBoard: columns per status
//   - KanbanCard: draggable quotation card
//   - Drag-and-drop via dnd-kit (visual only; status change via explicit buttons not drag)
//
// Columns: Draft | Pending Approval | Approved | Sent | Under Negotiation | Confirmed | Rejected
```

**Implements**: REQ-F-080, REQ-F-081, REQ-F-082, REQ-F-071

### Checkpoints

**CHECK-FE-LIST-001**
- Quotation cards show correct status badge with correct color coding
- **Test**: `quotation-list.test.tsx`

**CHECK-FE-LIST-002**
- Filter by status=PENDING_MANAGER_APPROVAL → only pending quotations shown
- **Test**: `quotation-list.e2e.test.ts`

---

## Module 4: Quotation Builder

### Page: `QuotationBuilderPage.tsx`

This is the most complex page in the application.

**Layout**:
```
┌─────────────────────────────────────────────────────┐
│ Quotation Header: Customer | Status | Risk Score     │
├──────────────────────────────────┬──────────────────┤
│ Cart Area (2/3 width)            │ Upsell Panel     │
│  - Product Search                │ (1/3 width)      │
│  - Line Items Table              │                  │
│  - Totals Summary                │                  │
│  - Action Bar                    │                  │
└──────────────────────────────────┴──────────────────┘
```

### Components

#### `QuotationHeader`
```tsx
interface QuotationHeaderProps {
  quotation: Quotation;
}
// Shows: Customer name + tier badge, currency, status badge
// Risk indicator: RiskScoreIndicator (0→green, 30→yellow, 70→red)
// Margin gauge: MarginGauge (%)
// Version indicator (for optimistic locking awareness)
```

#### `ProductSearchCombobox`
```tsx
// Debounced search: 300ms after typing → GET /catalog/products?search=query
// Shows: product name, category, base price
// On select: adds product to cart via POST /quotations/:id/lines
// Handles: loading state, empty results, network errors
```

#### `QuotationLineTable`
```tsx
interface QuotationLineTableProps {
  lines: QuotationLine[];
  quotationId: string;
  currentVersion: number;
  isEditable: boolean;  // false when status ≠ DRAFT
}

// Columns: Product | Category | Qty (+/-) | Unit Price | Discount % | Total | Margin | Actions
// Quantity +/- buttons: debounced 300ms → PUT /quotations/:id/lines/:lineId
// Discount input: debounced 300ms → PUT /quotations/:id/lines/:lineId
// Line violation indicator: red highlight on lines exceeding ceiling
// Delete button: DELETE /quotations/:id/lines/:lineId (with confirmation)
```

#### `QuotationTotals`
```tsx
// Shows: Subtotal, Tax, Total, Overall Margin
// Updates immediately from server response after any line change
```

#### `QuotationActionBar`
```tsx
// Buttons (visible based on status + role):
//   DRAFT + SALES_REP: "Save Draft", "Submit for Approval / Confirm"
//   APPROVED + SALES_REP: "Send to Customer", "Confirm Order"
//   CONFIRMED: read-only banner
// 
// "Submit for Approval / Confirm" → POST /quotations/:id/submit
//   → if requires approval: navigate to /app/quotations/:id/approval
//   → if approved directly: navigate to /app/quotations/:id/fulfillment
```

#### `UpsellPanel`
```tsx
// API: GET /api/v1/quotations/:id/upsell-suggestions
// Refreshes when lines change (query key includes line IDs)
// 
// Shows per suggestion:
//   - Product name
//   - "Adds +X% to margin" delta
//   - 🔥 Hot Deal badge if isPromoted
//   - "Add to Quote" → POST /quotations/:id/lines (with suggested product)
//   - "Dismiss" → removes from list locally (not persisted; re-appears on reload)
// 
// Loading: 3 skeleton cards
// Empty: "No suggestions at this time" message
```

**Implements**: REQ-F-090–097, REQ-F-110–115, REQ-PERF-001

### Optimistic Updates

```typescript
// When user changes discount:
// 1. Immediately update local state (optimistic) for instant UI feel
// 2. Send PUT request in background
// 3. On success: sync with server response (may differ slightly due to rounding)
// 4. On error: revert to previous state + show toast error

const addLineMutation = useMutation({
  mutationFn: (data) => api.addLine(quotationId, data),
  onMutate: async (newLine) => {
    await queryClient.cancelQueries({ queryKey: ['quotation', quotationId] });
    const previous = queryClient.getQueryData(['quotation', quotationId]);
    queryClient.setQueryData(['quotation', quotationId], (old) => ({
      ...old,
      lines: [...old.lines, { ...newLine, id: 'temp-id', lineTotal: '0' }],
    }));
    return { previous };
  },
  onError: (_, __, context) => {
    queryClient.setQueryData(['quotation', quotationId], context.previous);
    toast.error('Failed to add product');
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['quotation', quotationId] });
  },
});
```

### Checkpoints

**CHECK-FE-BUILDER-001**
- Add product to cart → line appears in table → totals update → margin gauge updates
- **Test**: `quotation-builder.e2e.test.ts`

**CHECK-FE-BUILDER-002**
- Change line discount to 18% (service category ceiling 10%) → RiskScoreIndicator turns red → violation highlighted on line
- **Test**: `quotation-builder.e2e.test.ts`

**CHECK-FE-BUILDER-003**
- Click "Add to Quote" on upsell suggestion → suggestion added to cart → margin delta reflected in totals
- **Test**: `upsell-panel.e2e.test.ts`

**CHECK-FE-BUILDER-004**
- Submit quotation with risk-exceeding discount → status changes to PENDING_MANAGER_APPROVAL → redirect to approval page
- **Test**: `quotation-builder.e2e.test.ts`

---

## Module 5: Discount Approval Screen

### Page: `QuotationApprovalPage.tsx`

```tsx
// API reads:
//   GET /api/v1/quotations/:id (includes approvalLog)
//   GET /api/v1/quotations/:id/risk-score
//
// API mutations:
//   POST /quotations/:id/approve
//   POST /quotations/:id/reject
//   POST /quotations/:id/return
```

### Components

#### `RiskScoreBreakdown`
```tsx
// Shows overall blended risk score (large number, color-coded)
// Table of line violations:
//   | Product | Category | Applied Discount | Allowed Ceiling | Violation |
//   | Laptop  | Hardware | 12%              | 15%             | ✓ Within  |
//   | Setup   | Services | 18%              | 10%             | ⚠ +8pts   |
```

#### `ApprovalStepsList`
```tsx
interface ApprovalStep {
  role: 'SALES_MANAGER' | 'FINANCE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  approverName?: string;
  completedAt?: string;
}
// Visual step indicator (like a stepper)
// Current step highlighted
```

#### `ApprovalActionPanel`
```tsx
// Visible ONLY to user whose role matches current pending step
// For SALES_MANAGER if status=PENDING_MANAGER_APPROVAL
// For FINANCE if status=PENDING_FINANCE_APPROVAL
//
// Buttons:
//   - "Approve" (green) → opens confirmation dialog → POST approve
//   - "Return for Revision" (yellow) → opens reason dialog (required) → POST return
//   - "Reject" (red) → opens reason dialog (required) → POST reject
//
// Reason dialog:
//   - Textarea (min 10 chars)
//   - Submit button
```

#### `AuditTrailTable`
```tsx
// Immutable history of all past actions
// Columns: Timestamp | Approver | Role | Action | Reason
// Cannot be modified by UI (DELETE button absent)
```

**Implements**: REQ-F-100–103, REQ-BR-017

### Checkpoints

**CHECK-FE-APPROVAL-001**
- Manager logs in; quotation PENDING_MANAGER_APPROVAL → Approve/Reject/Return buttons visible
- **Test**: `approval.e2e.test.ts > manager sees action buttons`

**CHECK-FE-APPROVAL-002**
- SALES_REP user views same page → Approve/Reject/Return buttons NOT visible (read-only)
- **Test**: `approval.e2e.test.ts > rep sees read-only view`

**CHECK-FE-APPROVAL-003**
- Manager clicks "Reject" → reason dialog appears → submits → status → REJECTED → audit trail shows rejection
- **Test**: `approval.e2e.test.ts > rejection flow`

---

## Module 6: Fulfillment Screen

### Page: `FulfillmentPage.tsx`

```tsx
// API reads:
//   GET /api/v1/fulfillment/split-recommendation?orderId=:id
//
// API mutations:
//   POST /api/v1/fulfillment/orders (accept split)
//   PUT /api/v1/fulfillment/orders/:id (manual override)
//   POST /api/v1/fulfillment/orders/:id/consolidate-backorder
```

### Components

#### `WarehouseSplitCard` (per warehouse)
```tsx
interface WarehouseSplitCardProps {
  warehouseId: string;
  warehouseName: string;
  shippingCostWeight: number;
  items: SplitItem[];  // products from this warehouse
  estimatedCost: number;
}
// Shows: warehouse name, badge (Primary / Secondary), items table
// Items: product name, quantity, available stock indicator
```

#### `SplitSummary`
```tsx
// Shows: Number of warehouses, total shipments, estimated shipping cost
// Backorder warning if hasBackorder
```

#### `AcceptSplitButton` / `ManualOverrideForm`
```tsx
// "Accept Suggested Split" → POST /fulfillment/orders (isOverride: false)
// "Manual Override" → reveals editable quantity inputs per warehouse per product
//   → Rep can redistribute quantities (must sum to total ordered)
//   → "Save Override" → POST /fulfillment/orders (isOverride: true)
```

#### `BackorderAlert`
```tsx
// Shown if hasBackorder
// Lists backordered items with warehouse and quantity
// "Consolidate Backorder" button → POST /fulfillment/orders/:id/consolidate-backorder
// This button appears automatically when stock arrives (via polling or websocket)
```

**Implements**: REQ-F-120–124, REQ-BONUS-005

### Checkpoints

**CHECK-FE-FULFILLMENT-001**
- Order with 5 laptops; Main has 3, East has 2 → split shown correctly (3+2)
- **Test**: `fulfillment.e2e.test.ts`

**CHECK-FE-FULFILLMENT-002**
- "Manual Override" shown → rep changes quantities → Save → fulfillment stored with isOverride=true
- **Test**: `fulfillment.e2e.test.ts > manual override`

---

## Module 7: Billing Screen

### Page: `BillingPage.tsx`

```tsx
// API reads:
//   GET /api/v1/billing/schedules?orderId=:id
//   GET /api/v1/billing/invoices?orderId=:id
//   GET /api/v1/billing/subscriptions?orderId=:id
```

### Components

#### `OneTimeInvoiceCard`
```tsx
// Shows: Invoice #, amount, tax, total, status, due date
// If FINANCE role: "Record Payment" button → payment dialog
// Payment dialog: amount, method (select), reference (text)
// On payment: POST /billing/invoices/:id/payments
```

#### `RecurringLineCard` (per subscription)
```tsx
// Shows: Plan name, interval, quantity × price
// Status badge: ACTIVE / CANCELLED
// Upcoming charges table (next 3 billing dates)
// Actions:
//   "Change Quantity" → dialog with new qty input + proration preview
//   "Cancel" → dialog with effective date selection + refund preview
```

#### `ProrationPreview`
```tsx
// Shows computed credit/charge before user confirms quantity change or cancellation
// "Credit: $37.49 | Charge: $59.99 | Net: +$22.50"
// Confirm button → PUT /billing/subscriptions/:id/quantity or POST .../cancel
```

**Implements**: REQ-F-130–134, REQ-F-161

### Checkpoints

**CHECK-FE-BILLING-001**
- Order with Hardware + Subscription → Billing page shows one-time invoice card + recurring line card separately
- **Test**: `billing.e2e.test.ts`

**CHECK-FE-BILLING-002**
- Record payment with full amount → invoice status → PAID → paid badge shown
- **Test**: `billing.e2e.test.ts > record payment`

**CHECK-FE-BILLING-003**
- Change subscription quantity → proration preview shown BEFORE confirming
- **Test**: `billing.e2e.test.ts > proration preview`

---

## Module 8: Deal Health & Reports Dashboard

### Page: `DashboardPage.tsx`

```tsx
// API reads (TanStack Query with 60s stale time):
//   GET /api/v1/analytics/dashboard?from=...&to=...
//   GET /api/v1/analytics/deal-health
```

### Components

#### `KPIGrid`
```tsx
// Four cards: Total Revenue | Quotation Count | Avg Margin | Pending Approvals
// Each with trend indicator vs previous period
```

#### `PipelineStatusBar`
```tsx
// Horizontal stacked bar showing count per status
// Clickable: click a segment → navigates to /app/quotations?status=<clicked>
```

#### `DealHealthPanel`
```tsx
// Three sections: Stalled | Discount Anomalies | Delivery Slippage
// AlertCard per item:
//   - Icon + severity color border
//   - Customer name, rep name, days stalled / anomaly description
//   - Click anywhere on card → navigate to /app/quotations/:quotationId
//   - "Nudge" button → POST /analytics/alerts/:id/nudge
//   - "Escalate" button → POST /analytics/alerts/:id/escalate
//   - "Resolve" button → POST /analytics/alerts/:id/resolve
```

### Page: `ReportsPage.tsx`

```tsx
// Filter bar:
//   - Period: Today | This Week | Custom (DateRangePicker)
//   - Rep: select (all | specific rep — MANAGER/ADMIN sees all)
//   - Status: multiselect (APPROVED | PENDING | REJECTED | CONFIRMED)
//   - Product/Category: select
//
// Report tabs: Quotations | Products | Discounts | Recurring Revenue
//
// Export buttons:
//   - "Export PDF" → POST /analytics/reports/export { format: "PDF" } → download
//   - "Export XLS" → POST /analytics/reports/export { format: "XLS" } → download
```

**Implements**: REQ-F-060–065, REQ-F-150–154, REQ-BONUS-004, REQ-RPT-001–007

### Checkpoints

**CHECK-FE-DASHBOARD-001**
- Dashboard loads with KPIs; stalled deal alert visible; click alert → navigates to correct quotation
- **Test**: `dashboard.e2e.test.ts`

**CHECK-FE-DASHBOARD-002**
- Nudge button on stalled deal alert → sends email → NudgeAction created in DB
- **Test**: `dashboard.e2e.test.ts > nudge action`

**CHECK-FE-REPORTS-001**
- Apply filters → reports update to match filter; export PDF → valid PDF file downloaded
- **Test**: `reports.e2e.test.ts`

---

## Module 9: Admin Configuration Pages

### Common Pattern
All admin config pages (Products, Price Lists, Discount Tiers, etc.) follow:
```
CRUD List View → "+ Create" → Modal/Side Panel Form → Save → Refresh List
```

**Pages**:
1. `ProductsPage.tsx` — Products table with search; product form modal with variant management
2. `PriceListsPage.tsx` — Price list table; rule editor  
3. `DiscountTiersPage.tsx` — Grid view of Bronze/Silver/Gold × category ceilings
4. `ApprovalChainsPage.tsx` — Risk range → required roles visual editor
5. `WarehousesPage.tsx` — Warehouse list with stock summary
6. `SubscriptionPlansPage.tsx` — Plan cards with linked products
7. `UpsellRulesPage.tsx` — Rule pairs table (trigger product → suggested product)

**Implements**: REQ-F-010–013, REQ-F-020–023, REQ-F-030–034, REQ-F-040–044, REQ-F-050–052

### Checkpoints

**CHECK-FE-ADMIN-001**
- Admin creates product with 2 variants → product appears in quotation builder product search
- **Test**: `admin.e2e.test.ts > create product`

**CHECK-FE-ADMIN-002**
- Admin sets Bronze tier ceiling to 5% → create quotation for Bronze customer → apply 7% discount → risk score > 0 → approval triggered
- **Test**: `admin.e2e.test.ts > discount tier enforcement`

**CHECK-FE-ADMIN-003**
- Non-admin (SALES_REP) navigates to `/app/admin/products` → redirected / forbidden
- **Test**: `auth-guard.e2e.test.ts > admin route guard`
