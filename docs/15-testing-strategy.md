# DealFlow360 — Testing Strategy

---

## 1. Testing Philosophy

Testing is a first-class architectural concern. The test suite serves two purposes:
1. **Confidence**: Prove that every requirement in the problem statement is implemented correctly
2. **Regression prevention**: Catch breakage during development

Every implementation checkpoint listed in the service docs has a corresponding test.

---

## 2. Test Layers

```
E2E Tests (Playwright)
  └── Full user journeys through UI + all 6 services

Integration Tests (Vitest + Supertest)
  └── HTTP API tests against real DB + Redis (Docker)

Unit Tests (Vitest)
  └── Pure business logic: risk score, proration, split algorithm
```

**Ratio**: 20% unit, 50% integration, 30% E2E

---

## 3. Unit Tests

### Location
`<service>/src/**/*.test.ts` — co-located with source files

### Framework
- **Vitest** (fast, TypeScript-native)
- **No mocks of real dependencies** in unit tests — only mock external services (email)
- **100% coverage** required for: `risk-score.service.ts`, `proration.service.ts`, `split-algorithm.service.ts`

### Critical Unit Test Suites

#### Auth Service
```typescript
// auth.service.test.ts
describe('AuthService', () => {
  describe('hashPassword / verifyPassword', () => {
    it('hashes password with bcrypt (12 rounds)');
    it('verifies correct password');
    it('rejects incorrect password');
  });
  
  describe('generateJwt', () => {
    it('includes sub, email, role in payload');
    it('expires in 8 hours');
  });
  
  describe('signup', () => {
    it('stores hashed password, not plaintext');
    it('throws EMAIL_ALREADY_EXISTS for duplicate email');
    it('defaults role to SALES_REP when not specified');
  });
  
  describe('login', () => {
    it('returns access + refresh tokens for valid credentials');
    it('throws INVALID_CREDENTIALS for wrong password (same error for unknown email)');
    it('throws ACCOUNT_INACTIVE for inactive account');
  });
});

describe('MagicLinkService', () => {
  it('generates UUID token and stores in Redis with 24h TTL');
  it('marks token as used after first verification');
  it('rejects already-used token with TOKEN_ALREADY_USED');
  it('rejects expired token with TOKEN_EXPIRED');
});
```

#### Quotation — Risk Score Algorithm
```typescript
// risk-score.service.test.ts
describe('computeBlendedRiskScore', () => {
  // ──── Happy paths ────
  it('CASE-01: returns score=0 when all lines exactly at ceiling', () => {
    const lines = [{ categoryId: 'hardware', discountPct: 15, lineTotal: 1000, quantity: 1 }];
    const ceilings = { tierCeiling: 15, categoryCeilings: { hardware: 15 } };
    const result = computeBlendedRiskScore(lines, ceilings, 1000);
    expect(result.blendedScore).toBe(0);
  });
  
  it('CASE-02: returns score=0 when all lines below ceiling');
  
  // ──── Single line violations ────
  it('CASE-03: positive score when single line exceeds category ceiling', () => {
    const lines = [{ categoryId: 'services', discountPct: 18, lineTotal: 500, quantity: 5 }];
    const ceilings = { tierCeiling: 15, categoryCeilings: { services: 10 } };
    const result = computeBlendedRiskScore(lines, ceilings, 500);
    // violationPoints = 18 - 10 = 8
    expect(result.blendedScore).toBeGreaterThan(0);
    expect(result.lineViolations[0].violationPoints).toBe(8);
    expect(result.lineViolations[0].isViolating).toBe(true);
  });
  
  it('CASE-04: uses min(tierCeiling, categoryCeiling) as effective ceiling');
  
  // ──── Multi-line ────
  it('CASE-05: PDF example — Hardware 12% (ceiling 15%) + Service 18% (ceiling 10%)', () => {
    const lines = [
      { categoryId: 'hardware', discountPct: 12, lineTotal: 5720, quantity: 5 },
      { categoryId: 'services', discountPct: 18, lineTotal: 249, quantity: 5 },
    ];
    const ceilings = { tierCeiling: 15, categoryCeilings: { hardware: 15, services: 10 } };
    const total = 5969;
    const result = computeBlendedRiskScore(lines, ceilings, total);
    
    expect(result.lineViolations.find(v => v.categoryId === 'hardware')?.isViolating).toBe(false);
    expect(result.lineViolations.find(v => v.categoryId === 'services')?.violationPoints).toBe(8);
    expect(result.blendedScore).toBeGreaterThan(0);
  });
  
  it('CASE-06: cumulative violations from multiple slightly-over lines score higher than one');
  it('CASE-07: worst single violation weighted in final score');
  
  // ──── Edge cases ────
  it('CASE-08: handles empty lines array → score=0');
  it('CASE-09: handles zero total order value → score=0');
  it('CASE-10: handles 0% discount on all lines → score=0');
  it('CASE-11: caps score at 100 even for extreme violations');
  it('CASE-12: negative violation points (compliant lines) do not reduce score below 0');
});
```

