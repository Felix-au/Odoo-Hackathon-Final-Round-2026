# DealFlow360 — Coding Agent Instructions

> **Read this document first before writing any code.** This is the master instruction set for the AI coding agent implementing DealFlow360.

---

## 1. Your Mission

You are implementing DealFlow360 — a B2B sales quotation management platform — from scratch using the documentation in this `docs/` folder as your technical specification.

**Primary goal**: Implement every requirement described in the docs. Every checkpoint listed in every service doc and the testing strategy must be passing when you are done.

**Secondary goal**: Write clean, maintainable, well-structured TypeScript code with consistent patterns across all services.

---

## 2. Documentation Reading Order

Read these documents **in this exact order** before writing any code:

1. `00-requirements.md` — What we are building
2. `01-overall-architecture.md` — System structure
3. `02-technology-stack.md` — Exact versions and libraries to use
4. `10-data-architecture.md` — Database schemas and ownership
5. `09-api-contracts.md` — The canonical API reference
6. `14-event-driven-communication.md` — Redis Streams event system
7. `03-auth-service.md` — Auth implementation details
8. `04-catalog-service.md` — Catalog implementation details
9. `05-quotation-service.md` — Core quotation engine (most complex)
10. `06-fulfillment-service.md` — Fulfillment logic
11. `07-billing-service.md` — Billing and subscriptions
12. `08-analytics-service.md` — Analytics and reporting
13. `11-frontend-architecture.md` — React app structure
14. `12-frontend-workspace-modules.md` — Internal workspace pages
15. `13-frontend-customer-portal.md` — Customer portal pages
16. `15-testing-strategy.md` — All test requirements
17. `16-deployment-and-devops.md` — Docker Compose and deployment
18. `17-requirement-traceability.md` — Full requirement-to-checkpoint mapping

---

## 3. Implementation Order

Build in this order (each step unblocks the next):

### Phase 1: Infrastructure Foundation
1. Create repository structure (mono-repo layout)
2. Write `docker-compose.yml` exactly as specified in `16-deployment-and-devops.md`
3. Create `.env.example` with all environment variables
4. Create each service directory with `package.json`, `tsconfig.json`, `Dockerfile.dev`

### Phase 2: Database Schemas
5. Write Prisma schemas for all 6 services (see each service doc + `10-data-architecture.md`)
6. Verify all schemas are internally consistent (no Prisma syntax errors)
7. Write seed scripts for each service

### Phase 3: Core Services (Backend)
8. **Auth Service** (first — all other services depend on JWT validation)
9. **Catalog Service** (second — Quotation needs discount ceilings)
10. **Quotation Service** (third — the core domain service)
11. **Fulfillment Service** (fourth)
12. **Billing Service** (fifth — consumes quotation events)
13. **Analytics Service** (sixth — pure event consumer)

### Phase 4: API Gateway
14. Implement gateway routing (proxy + JWT validation middleware)

### Phase 5: Event System
15. Implement `EventPublisher` and `EventConsumer` classes (shared utility)
16. Wire up all event publishers (quotation → confirmed, etc.)
17. Wire up all event consumers (billing ← quotation.confirmed, etc.)

### Phase 6: Frontend
18. Scaffold React app with Vite + TypeScript + Tailwind
19. Implement router (internal + portal routes)
20. Implement auth store + interceptors
21. Build pages in this order:
    - Login + Signup
    - Quotation Builder (most important — demo critical)
    - Quotation Approval
    - Portal (login + verify + quotation view + negotiation)
    - Fulfillment
    - Billing
    - Dashboard + Deal Health
    - Reports
    - Admin Config pages

### Phase 7: Tests
22. Write unit tests (risk score, proration, split algorithm)
23. Write integration tests (API tests per service)
24. Write E2E tests (Playwright — critical user journeys)

---

## 4. Critical Business Rules — Do Not Get Wrong

These are the most commonly misunderstood requirements. Read carefully:

### Risk Score Algorithm
- **Effective ceiling = min(tier ceiling, category ceiling)**
- Hardware at GOLD tier: tier ceiling = 15%, category ceiling = 15% → effective = 15%
- Service at GOLD tier: tier ceiling = 15%, category ceiling = 10% → **effective = 10%** (not 15%)
- Violation = discountPct - effectiveCeiling (only positive violations count)
- Score is **weighted by line's share of total order value**
- Score is then multiplied by the worst single violation
- Score of 0 = no approval needed
- Score > 0 (any) = at minimum Sales Manager approval needed
- Score > configured threshold = Sales Manager + Finance needed
- **See `05-quotation-service.md` section 7 for the exact formula**

### Approval Chain Routing
- Approval chain configured in Catalog Service (admin-configurable)
- Quotation Service fetches chain config at submit time
- Do NOT hardcode thresholds (30/70) — read from `approval-chains/resolve` endpoint
- Risk score 0 → no approval → immediately moves to APPROVED on submit
- If both Manager and Finance required: Manager step first, Finance second
- Either can REJECT and terminate the chain
- Either can RETURN for revision (goes back to DRAFT)
- Quotation stores current `status` + `requiredApprovers` list from chain config

