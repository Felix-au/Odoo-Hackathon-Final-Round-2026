# DealFlow360 — Deployment & DevOps

---

## 1. Docker Compose (Development)

The canonical local development environment. All services run in Docker Compose. No local Node/Python install required beyond initial `npm install` for IDE support.

### docker-compose.yml

```yaml
version: '3.9'

services:

  # ─── Databases ───────────────────────────────────────
  
  auth-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: auth_db
      POSTGRES_USER: dealflow
      POSTGRES_PASSWORD: dealflow_dev
    ports:
      - "5432:5432"
    volumes:
      - auth_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dealflow -d auth_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  catalog-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: catalog_db
      POSTGRES_USER: dealflow
      POSTGRES_PASSWORD: dealflow_dev
    ports:
      - "5433:5432"
    volumes:
      - catalog_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dealflow -d catalog_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  quotation-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: quotation_db
      POSTGRES_USER: dealflow
      POSTGRES_PASSWORD: dealflow_dev
    ports:
      - "5434:5432"
    volumes:
      - quotation_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dealflow -d quotation_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  fulfillment-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: fulfillment_db
      POSTGRES_USER: dealflow
      POSTGRES_PASSWORD: dealflow_dev
    ports:
      - "5435:5432"
    volumes:
      - fulfillment_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dealflow -d fulfillment_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  billing-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: billing_db
      POSTGRES_USER: dealflow
      POSTGRES_PASSWORD: dealflow_dev
    ports:
      - "5436:5432"
    volumes:
      - billing_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dealflow -d billing_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  analytics-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: analytics_db
      POSTGRES_USER: dealflow
      POSTGRES_PASSWORD: dealflow_dev
    ports:
      - "5437:5432"
    volumes:
      - analytics_db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dealflow -d analytics_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ─── Redis ───────────────────────────────────────────
  
  redis:
    image: redis:7-alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  # ─── Email (Local SMTP Trap) ──────────────────────────
  
  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"  # SMTP port (services send here)
      - "8025:8025"  # Web UI (view emails in browser)

  # ─── Services ────────────────────────────────────────

  auth-service:
    build:
      context: ./services/auth-service
      dockerfile: Dockerfile.dev
    environment:
      NODE_ENV: development
      PORT: 3001
      AUTH_DATABASE_URL: postgresql://dealflow:dealflow_dev@auth-db:5432/auth_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_jwt_secret_change_in_prod_64chars_minimum
      JWT_ACCESS_EXPIRY: 28800
      JWT_REFRESH_EXPIRY: 2592000
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
      SMTP_FROM: no-reply@dealflow360.dev
      APP_BASE_URL: http://localhost:3000
    ports:
      - "3001:3001"
    depends_on:
      auth-db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./services/auth-service/src:/app/src
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  catalog-service:
    build:
      context: ./services/catalog-service
      dockerfile: Dockerfile.dev
    environment:
      NODE_ENV: development
      PORT: 3002
      CATALOG_DATABASE_URL: postgresql://dealflow:dealflow_dev@catalog-db:5432/catalog_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_jwt_secret_change_in_prod_64chars_minimum
    ports:
      - "3002:3002"
    depends_on:
      catalog-db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./services/catalog-service/src:/app/src
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3002/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  quotation-service:
    build:
      context: ./services/quotation-service
      dockerfile: Dockerfile.dev
    environment:
      NODE_ENV: development
      PORT: 3003
      QUOTATION_DATABASE_URL: postgresql://dealflow:dealflow_dev@quotation-db:5432/quotation_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_jwt_secret_change_in_prod_64chars_minimum
      CATALOG_SERVICE_URL: http://catalog-service:3002
      SERVICE_TOKEN: dev_service_token_for_internal_calls
    ports:
      - "3003:3003"
    depends_on:
      quotation-db:
        condition: service_healthy
      redis:
        condition: service_healthy
      catalog-service:
        condition: service_healthy
    volumes:
      - ./services/quotation-service/src:/app/src
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3003/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  fulfillment-service:
    build:
      context: ./services/fulfillment-service
      dockerfile: Dockerfile.dev
    environment:
      NODE_ENV: development
      PORT: 3004
      FULFILLMENT_DATABASE_URL: postgresql://dealflow:dealflow_dev@fulfillment-db:5432/fulfillment_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_jwt_secret_change_in_prod_64chars_minimum
      CATALOG_SERVICE_URL: http://catalog-service:3002
      SERVICE_TOKEN: dev_service_token_for_internal_calls
    ports:
      - "3004:3004"
    depends_on:
      fulfillment-db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./services/fulfillment-service/src:/app/src
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3004/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  billing-service:
    build:
      context: ./services/billing-service
      dockerfile: Dockerfile.dev
    environment:
      NODE_ENV: development
      PORT: 3005
      BILLING_DATABASE_URL: postgresql://dealflow:dealflow_dev@billing-db:5432/billing_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_jwt_secret_change_in_prod_64chars_minimum
    ports:
      - "3005:3005"
    depends_on:
      billing-db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./services/billing-service/src:/app/src
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3005/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  analytics-service:
    build:
      context: ./services/analytics-service
      dockerfile: Dockerfile.dev
    environment:
      NODE_ENV: development
      PORT: 3006
      ANALYTICS_DATABASE_URL: postgresql://dealflow:dealflow_dev@analytics-db:5432/analytics_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev_jwt_secret_change_in_prod_64chars_minimum
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
    ports:
      - "3006:3006"
    depends_on:
      analytics-db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./services/analytics-service/src:/app/src
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3006/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── API Gateway / BFF ───────────────────────────────
  
  gateway:
    build:
      context: ./services/gateway
      dockerfile: Dockerfile.dev
    environment:
      NODE_ENV: development
      PORT: 3000
      AUTH_SERVICE_URL: http://auth-service:3001
      CATALOG_SERVICE_URL: http://catalog-service:3002
      QUOTATION_SERVICE_URL: http://quotation-service:3003
      FULFILLMENT_SERVICE_URL: http://fulfillment-service:3004
      BILLING_SERVICE_URL: http://billing-service:3005
      ANALYTICS_SERVICE_URL: http://analytics-service:3006
      JWT_SECRET: dev_jwt_secret_change_in_prod_64chars_minimum
    ports:
      - "3000:3000"
    depends_on:
      auth-service:
        condition: service_healthy
      catalog-service:
        condition: service_healthy
      quotation-service:
        condition: service_healthy
      fulfillment-service:
        condition: service_healthy
      billing-service:
        condition: service_healthy
      analytics-service:
        condition: service_healthy
    volumes:
      - ./services/gateway/src:/app/src
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── Frontend ─────────────────────────────────────────
  
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    environment:
      VITE_API_BASE_URL: http://localhost:3000/api/v1
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src
    depends_on:
      gateway:
        condition: service_healthy

volumes:
  auth_db_data:
  catalog_db_data:
  quotation_db_data:
  fulfillment_db_data:
  billing_db_data:
  analytics_db_data:
  redis_data:
```