#### Billing — Proration
```typescript
// proration.service.test.ts
describe('computeProration', () => {
  it('CASE-01: DAILY mode — mid-cycle quantity increase → positive net charge', () => {
    const input = {
      currentPeriodStart: new Date('2026-09-01'),
      currentPeriodEnd: new Date('2026-09-30'),
      changeDate: new Date('2026-09-15'),
      oldQuantity: 5,
      newQuantity: 8,
      unitPrice: 49.99,
      prorationMode: 'DAILY' as const,
    };
    const result = computeProration(input);
    // 15 remaining days out of 30; 
    // credit = 49.99 * 5 * (15/30) = 124.98
    // charge = 49.99 * 8 * (15/30) = 199.96
    // net = 74.98
    expect(result.creditAmount).toBeCloseTo(124.98, 2);
    expect(result.chargeAmount).toBeCloseTo(199.96, 2);
    expect(result.netAmount).toBeCloseTo(74.98, 2);
    expect(result.creditNote).toBe(false);
  });
  
  it('CASE-02: DAILY mode — mid-cycle quantity decrease → negative net (credit note)');
  it('CASE-03: NONE mode → all amounts = 0');
  it('CASE-04: change on first day → full period charged');
  it('CASE-05: change on last day → minimal charge');
});

describe('computeCancellation', () => {
  it('CASE-01: end_of_period policy → effective date = currentPeriodEnd; refund = 0');
  it('CASE-02: immediate cancel with 50% refund policy → half remaining period refunded');
  it('CASE-03: immediate cancel on last day → near-zero refund');
  it('CASE-04: partialRefundPct=0 → no refund regardless of policy');
});
```

#### Fulfillment — Split Algorithm
```typescript
// split-algorithm.service.test.ts
describe('computeOptimalSplit', () => {
  it('CASE-01: single product, sufficient stock in one warehouse → single warehouse split');
  it('CASE-02: product exceeds single warehouse stock → split across 2 warehouses');
  it('CASE-03: minimizes warehouse count — prefers 1 warehouse over 2 if possible');
  it('CASE-04: when tied on warehouse count, prefers lower shippingCostWeight');
  it('CASE-05: total stock insufficient → partial fill + backorder record');
  it('CASE-06: multiple products — can source from same optimal warehouse');
  it('CASE-07: backorder does not reserve more than available stock');
  it('CASE-08: handles zero stock → full backorder');
});
```

---

## 4. Integration Tests

### Infrastructure

```typescript
// vitest.integration.config.ts
export default defineConfig({
  test: {
    globalSetup: './tests/setup/docker-global-setup.ts',  // start/stop Docker
    setupFiles: ['./tests/setup/db-setup.ts'],           // run migrations + seed
    teardownFiles: ['./tests/setup/db-teardown.ts'],
    timeout: 30_000,  // allow DB operations
  },
});
```

### Docker Setup for Tests