### Customer Portal Isolation
- Portal session (`portal_session` cookie) is **completely separate** from JWT
- Internal auth middleware must **reject** portal session cookies
- Portal auth middleware must **reject** JWT tokens
- `/portal/*` routes only accept portal sessions
- `/api/*` routes only accept JWTs
- This must be enforced at the gateway level

### Quotation Confirmation Idempotency
- `Quotation.idempotencyKey` is set on first confirmation
- If same `Idempotency-Key` header sent again → return 200 with existing confirmed state
- Do NOT emit `quotation.confirmed` event twice
- This prevents double invoices when network retries occur

### Optimistic Concurrency
- `Quotation.version` is an integer starting at 1
- Every write operation (add line, update line, submit) must accept current `version` in request
- If DB row `version` ≠ request `version` → return 409 CONFLICT
- On successful write → increment `version` by 1 in same DB transaction

### Billing Separation
- One-time lines → ONE_TIME invoice
- Recurring lines → SubscriptionLine (NOT invoice yet — invoice generated each billing cycle)
- Both can exist for the same order
- They are displayed separately in the billing UI
- Never create a single invoice that mixes one-time and recurring amounts

---

## 5. Technology Constraints

**Use EXACTLY these packages** (versions from `02-technology-stack.md`):

Backend:
- Node.js 20 LTS
- TypeScript 5.x with strict mode
- Fastify 4.x (not Express)
- Prisma 5.x with PostgreSQL
- ioredis 5.x for Redis
- Zod 3.x for validation
- @fastify/swagger for API docs
- @fastify/rate-limit for rate limiting
- @fastify/cors for CORS
- @fastify/http-proxy for gateway
- jsonwebtoken for JWT
- bcrypt for password hashing

Frontend:
- React 18.x
- React Router 6.x
- Vite 5.x
- TypeScript 5.x
- Tailwind CSS 3.x
- TanStack Query (React Query) 5.x
- Zustand 4.x
- React Hook Form + Zod resolver
- Axios 1.x
- Sonner for toasts
- dnd-kit for drag-and-drop

Testing:
- Vitest 1.x for unit + integration
- Playwright for E2E
- Supertest for HTTP testing

---

## 6. Code Quality Standards

### TypeScript
- Strict mode enabled (`"strict": true` in tsconfig)
- No `any` types — use `unknown` + type narrowing
- All function parameters and return types explicitly typed
- Use `interface` for object shapes, `type` for unions/intersections

### Error Handling
- All API errors return RFC 7807 Problem Details format
- Never expose raw exception messages to clients
- All async operations wrapped in try/catch
- Unhandled errors caught by Fastify's `setErrorHandler`

### Environment Variables
- Every service validates env vars with Zod at startup
- Missing required env var = process exits with descriptive error

### Logging
- Use `pino` (Fastify's default logger) — structured JSON logging
- Always log `requestId` and `userId` on authenticated endpoints
- Log event publish/consume with `eventType` and `eventId`
- Never log passwords, tokens, or PII

### Database
- All queries through Prisma client — no raw SQL except `$queryRaw`
- Repository pattern: each entity has a `<entity>.repository.ts`
- Service layer calls repository — never calls Prisma directly from routes
- All writes in transactions when multiple tables involved

### API Routes
- Use Fastify JSON Schema or Zod for request validation
- All routes have rate limits configured
- All routes log incoming request with requestId
- Return types explicitly typed

---

## 7. File Naming Conventions

```
services/
  auth-service/src/
    api/routes/internal-auth.routes.ts    # kebab-case
    db/repositories/user.repository.ts
    domain/services/auth.service.ts
    domain/entities/user.entity.ts

frontend/src/
  app/pages/QuotationBuilderPage.tsx      # PascalCase for components
  app/layout/AppShell.tsx
  api/hooks/useQuotations.ts             # camelCase for hooks
  stores/auth.store.ts                   # camelCase for stores
```

---

## 8. Monorepo Structure

```
dealflow360/
├── docker-compose.yml
├── docker-compose.test.yml
├── .env.example
├── README.md
├── docs/                         # All spec docs
├── services/
│   ├── gateway/
│   ├── auth-service/
│   ├── catalog-service/
│   ├── quotation-service/
│   ├── fulfillment-service/
│   ├── billing-service/
│   └── analytics-service/
├── frontend/
└── e2e/                          # Playwright E2E tests
```

Each service is a **completely standalone Node.js project** with its own `package.json`.

---

## 9. Common Patterns — Copy/Paste These

### Fastify App Bootstrap
```typescript
// services/<service>/src/app.ts
import fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

export async function buildApp() {
  const app = fastify({
    logger: { level: 'info' },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // Plugins
  await app.register(import('@fastify/cors'), {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173'],
  });
  await app.register(import('@fastify/swagger'), { ... });
  await app.register(import('@fastify/rate-limit'), { max: 100, timeWindow: '1 minute' });

  // Health check
  app.get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    return { status: 'healthy', service: '<service-name>' };
  });

  // Routes
  await app.register(routes, { prefix: '/api/v1' });

  // Error handler (RFC 7807)
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode ?? 500;
    reply.status(status).send({
      type: `https://dealflow360.com/errors/${error.code ?? 'internal-error'}`,
      title: error.message,
      status,
      detail: error.message,
      instance: request.url,
    });
  });

  return app;
}
```

### Prisma Client Singleton
```typescript
// db/prisma-client.ts
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### JWT Middleware (Shared)
```typescript
// middleware/jwt-auth.middleware.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';

export async function jwtAuthMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace('Bearer ', '');
  if (!token) return reply.code(401).send({ error: 'UNAUTHORIZED' });
  
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    request.user = { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return reply.code(401).send({ error: 'TOKEN_INVALID' });
  }
}
```