---

## 2. Dockerfile Template (All Services)

```dockerfile
# Dockerfile.dev — Development with hot reload
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma client before app starts
RUN npx prisma generate

COPY . .

# Run migrations + seed + start with tsx watch
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/seed.ts && npm run dev"]
```

```dockerfile
# Dockerfile — Production
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3001
CMD ["node", "dist/app.js"]
```

---

## 3. Service /health Endpoint

Every service **must** implement a `/health` endpoint:

```typescript
// app.ts — all services
app.get('/health', async (request, reply) => {
  // Check DB connection
  await prisma.$queryRaw`SELECT 1`;
  // Check Redis connection
  await redis.ping();
  
  reply.code(200).send({
    status: 'healthy',
    service: 'auth-service',
    version: process.env.npm_package_version,
    timestamp: new Date().toISOString(),
  });
});

// If DB or Redis unreachable → throw → Fastify returns 500
// Docker depends_on healthcheck uses this endpoint
```

---

## 4. API Gateway (BFF)

The gateway runs at port 3000 and acts as the **single entry point** for the frontend.

### Responsibilities
- Route `/api/v1/auth/*` → Auth Service
- Route `/api/v1/catalog/*` → Catalog Service
- Route `/api/v1/quotations/*` → Quotation Service
- Route `/api/v1/fulfillment/*` → Fulfillment Service
- Route `/api/v1/billing/*` → Billing Service
- Route `/api/v1/analytics/*` → Analytics Service
- Route `/portal/v1/*` → Auth + Quotation Services
- JWT validation (extract and forward `X-User-*` headers)
- Portal session validation (forward `X-Customer-*` headers)
- Global rate limiting
- Request logging (with X-Request-ID)
- CORS configuration (allow `http://localhost:5173` in dev)