```typescript
// tests/setup/docker-global-setup.ts
import { DockerComposeEnvironment } from 'testcontainers';

let environment: DockerComposeEnvironment;

export async function setup() {
  environment = await new DockerComposeEnvironment('.', 'docker-compose.test.yml').up();
  // Wait for all DBs + Redis to be ready
}

export async function teardown() {
  await environment.down();
}
```

**docker-compose.test.yml** — Uses separate databases (auth_test, catalog_test, etc.) to avoid polluting dev data.

### HTTP Testing Pattern

Each service has an API test file that uses **Fastify's built-in `inject`** (no HTTP port needed):

```typescript
// quotation.api.test.ts
import { buildApp } from '../src/app';

let app: FastifyInstance;
let authToken: string;

beforeAll(async () => {
  app = await buildApp({ db: testPrismaClient, redis: testRedis });
  await app.ready();
  
  // Login to get test token
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: 'admin@test.com', password: 'AdminP@ss123' },
  });
  authToken = res.json().accessToken;
});

afterAll(() => app.close());
```

### Integration Test Suites (by service)

#### Auth Service Integration Tests
```typescript
// File: auth-service/tests/api/auth.api.test.ts

describe('POST /api/v1/auth/login', () => {
  it('CHECK-AUTH-001: returns 200 + tokens for valid credentials');
  it('CHECK-AUTH-002: returns 401 for wrong password');
  it('CHECK-AUTH-002: returns 401 for unknown email (same error — no enumeration)');
  it('CHECK-AUTH-003: returns 403 for inactive user');
  it('returns 429 after 10 rapid attempts from same IP');
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns new access token for valid refresh token');
  it('returns 401 for expired refresh token');
  it('returns 401 for revoked refresh token');
});

describe('GET /portal/v1/auth/verify', () => {
  it('CHECK-AUTH-004: returns 200 + session cookie for valid unused token');
  it('CHECK-AUTH-004: returns 401 for already-used token');
  it('returns 401 for expired token (past 24h TTL)');
});

describe('Role-based access', () => {
  it('CHECK-AUTH-005: GET /auth/users returns 200 for ADMIN');
  it('CHECK-AUTH-005: GET /auth/users returns 403 for SALES_REP');
  it('PUT /auth/users/:id/role returns 403 for non-ADMIN');
});
```

#### Catalog Service Integration Tests
```typescript
// File: catalog-service/tests/api/catalog.api.test.ts

describe('Products CRUD', () => {
  it('CHECK-CAT-001: create product with variants → GET returns product with variants');
  it('GET products: pagination works correctly');
  it('GET products: filter by categoryId returns only category products');
  it('GET products: full-text search on name works');
  it('DELETE product: soft-delete → isActive=false → does not appear in default list');
});

describe('Discount Tiers', () => {
  it('CHECK-CAT-002: GET /discount-tiers/ceilings returns correct tierCeilings map');
  it('GET /discount-tiers/ceilings returns categoryCeilings for each configured category');
  it('Ceiling data is cached; second request returns cached result');
});

describe('Approval Chains', () => {
  it('CHECK-CAT-003: resolve risk 10 → no approval required');
  it('CHECK-CAT-003: resolve risk 40 → SALES_MANAGER required');
  it('CHECK-CAT-003: resolve risk 75 → SALES_MANAGER + FINANCE required');
});

describe('Upsell Rules', () => {
  it('CHECK-CAT-004: suggestions filtered by minMarginPct');
  it('Promoted suggestions ranked before non-promoted');
  it('Priority order respected within promoted tier');
});

describe('Price Lists', () => {
  it('CHECK-CAT-005: resolve GOLD + EUR returns EUR-based price');
  it('resolve BRONZE + USD returns correct tier discount');
});
```

