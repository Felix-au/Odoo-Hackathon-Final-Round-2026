# DealFlow360 — Technology Stack

---

## Selection Criteria

Technologies are chosen for:
- **Hackathon speed**: Minimal boilerplate, productive defaults
- **AI-agent implementation friendliness**: Well-documented, widely trained-on, predictable patterns
- **Ecosystem maturity**: Battle-tested in production B2B systems
- **Testing support**: First-class test tooling
- **Developer productivity**: Strong typing, IDE support, hot reload
- **Ease of deployment**: Docker-first, minimal ops overhead

---

## Complete Technology Stack

### Backend Services

| Concern | Technology | Version | Rationale |
|---------|-----------|---------|-----------|
| **Runtime** | Node.js | 20 LTS | Fast startup, excellent JSON handling, huge ecosystem, great for API services |
| **Language** | TypeScript | 5.x | Type safety catches bugs early; AI agents produce more correct code with types |
| **Framework** | Fastify | 4.x | 2-3x faster than Express; built-in JSON schema validation; plugin ecosystem |
| **ORM / Query Builder** | Prisma | 5.x | Auto-generated type-safe queries; excellent migration system; AI-friendly schema |
| **Validation** | Zod | 3.x | Schema-first validation; shares types with TypeScript; composable |
| **Password Hashing** | bcryptjs | 2.x | Well-tested, cross-platform bcrypt |
| **JWT** | @fastify/jwt | 8.x | Fastify-native JWT plugin |
| **API Documentation** | @fastify/swagger | 8.x | Auto-generates OpenAPI 3.0 from route schemas |

### API Gateway / BFF

| Concern | Technology | Version | Rationale |
|---------|-----------|---------|-----------|
| **Gateway** | Nginx | 1.25 | Proven reverse proxy; TLS termination; rate limiting |
| **BFF Layer** | Fastify (Node.js) | same | Thin BFF for request aggregation, auth validation, routing |

> **Decision**: Rather than a heavy API gateway product (Kong, Traefik), we use Nginx + a thin Node.js BFF. This avoids operational overhead not justified for a hackathon.

### Frontend

| Concern | Technology | Version | Rationale |
|---------|-----------|---------|-----------|
| **Framework** | React | 18.x | Dominant ecosystem; hooks model suits complex state; AI agents excel at React |
| **Language** | TypeScript | 5.x | Same as backend — shared types possible |
| **Build Tool** | Vite | 5.x | Sub-second HMR; fast cold starts |
| **Routing** | React Router | 6.x | File-convention optional; declarative; well-known |
| **State Management** | Zustand | 4.x | Minimal boilerplate; no context pyramid; testable stores |
| **Server State / Caching** | TanStack Query | 5.x | Auto-caching, background refresh, stale-while-revalidate for API data |
| **UI Component Library** | shadcn/ui | latest | Accessible, unstyled components with Tailwind; copy-paste, no version lock |
| **Styling** | Tailwind CSS | 3.x | Utility-first; rapid iteration; works perfectly with shadcn |
| **Forms** | React Hook Form | 7.x | Minimal re-renders; excellent Zod integration |
| **Charts / Dashboards** | Recharts | 2.x | React-native charting; simple API |
| **Kanban / Pipeline** | dnd-kit | 6.x | Accessible drag-and-drop; works with React 18 |
| **Notifications** | Sonner | 1.x | Lightweight toast notifications |
| **PDF Preview** | react-pdf | 7.x | In-browser PDF viewer for quotation previews |
| **Date handling** | date-fns | 3.x | Modular, tree-shakeable date utility |
| **HTTP Client** | Axios | 1.x | Interceptors for auth token injection; consistent error handling |

### Database

| Concern | Technology | Version | Rationale |
|---------|-----------|---------|-----------|
| **Primary Database** | PostgreSQL | 16 | ACID transactions; JSON support; excellent with Prisma; production-grade |
| **Migration Tool** | Prisma Migrate | (Prisma 5.x) | Schema-driven migrations; zero-drift guarantee |
| **Connection Pooling** | PgBouncer | 1.21 | Required when multiple Node.js instances connect to Postgres |

> **Database per service**: Each of the 6 services has its own PostgreSQL database within the same Postgres instance for hackathon simplicity, with separate database names and credentials. In production, these would be separate instances.

### Caching & Message Broker

| Concern | Technology | Version | Rationale |
|---------|-----------|---------|-----------|
| **Cache** | Redis | 7.x | Session storage, magic link tokens, catalog cache, analytics snapshots |
| **Message Broker** | Redis Streams | (Redis 7.x) | Avoids adding Kafka/RabbitMQ for a hackathon; Redis Streams provide persistent, ordered, consumer-group-based messaging sufficient for our event volume |
| **Redis Client** | ioredis | 5.x | Full Redis Streams support; TypeScript types |

