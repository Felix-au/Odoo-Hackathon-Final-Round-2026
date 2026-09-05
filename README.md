# DealFlow360

> Intelligent, Self-Governing Sales Operations Platform — Odoo Hackathon Final Round 2026

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start everything (databases, Redis, Mailpit, all services, frontend)
docker compose up -d

# 3. Wait for all services to become healthy (~60 seconds first run)
docker compose ps

# 4. Open the app
open http://localhost:5173        # Internal workspace
open http://localhost:8025        # Mailpit (email catcher for magic links)
```

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@dealflow360.com | AdminP@ss123 |
| Sales Manager | manager@dealflow360.com | ManagerP@ss123 |
| Finance | finance@dealflow360.com | FinanceP@ss123 |
| Sales Rep | rep1@dealflow360.com | RepP@ss123 |

Portal: Use magic link (check Mailpit at http://localhost:8025)

## Architecture

6 microservices + API Gateway + React SPA:

| Service | Port | Responsibility |
|---------|------|----------------|
| Gateway (BFF) | 3000 | JWT validation, routing, CORS |
| Auth | 3001 | Identity, JWT, magic links, portal sessions |
| Catalog | 3002 | Products, price lists, discount tiers, approval chains |
| Quotation | 3003 | Quote lifecycle, risk scoring, approval routing |
| Fulfillment | 3004 | Warehouse stock, split algorithm, backorders |
| Billing | 3005 | Invoices, subscriptions, proration, credit notes |
| Analytics | 3006 | Deal health, reports, PDF/XLS export |
| Frontend | 5173 | React SPA (internal workspace + customer portal) |

## Development

```bash
# View logs for a service
docker compose logs -f auth-service

# Run migrations manually in a service
docker compose exec auth-service sh -c "npx prisma migrate dev --name <name>"

# Reset all data (drop volumes)
docker compose down -v && docker compose up -d

# Access service Swagger docs
http://localhost:3001/docs   # Auth
http://localhost:3002/docs   # Catalog
http://localhost:3003/docs   # Quotation
http://localhost:3004/docs   # Fulfillment
http://localhost:3005/docs   # Billing
http://localhost:3006/docs   # Analytics

# Run tests for a service
docker compose exec auth-service npm test
```

## Tech Stack

- **Backend**: Node.js 20 + TypeScript 5 + Fastify 4 + Prisma 5 + PostgreSQL 16
- **Cache/Events**: Redis 7 (cache + Redis Streams for events)
- **Frontend**: React 18 + Vite 5 + TanStack Query + Zustand + Tailwind CSS
- **Testing**: Vitest + Playwright
- **Containerization**: Docker Compose