#### Quotation Service Integration Tests
```typescript
// File: quotation-service/tests/api/quotation.api.test.ts

describe('Quotation lifecycle (CHECK-QUOT-001)', () => {
  it('create quotation → status=DRAFT, version=1');
  it('add hardware line → lineTotal computed, blendedRiskScore=0 (within ceiling)');
  it('add service line at 18% → blendedRiskScore > 0 (ceiling 10%)');
  it('update line discount → risk score and margin updated in response');
  it('delete line → line removed from quotation');
});

describe('Approval routing (CHECK-QUOT-002)', () => {
  it('submit with score=0 → status=APPROVED directly');
  it('submit with Manager-range score → status=PENDING_MANAGER_APPROVAL');
  it('submit with high score → status=PENDING_FINANCE_APPROVAL (skips Manager step)');
});

describe('Approval actions (CHECK-QUOT-003)', () => {
  it('Manager approves (Finance not needed) → status=APPROVED');
  it('Manager approves (Finance needed) → status=PENDING_FINANCE_APPROVAL');
  it('Manager rejects → status=REJECTED; audit log entry created');
  it('Manager returns → status=DRAFT; audit log entry created');
  it('Reason required for reject → 400 if reason missing');
  it('Reason required for return → 400 if reason missing');
  it('Finance cannot act on PENDING_MANAGER_APPROVAL');
  it('SALES_REP cannot approve → 403');
});

describe('Portal negotiation (CHECK-QUOT-004)', () => {
  it('customer submits negotiation → status=UNDER_NEGOTIATION');
  it('negotiation with high proposed discount → re-enters approval');
  it('customer cannot access another customer\'s quotation → 403');
});

describe('Confirmation (CHECK-QUOT-005, CHECK-QUOT-006)', () => {
  it('confirm APPROVED quotation → status=CONFIRMED');
  it('confirm twice with same Idempotency-Key → second returns 200, no duplicate event');
  it('cannot confirm DRAFT quotation → 400 INVALID_TRANSITION');
});

describe('Concurrency (CHECK-QUOT-005)', () => {
  it('optimistic lock: two concurrent adds with same version → one 409 CONFLICT');
});

describe('Access control', () => {
  it('SALES_REP can only GET own quotations');
  it('SALES_MANAGER can GET all quotations');
});
```

#### Fulfillment Service Integration Tests
```typescript
// File: fulfillment-service/tests/api/fulfillment.api.test.ts

describe('Split recommendation (CHECK-FULL-001)', () => {
  it('products available in one warehouse → single-warehouse recommendation');
  it('product split across two → both warehouses in recommendation');
  it('total unavailable → backorder in recommendation');
});

describe('Accept split (CHECK-FULL-002)', () => {
  it('accepting split reserves stock (quantityReserved updated)');
  it('cannot reserve more than available (quantityOnHand - quantityReserved)');
});

describe('Manual override (CHECK-FULL-003)', () => {
  it('custom distribution stored with isOverride=true');
  it('override must total to order quantity → 422 if quantities don\'t match');
});

describe('Stock arrival (CHECK-FULL-004)', () => {
  it('arrival event published with affectedOrderIds');
  it('quantityOnHand increases after arrival');
});
```

#### Billing Service Integration Tests
```typescript
// File: billing-service/tests/api/billing.api.test.ts

describe('Invoice from confirmation (CHECK-BILL-001)', () => {
  it('quotation.confirmed event → ONE_TIME invoice for one-time lines');
  it('quotation.confirmed event → SubscriptionLine for recurring lines');
  it('mixed order → both invoice and subscription line created');
});

describe('Payment recording (CHECK-BILL-002, CHECK-BILL-003)', () => {
  it('record payment → invoice status=PAID');
  it('payment with same Idempotency-Key → second is no-op; still PAID');
  it('overpayment → invoice marked PAID; excess recorded');
});

describe('Proration (CHECK-BILL-004)', () => {
  it('quantity increase mid-cycle → proration invoice created');
  it('quantity decrease mid-cycle → credit note created');
  it('NONE proration mode → no proration invoice');
});

describe('Cancellation (CHECK-BILL-005)', () => {
  it('end_of_period cancel → effective date = period end; no refund');
  it('immediate cancel with 50% refund → credit note = 50% * remaining days / total days');
  it('subscription status=CANCELLED after cancel');
});

describe('Billing schedule (CHECK-BILL-006)', () => {
  it('schedule shows next 3 billing dates for recurring line');
  it('one-time invoice included in schedule response');
});
```