> **Decision against Kafka**: Kafka adds ~20 minutes of operational setup (ZooKeeper/KRaft, topic config) with no measurable benefit at hackathon scale. Redis Streams provide equivalent guarantees for our use case.

### Authentication & Authorization

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| **Internal Auth** | JWT (HS256) via @fastify/jwt | Stateless; gateway validates, services trust |
| **Portal Auth** | Opaque session token stored in Redis | Stateful; allows instant invalidation; httpOnly cookie |
| **Magic Link** | UUID v4 token stored in Redis (24h TTL, single-use) | Simple, no external dependency |
| **Password Hashing** | bcryptjs (salt rounds: 12) | Industry standard |
| **Authorization** | Custom RBAC middleware in each service | Simple enough for 5 roles; no external authz server needed |

### Email

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| **Email Service** | Nodemailer + SMTP (configurable) | Works with any SMTP provider; local dev with Mailpit |
| **Dev Email Catcher** | Mailpit | Local SMTP server + web UI for testing emails without sending real emails |

### PDF & XLS Export

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| **PDF Generation** | Puppeteer (headless Chrome) | Renders HTML templates to PDF; handles complex layouts |
| **XLS Generation** | ExcelJS | Full Excel format support; TypeScript-friendly |

### Containerization

| Concern | Technology | Version | Rationale |
|---------|-----------|---------|-----------|
| **Container Runtime** | Docker | 24.x | Universal standard |
| **Orchestration (Dev/Demo)** | Docker Compose | 2.x | Single-command startup of entire stack |
| **Base Images** | node:20-alpine | — | Small footprint |

### Observability

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| **Structured Logging** | pino | Built into Fastify; JSON logs; fast |
| **Log Aggregation** | Docker Compose log driver + optional Loki | Local: `docker compose logs`; production: Loki + Grafana |
| **Metrics** | prom-client (Prometheus) | Standard metrics; `/metrics` endpoint per service |
| **Tracing** | Request-ID header (UUID) injected at Gateway | Lightweight; good enough for hackathon without OpenTelemetry overhead |
| **Health Checks** | GET /health on each service | Returns `{status, uptime, db_status}` |

> **Decision against full observability stack**: Jaeger/Zipkin + Prometheus + Grafana add ~30 minutes of setup. Request-ID tracing + structured logs + health checks provide 80% of the value at 10% of the complexity for a hackathon.

### Testing

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| **Unit / Integration Tests** | Vitest | Vite-native; Jest-compatible API; fast; works with TypeScript without transpile step |
| **API Tests** | Fastify inject + Vitest | In-process testing; no need to start HTTP server |
| **E2E Tests** | Playwright | Best-in-class E2E; auto-wait; TypeScript; cross-browser |
| **Test Factories** | @faker-js/faker | Realistic test data generation |
| **Database Test Isolation** | Prisma + test database + transaction rollback | Each test runs in its own transaction; rolled back after |
| **HTTP Mocking** | msw (Mock Service Worker) | Frontend API mocking |
| **Contract Testing** | Pact (if needed) | Consumer-driven contracts between services |

### CI/CD

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| **CI** | GitHub Actions | Free; tight GitHub integration; Docker support |
| **Pipeline stages** | lint → type-check → unit tests → integration tests → build → e2e tests | Standard quality gate |
| **Versioning** | Conventional Commits + semantic-release | Automated CHANGELOG |

---

## Project Structure (Monorepo)

```
dealflow360/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── packages/
│   ├── shared/                     # Shared TypeScript types, Zod schemas, constants
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── schemas/
│   │   │   └── constants/
│   │   └── package.json
│   └── api-client/                 # Auto-generated API client (optional)
├── services/
│   ├── gateway/                    # Nginx config + BFF Node.js app
│   ├── auth-service/
│   ├── catalog-service/
│   ├── quotation-service/
│   ├── fulfillment-service/
│   ├── billing-service/
│   └── analytics-service/
├── frontend/
│   ├── src/
│   │   ├── app/                    # Internal workspace (React Router routes)
│   │   ├── portal/                 # Customer portal (separate routing tree)
│   │   ├── components/             # Shared UI components
│   │   ├── hooks/                  # Shared custom hooks
│   │   ├── stores/                 # Zustand stores
│   │   ├── api/                    # Axios clients + TanStack Query hooks
│   │   └── lib/                    # Utilities
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── docs/                           # This documentation
```

### Per-Service Structure