### Event Publishing Pattern
```typescript
// In quotation.service.ts — after successful DB write
await transactionalWrite();
await eventPublisher.publish('dealflow360:quotation', {
  eventType: 'quotation.confirmed',
  version: '1.0',
  companyId: quotation.companyId,
  payload: { quotationId, customerId, lines, ... }
});
```

### Event Consumer Registration
```typescript
// In billing-service/src/events/consumers.ts
export async function registerConsumers(redis: Redis): Promise<void> {
  const consumer = new EventConsumer(redis, 'dealflow360:quotation', 'billing-service', 'billing-worker-1', new Map([
    ['quotation.confirmed', handleQuotationConfirmed],
    ['quotation.rejected', handleQuotationRejected],
  ]));
  
  await consumer.start();
}

async function handleQuotationConfirmed(payload: QuotationConfirmedPayload): Promise<void> {
  // Create invoices + subscription lines
  // Idempotent: check if invoice already exists for this quotationId
  const existing = await billingRepo.findInvoiceByOrderId(payload.quotationId);
  if (existing) return;  // already processed
  
  await billingService.createOrderBilling(payload);
}
```

---

## 10. What To Absolutely NOT Do

1. **Do not** create a single monolithic service — every service MUST be separate
2. **Do not** let one service's Prisma client connect to another service's database
3. **Do not** hardcode configuration values (thresholds, URLs) — everything from env vars or DB config
4. **Do not** store raw tokens (JWT, refresh tokens) in the database — hash them first
5. **Do not** use Express — use Fastify for all services
6. **Do not** skip the `/health` endpoint — Docker Compose depends on it
7. **Do not** let the portal auth middleware accept JWTs, or the internal middleware accept portal sessions
8. **Do not** create an invoice twice for the same confirmed quotation (idempotency)
9. **Do not** put business logic in routes — it goes in the service/domain layer
10. **Do not** skip validation of environment variables — Zod schema at startup
11. **Do not** use synchronous bcrypt (use `bcrypt.hash` not `bcrypt.hashSync` in async handlers)
12. **Do not** emit the `quotation.confirmed` event before the DB write commits (publish in `onSettled` of transaction)
13. **Do not** ignore the `version` field on quotation mutations — optimistic concurrency is required
14. **Do not** add `any` types to suppress TypeScript errors — fix the actual type issue

---

## 11. Demo Priorities

If you are running out of time and must cut scope, preserve these features in priority order:

**Critical (must work for demo)**:
1. Auth: Login + logout (JWT)
2. Product catalog: Create + list products
3. Quotation builder: Create, add lines, set discounts, compute risk score
4. Approval flow: Submit → Manager approval → approved
5. Customer portal: Magic link → view quotation → confirm
6. Billing: Invoice created after confirmation

**Important (should work)**:
7. Analytics dashboard with deal health
8. Fulfillment split recommendation
9. Subscription lines + billing schedule
10. PDF report export

**Can stub/placeholder**:
11. Multi-currency
12. Multi-company
13. Advanced upsell margin calculations
14. Delivery slippage detection

---

## 12. Hackathon-Specific Simplifications

These simplifications are acceptable for the hackathon:

- **Email sending**: Use SMTP to Mailpit (local) — no real email delivery needed
- **Currency exchange rates**: Manual admin entry in DB — no live rates
- **Payment gateway**: Record payment manually — no Stripe integration
- **PDF export**: Use `pdfkit` or `puppeteer` — basic table layout acceptable
- **XLS export**: Use `exceljs` — basic spreadsheet acceptable
- **Shipping carrier**: Not integrated — shipping cost is `weight × units` from warehouse config
- **Multi-company**: `companyId = "default"` for all entities — single company operation
- **Real-time updates**: Poll with TanStack Query (staleTime) — no WebSockets needed
- **File uploads**: Not required
- **Notification emails**: Console log + Mailpit trap — no real email delivery