#### Analytics Service Integration Tests
```typescript
// File: analytics-service/tests/api/analytics.api.test.ts

describe('Dashboard (CHECK-ANA-001)', () => {
  it('pipeline breakdown counts match seeded quotations');
  it('KPIs computed from snapshots (totalRevenue, avgMargin)');
  it('date range filter narrows results');
});

describe('Deal Health (CHECK-ANA-002, CHECK-ANA-003)', () => {
  it('quotation inactive > threshold → STALLED alert generated');
  it('quotation inactive < threshold → no STALLED alert');
  it('rep\'s high risk score quotation → DISCOUNT_ANOMALY alert');
  it('delivery_slippage event → DELIVERY_SLIPPAGE alert');
});

describe('Reports (CHECK-ANA-007)', () => {
  it('quotation report filtered by repId returns only that rep\'s quotations');
  it('quotation report filtered by status returns only matching');
  it('recurring revenue report shows MRR and upcoming renewals');
});

describe('Nudge actions (CHECK-ANA-005)', () => {
  it('nudge action creates NudgeAction record');
  it('nudge action sends email (check Mailpit/stub)');
  it('resolve alert marks isResolved=true');
});

describe('Report export (CHECK-ANA-006)', () => {
  it('PDF export returns downloadUrl');
  it('GET downloadUrl returns Content-Type: application/pdf');
  it('XLS export returns Content-Type for Excel');
});
```

---

## 5. E2E Tests

### Framework: Playwright

**Target**: Chrome (primary), Firefox (secondary)

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'internal-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'portal-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'portal-mobile', use: { ...devices['iPhone 13'] } },
  ],
});
```

### E2E Test Files

```
e2e/
├── auth/
│   ├── internal-login.spec.ts      # CHECK-FE-LOGIN-001/002/003
│   ├── portal-magic-link.spec.ts   # CHECK-PORTAL-001
│   └── auth-guards.spec.ts         # CHECK-FE-001, CHECK-PORTAL-007
├── quotation-builder/
│   ├── builder.spec.ts             # CHECK-FE-BUILDER-001/002/003/004
│   └── upsell-panel.spec.ts
├── approval/
│   └── approval-flow.spec.ts       # CHECK-FE-APPROVAL-001/002/003
├── portal/
│   ├── portal-negotiation.spec.ts  # CHECK-PORTAL-003/004/005
│   ├── portal-security.spec.ts     # CHECK-PORTAL-002/006/007
│   └── portal-confirmation.spec.ts # CHECK-PORTAL-005
├── fulfillment/
│   └── fulfillment.spec.ts         # CHECK-FE-FULFILLMENT-001/002
├── billing/
│   └── billing.spec.ts             # CHECK-FE-BILLING-001/002/003
├── dashboard/
│   ├── dashboard.spec.ts           # CHECK-FE-DASHBOARD-001/002
│   └── reports.spec.ts             # CHECK-FE-REPORTS-001
└── admin/
    └── admin-config.spec.ts        # CHECK-FE-ADMIN-001/002/003
```

### Critical E2E: Full Quotation Lifecycle

```typescript
// e2e/quotation-builder/builder.spec.ts