```
services/quotation-service/
├── src/
│   ├── config/           # Environment config, constants
│   ├── db/
│   │   ├── prisma/       # schema.prisma, migrations/
│   │   └── repositories/ # Data access layer
│   ├── domain/
│   │   ├── entities/     # Domain types (no DB dependency)
│   │   └── services/     # Business logic
│   ├── api/
│   │   ├── routes/       # Fastify route definitions
│   │   ├── schemas/      # Zod/JSON Schema for request/response
│   │   └── middleware/   # Auth, error handling
│   ├── events/
│   │   ├── publishers/   # Redis Streams publishers
│   │   └── consumers/    # Redis Streams consumers
│   ├── integrations/     # External service clients
│   └── app.ts            # Fastify app setup
├── tests/
│   ├── unit/
│   ├── integration/
│   └── api/
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## Environment Variables

Every service reads configuration from environment variables. No secrets in code.

```env
# Common to all services
NODE_ENV=development|test|production
LOG_LEVEL=info
SERVICE_SECRET=<shared-secret-for-service-to-service>

# Auth Service
AUTH_DATABASE_URL=postgresql://auth_user:auth_pass@postgres:5432/auth_db
JWT_SECRET=<jwt-signing-secret>
JWT_EXPIRES_IN=8h
REDIS_URL=redis://redis:6379
MAGIC_LINK_TTL_SECONDS=86400

# Catalog Service
CATALOG_DATABASE_URL=postgresql://catalog_user:catalog_pass@postgres:5432/catalog_db
REDIS_URL=redis://redis:6379

# Quotation Service
QUOTATION_DATABASE_URL=postgresql://quot_user:quot_pass@postgres:5432/quotation_db
REDIS_URL=redis://redis:6379
CATALOG_SERVICE_URL=http://catalog-service:3002
FULFILLMENT_SERVICE_URL=http://fulfillment-service:3004

# Fulfillment Service
FULFILLMENT_DATABASE_URL=postgresql://full_user:full_pass@postgres:5432/fulfillment_db
REDIS_URL=redis://redis:6379

# Billing Service
BILLING_DATABASE_URL=postgresql://bill_user:bill_pass@postgres:5432/billing_db
REDIS_URL=redis://redis:6379

# Analytics Service
ANALYTICS_DATABASE_URL=postgresql://ana_user:ana_pass@postgres:5432/analytics_db
REDIS_URL=redis://redis:6379
QUOTATION_SERVICE_URL=http://quotation-service:3003

# Email (all services that send email)
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_FROM=noreply@dealflow360.local

# PDF / Export
EXPORT_PUPPETEER_EXECUTABLE=/usr/bin/chromium-browser

# Frontend
VITE_API_BASE_URL=http://localhost:3000/api
VITE_PORTAL_BASE_URL=http://localhost:3000/portal
```

---

## Docker Compose Overview

```yaml
# docker-compose.yml (structure summary)
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_ROOT_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-databases.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "8025:8025"  # web UI

  gateway:
    build: ./services/gateway
    ports:
      - "3000:3000"
    depends_on: [auth-service, catalog-service, quotation-service, fulfillment-service, billing-service, analytics-service]

  auth-service:
    build: ./services/auth-service
    ports: ["3001:3001"]
    depends_on: [postgres, redis]

  catalog-service:
    build: ./services/catalog-service
    ports: ["3002:3002"]
    depends_on: [postgres, redis]

  quotation-service:
    build: ./services/quotation-service
    ports: ["3003:3003"]
    depends_on: [postgres, redis, catalog-service, fulfillment-service]

  fulfillment-service:
    build: ./services/fulfillment-service
    ports: ["3004:3004"]
    depends_on: [postgres, redis]

  billing-service:
    build: ./services/billing-service
    ports: ["3005:3005"]
    depends_on: [postgres, redis]

  analytics-service:
    build: ./services/analytics-service
    ports: ["3006:3006"]
    depends_on: [postgres, redis]

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    depends_on: [gateway]
```

---

## Implementation Checkpoints — Technology Stack

**CHECK-TECH-001**
- **Covers**: REQ-NF-003
- **Precondition**: Docker Compose file written
- **Action**: `docker compose up --build` from project root
- **Expected**: All 9 containers start without error; all service health checks pass
- **Verification**: `docker compose ps` shows all services as "healthy"

**CHECK-TECH-002**
- **Covers**: REQ-IMP-003
- **Precondition**: Prisma schemas written for all services
- **Action**: `npx prisma migrate dev` in each service directory
- **Expected**: All migrations apply cleanly; no errors
- **Verification**: Automated CI step

**CHECK-TECH-003**
- **Covers**: REQ-NF-003, REQ-CON-004
- **Precondition**: Seed scripts written
- **Action**: `npm run seed` in each service
- **Expected**: Database contains demo data (products, customers, warehouses, users, sample quotations)
- **Verification**: Query DB for non-zero row counts in all core tables

**CHECK-TECH-004**
- **Covers**: REQ-IMP-001
- **Precondition**: All services running
- **Action**: Make API call that crosses 3 services; check logs
- **Expected**: Same `requestId` appears in logs of all 3 services
- **Verification**: Manual log inspection / grep test