```typescript
// gateway/src/app.ts — simplified routing

import fastifyHttpProxy from '@fastify/http-proxy';

// Internal API routes — validate JWT, then proxy
app.register(fastifyHttpProxy, {
  upstream: process.env.QUOTATION_SERVICE_URL,
  prefix: '/api/v1/quotations',
  preHandler: [validateJwtMiddleware, injectUserHeaders],
});

// Portal routes — validate portal session, then proxy
app.register(fastifyHttpProxy, {
  upstream: process.env.QUOTATION_SERVICE_URL,
  prefix: '/portal/v1/quotations',
  preHandler: [validatePortalSessionMiddleware, injectCustomerHeaders],
});

// Auth routes — no pre-validation (auth service handles it)
app.register(fastifyHttpProxy, {
  upstream: process.env.AUTH_SERVICE_URL,
  prefix: '/api/v1/auth',
});
app.register(fastifyHttpProxy, {
  upstream: process.env.AUTH_SERVICE_URL,
  prefix: '/portal/v1/auth',
});
```

---

## 5. Environment Configuration

Each service uses **Zod** to validate environment variables at startup:

```typescript
// config/env.ts — example for quotation-service
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3003),
  QUOTATION_DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  CATALOG_SERVICE_URL: z.string().url(),
  SERVICE_TOKEN: z.string().min(16),
});

export const env = envSchema.parse(process.env);
// If any variable missing/invalid → throws at startup → visible in Docker logs
```

**.env.example** (checked into repo, `.env` is gitignored):
```env
NODE_ENV=development
AUTH_DATABASE_URL=postgresql://dealflow:dealflow_dev@localhost:5432/auth_db
CATALOG_DATABASE_URL=postgresql://dealflow:dealflow_dev@localhost:5433/catalog_db
QUOTATION_DATABASE_URL=postgresql://dealflow:dealflow_dev@localhost:5434/quotation_db
FULFILLMENT_DATABASE_URL=postgresql://dealflow:dealflow_dev@localhost:5435/fulfillment_db
BILLING_DATABASE_URL=postgresql://dealflow:dealflow_dev@localhost:5436/billing_db
ANALYTICS_DATABASE_URL=postgresql://dealflow:dealflow_dev@localhost:5437/analytics_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev_jwt_secret_change_in_prod_must_be_64_chars_minimum_dev_only
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=no-reply@dealflow360.dev
APP_BASE_URL=http://localhost:3000
SERVICE_TOKEN=dev_service_token_for_internal_calls
```

---

## 6. Development Workflow

### Start Everything
```bash
# From project root
docker compose up -d

# Wait for health checks (auto-run migrations + seed)
docker compose ps   # all should show "healthy"

# Frontend dev server (if not in Docker)
cd frontend && npm install && npm run dev
```

### View Logs
```bash
docker compose logs -f quotation-service  # watch specific service
docker compose logs -f                    # all services
```

### View Emails (Magic Links, Nudges)
```
http://localhost:8025   # Mailpit Web UI
```

### Run Database Migrations (in dev)
```bash
docker compose exec quotation-service sh -c "npx prisma migrate dev --name <name>"
```

### Access Service Swagger Docs
```
http://localhost:3001/docs  # Auth
http://localhost:3002/docs  # Catalog
http://localhost:3003/docs  # Quotation
http://localhost:3004/docs  # Fulfillment
http://localhost:3005/docs  # Billing
http://localhost:3006/docs  # Analytics
```

### Reset All Data
```bash
docker compose down -v   # -v removes volumes (drops all DB data)
docker compose up -d     # restarts fresh with new seed data
```

---

## 7. Hackathon Demo Checklist

Before demo, verify:

- [ ] `docker compose ps` shows all 12+ containers as `healthy`
- [ ] `http://localhost:5173` loads the app (internal login page)
- [ ] Login with `admin@dealflow360.com / AdminP@ss123`
- [ ] Dashboard shows KPIs and at least 1 deal health alert
- [ ] Create a new quotation: add laptop (12%) + service (18%) → risk score > 0 → red indicator
- [ ] Submit → routed to approval
- [ ] Login as Manager → approve
- [ ] Send to customer → copy portal link
- [ ] Open incognito → portal login → magic link (check Mailpit) → quotation view
- [ ] Customer negotiates → back in workspace see negotiation
- [ ] Customer confirms → status = CONFIRMED
- [ ] Billing page shows invoice + subscription line
- [ ] Reports page → export PDF (download works)
- [ ] Analytics deal health: stalled deal visible; click → navigates to quotation
- [ ] Fulfillment page: split recommendation shown