test('Full quotation lifecycle from creation to confirmation', async ({ page }) => {
  // 1. Login as Sales Rep
  await page.goto('/login');
  await page.fill('#email', 'rep@company.com');
  await page.fill('#password', 'RepP@ss123');
  await page.click('#login-button');
  await expect(page).toHaveURL('/app/dashboard');

  // 2. Create new quotation
  await page.click('#create-quotation-button');
  await page.selectOption('#customer-select', { label: 'Acme Corp' });
  await page.click('#create-quotation-submit');
  
  // 3. Add hardware line (within discount ceiling)
  await page.fill('#product-search', 'Enterprise Laptop');
  await page.click('[data-testid="product-option-laptop"]');
  await page.fill('[data-testid="quantity-input-0"]', '5');
  await page.fill('[data-testid="discount-input-0"]', '12');
  
  // 4. Add service line (exceeds discount ceiling)
  await page.fill('#product-search', 'Setup Service');
  await page.click('[data-testid="product-option-service"]');
  await page.fill('[data-testid="quantity-input-1"]', '5');
  await page.fill('[data-testid="discount-input-1"]', '18');  // ceiling = 10%
  
  // 5. Verify risk score is non-zero
  await expect(page.locator('#risk-score-indicator')).toHaveAttribute('data-score', /[1-9]\d*/);
  await expect(page.locator('[data-testid="line-violation-service"]')).toBeVisible();
  
  // 6. Add upsell suggestion
  await expect(page.locator('[data-testid="upsell-panel"]')).toBeVisible();
  await page.click('[data-testid="upsell-add-button-0"]');
  
  // 7. Submit for approval
  await page.click('#submit-quotation-button');
  await expect(page).toHaveURL(/\/approval$/);
  await expect(page.locator('[data-testid="approval-status"]')).toContainText('Pending Manager Approval');

  // 8. Login as Manager and approve
  await page.context().clearCookies();  // logout
  await loginAs(page, 'manager@company.com', 'ManagerP@ss123');
  await page.goto(`/app/quotations/${quotationId}/approval`);
  await page.click('#approve-button');
  await page.fill('#approval-reason', 'Strategic account, margins acceptable');
  await page.click('#confirm-approve');
  await expect(page.locator('[data-testid="approval-status"]')).toContainText('Approved');

  // 9. Send to customer portal
  await loginAs(page, 'rep@company.com', 'RepP@ss123');
  await page.click('#send-to-customer-button');
  
  // 10. Customer confirms from portal
  const portalLink = await page.locator('#portal-link').getAttribute('href');
  await page.context().clearCookies();
  await page.goto(portalLink);  // magic link or direct portal link
  await page.click('#confirm-quotation-button');
  await page.click('#confirm-dialog-yes');
  await expect(page.locator('[data-testid="confirmation-banner"]')).toBeVisible();
  await expect(page.locator('[data-testid="confirmation-banner"]')).toContainText('Order Confirmed');
});
```

---

## 6. Performance Tests

```typescript
// tests/performance/api-response-times.test.ts

describe('API Response Times (REQ-PERF-001, REQ-NF-008)', () => {
  it('GET /quotations — < 500ms with 100 quotations in DB', async () => {
    const start = Date.now();
    const res = await api.get('/quotations');
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('POST /quotations/:id/lines — < 500ms (includes risk score computation)', async () => {
    const start = Date.now();
    await api.post(`/quotations/${quotationId}/lines`, { productId, quantity: 5, discountPct: 12 });
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('GET /catalog/products — < 200ms with catalog cache warm', async () => {
    // First request (cache miss)
    await api.get('/catalog/products');
    // Second request (cache hit)
    const start = Date.now();
    await api.get('/catalog/products');
    expect(Date.now() - start).toBeLessThan(200);
  });
});
```

---

## 7. Security Tests

```typescript
// tests/security/security.test.ts

describe('Authentication boundary (REQ-SEC-007)', () => {
  it('GET /api/v1/quotations with no token → 401');
  it('GET /api/v1/quotations with expired token → 401');
  it('GET /api/v1/quotations with portal session cookie → 401');
  it('GET /portal/v1/quotations/:id with JWT → 401');
});

describe('Authorization (REQ-ROLE-001–005)', () => {
  it('SALES_REP cannot access other rep\'s quotation → 403');
  it('SALES_REP cannot approve quotation → 403');
  it('FINANCE cannot approve at SALES_MANAGER level → 403');
  it('ADMIN can access all quotations');
});

describe('Rate limiting (REQ-IMP-010)', () => {
  it('POST /auth/login: 11th request in 1 minute → 429');
  it('POST /portal/auth/magic-link: 4th request per email → 429');
});

describe('Input validation (REQ-SEC-009)', () => {
  it('SQL injection attempt in product search → sanitized, no error leaked');
  it('XSS payload in quotation notes → stored as plaintext, rendered escaped in UI');
  it('discount > 100 → 400 VALIDATION_ERROR');
  it('negative quantity → 400 VALIDATION_ERROR');
});

describe('Portal isolation (REQ-CON-003)', () => {
  it('portal customer cannot view /api (internal) routes → 401');
  it('internal user cannot call /portal routes with their JWT');
});
```

---

## 8. Contract Tests (API Shape Verification)

```typescript
// tests/contract/api-shape.test.ts
// Uses zod to verify response shapes match documented contracts

import { quotationSchema } from '../../types/api.types';

test('GET /quotations/:id response matches QuotationSchema', async () => {
  const res = await api.get(`/quotations/${seedQuotationId}`);
  const result = quotationSchema.safeParse(res.data);
  expect(result.success).toBe(true);
});
```

---

## 9. Test IDs — Unique Element IDs for Playwright

Every interactive element in the frontend must have a unique `data-testid` attribute:

```
data-testid="login-button"
data-testid="signup-button"
data-testid="product-search"
data-testid="product-option-{productSlug}"
data-testid="quantity-input-{lineIndex}"
data-testid="discount-input-{lineIndex}"
data-testid="delete-line-{lineIndex}"
data-testid="risk-score-indicator"
data-testid="margin-gauge"
data-testid="submit-quotation-button"
data-testid="approve-button"
data-testid="reject-button"
data-testid="return-button"
data-testid="approval-reason-input"
data-testid="confirm-approve"
data-testid="send-to-customer-button"
data-testid="portal-link"
data-testid="confirm-quotation-button"
data-testid="confirm-dialog-yes"
data-testid="confirmation-banner"
data-testid="negotiate-button"
data-testid="propose-discount-input"
data-testid="negotiate-message-input"
data-testid="submit-negotiation-button"
data-testid="upsell-panel"
data-testid="upsell-add-button-{index}"
data-testid="alert-card-{alertId}"
data-testid="nudge-button-{alertId}"
data-testid="export-pdf-button"
data-testid="export-xls-button"
```

---

## 10. CI Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [auth-service, catalog-service, quotation-service, fulfillment-service, billing-service, analytics-service]
    steps:
      - uses: actions/checkout@v4
      - run: cd services/${{ matrix.service }} && npm ci && npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, env: { POSTGRES_PASSWORD: test } }
      redis: { image: redis:7 }
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose -f docker-compose.test.yml up -d
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 11. Master Checkpoint Checklist

The following checkpoints must ALL pass before submission:

**Auth**:
- [ ] CHECK-AUTH-001 through CHECK-AUTH-006

**Catalog**:
- [ ] CHECK-CAT-001 through CHECK-CAT-005

**Quotation**:
- [ ] CHECK-QUOT-001 through CHECK-QUOT-008

**Fulfillment**:
- [ ] CHECK-FULL-001 through CHECK-FULL-005

**Billing**:
- [ ] CHECK-BILL-001 through CHECK-BILL-006

**Analytics**:
- [ ] CHECK-ANA-001 through CHECK-ANA-007

**Events**:
- [ ] CHECK-EVENT-001 through CHECK-EVENT-005

**Data Architecture**:
- [ ] CHECK-DATA-001 through CHECK-DATA-005

**API Contracts**:
- [ ] CHECK-API-001 through CHECK-API-004

**Frontend Workspace**:
- [ ] CHECK-FE-LOGIN-001 through CHECK-FE-003
- [ ] CHECK-FE-BUILDER-001 through CHECK-FE-BUILDER-004
- [ ] CHECK-FE-APPROVAL-001 through CHECK-FE-APPROVAL-003
- [ ] CHECK-FE-FULFILLMENT-001/002
- [ ] CHECK-FE-BILLING-001 through CHECK-FE-BILLING-003
- [ ] CHECK-FE-DASHBOARD-001/002
- [ ] CHECK-FE-REPORTS-001
- [ ] CHECK-FE-ADMIN-001 through CHECK-FE-ADMIN-003

**Customer Portal**:
- [ ] CHECK-PORTAL-001 through CHECK-PORTAL-008

**Security**:
- [ ] All security tests pass
- [ ] All rate limiting tests pass
