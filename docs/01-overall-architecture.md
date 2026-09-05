# DealFlow360 — Overall Architecture

---

## 1. System Purpose

DealFlow360 is an **Intelligent, Self-Governing Sales Operations Platform** for B2B sales teams. It handles the complete quotation-to-cash lifecycle:

- Multi-tier discount governance with automated approval routing
- Live upsell/cross-sell recommendations with real-time margin impact
- Multi-warehouse fulfillment splitting and backorder handling
- Hybrid billing (one-time products mixed with recurring subscriptions)
- Deal health monitoring and anomaly alerting
- Customer-facing portal negotiation on live quotations
- Sales backend configuration and reporting dashboards

---

## 2. System Context

```mermaid
C4Context
    title DealFlow360 — System Context

    Person(rep, "Sales Rep", "Builds quotations, applies discounts, tracks approvals")
    Person(manager, "Sales Manager", "Approves quotations, monitors deal health")
    Person(finance, "Finance User", "Second-level approvals, billing reconciliation")
    Person(admin, "Admin", "Backend configuration, analytics")
    Person(customer, "Customer", "Views quotation, negotiates via portal")

    System(df360, "DealFlow360", "Sales Operations Platform — quotation to cash")

    System_Ext(email, "Email Service", "SMTP / SendGrid — magic links, notifications")
    System_Ext(pdf_gen, "PDF Library", "Quotation & report PDF generation")
    System_Ext(xls_gen, "XLS Library", "Report Excel generation")

    Rel(rep, df360, "Builds/manages quotations")
    Rel(manager, df360, "Approves quotations, monitors dashboard")
    Rel(finance, df360, "Second-level approvals, billing")
    Rel(admin, df360, "Configures backend")
    Rel(customer, df360, "Negotiates via portal")
    Rel(df360, email, "Sends emails")
    Rel(df360, pdf_gen, "Generates PDFs")
    Rel(df360, xls_gen, "Generates XLS")
```

---

## 3. Actors

| Actor | Type | Authentication |
|-------|------|---------------|
| Sales Rep | Internal | JWT (email + password) |
| Sales Manager | Internal | JWT (email + password) |
| Finance User | Internal | JWT (email + password) |
| Admin | Internal | JWT (email + password) |
| Customer | External | Magic Link OR email + password → session token |

---

## 4. Bounded Contexts & Microservices

The system is decomposed into **6 microservices** based on meaningful bounded contexts. No service is created arbitrarily.

```mermaid
graph TB
    GW[API Gateway / BFF<br/>port 3000] --> AUTH[Auth Service<br/>port 3001]
    GW --> CATALOG[Catalog Service<br/>port 3002]
    GW --> QUOTATION[Quotation Service<br/>port 3003]
    GW --> FULFILLMENT[Fulfillment Service<br/>port 3004]
    GW --> BILLING[Billing Service<br/>port 3005]
    GW --> ANALYTICS[Analytics & Reporting<br/>port 3006]

    QUOTATION -->|events| MQ[(Message Broker<br/>Redis Streams)]
    BILLING -->|events| MQ
    FULFILLMENT -->|events| MQ
    MQ --> QUOTATION
    MQ --> BILLING
    MQ --> FULFILLMENT
    MQ --> ANALYTICS

    AUTH --- DB_AUTH[(auth_db<br/>PostgreSQL)]
    CATALOG --- DB_CAT[(catalog_db<br/>PostgreSQL)]
    QUOTATION --- DB_QUOT[(quotation_db<br/>PostgreSQL)]
    FULFILLMENT --- DB_FULL[(fulfillment_db<br/>PostgreSQL)]
    BILLING --- DB_BILL[(billing_db<br/>PostgreSQL)]
    ANALYTICS --- DB_ANA[(analytics_db<br/>PostgreSQL)]

    CACHE[(Redis Cache)] --> QUOTATION
    CACHE --> CATALOG
    CACHE --> ANALYTICS
```

### Why Each Service Exists

| Service | Reason for Existence |
|---------|---------------------|
| **Auth Service** | Security boundary — authentication logic must be isolated and independently deployable. Owns identity data. |
| **Catalog Service** | Independent business responsibility — products, price lists, discount tiers, upsell rules, and subscription plan configuration are backend admin concerns, not tied to the quotation lifecycle. |
| **Quotation Service** | Core domain — the quotation lifecycle (creation, approval routing, blended risk scoring, customer negotiation) is the largest bounded context. Owns quotation state machine. |
| **Fulfillment Service** | Separate data ownership — warehouse stock, splits, and backorders are physically independent of quoting. Requires independent scaling during high-volume periods. |
| **Billing Service** | Separate business responsibility — recurring billing, proration, invoicing, and credit notes are a distinct financial domain with independent compliance requirements. |
| **Analytics & Reporting** | Computational isolation — report aggregation, export generation, and deal health computation are read-heavy, potentially slow queries that must not block transactional services. |

---

## 5. Service Responsibilities Summary

### 5.1 Auth Service
- **Owns**: User accounts, sessions, magic link tokens
- **Does NOT own**: Business roles beyond authentication, quotation data
- **Scales**: Horizontally — stateless JWT validation

### 5.2 Catalog Service
- **Owns**: Products, variants, price lists, discount tiers, approval chain config, subscription plan definitions, upsell/cross-sell rules, warehouse configuration
- **Does NOT own**: Quotation state, stock levels (stock is in Fulfillment)
- **Scales**: Low traffic — admin configuration only

### 5.3 Quotation Service
- **Owns**: Quotations, quotation lines, approval logs, customer negotiation history
- **Does NOT own**: Product catalog data (reads from Catalog), warehouse stock (reads from Fulfillment), billing schedules (delegates to Billing)
- **Scales**: Horizontally — most write-intensive service

### 5.4 Fulfillment Service
- **Owns**: Warehouse stock levels, fulfillment splits, backorders
- **Does NOT own**: Quotation state, billing
- **Scales**: Horizontally — event-driven updates

### 5.5 Billing Service
- **Owns**: Invoices, subscription lines, billing schedules, credit notes, payment records
- **Does NOT own**: Quotation content, stock
- **Scales**: Horizontally — recurring billing jobs

### 5.6 Analytics & Reporting Service
- **Owns**: Pre-aggregated report views, deal health snapshots, export generation
- **Does NOT own**: Source-of-truth data (reads from other services via events or read replicas)
- **Scales**: Independently for reporting workloads

---

## 6. Frontend Architecture

The frontend is a **React SPA** (Single Page Application) composed of two distinct runtime contexts:

| Context | URL Prefix | Audience | Auth |
|---------|-----------|----------|------|
| **Internal Workspace** | `/app/*` | Sales Rep, Manager, Finance, Admin | JWT cookie/header |
| **Customer Portal** | `/portal/*` | Customer (Portal User) | Session token / magic link |

These are **not the same app with different labels** — they have separate routing trees, separate authentication flows, separate API clients, and the portal has no knowledge of internal workspace routes.

---

## 7. Major Synchronous Flows

### 7.1 Quotation Creation & Discount Risk Computation

```mermaid
sequenceDiagram
    participant R as Sales Rep Browser
    participant GW as API Gateway
    participant QS as Quotation Service
    participant CS as Catalog Service
    participant CACHE as Redis

    R->>GW: POST /api/quotations (create)
    GW->>QS: forward
    QS->>QS: create quotation draft
    QS-->>R: 201 quotation

    R->>GW: PUT /api/quotations/:id/lines (add line + discount)
    GW->>QS: forward
    QS->>CACHE: get discount ceilings (from Catalog, cached)
    CACHE-->>QS: ceilings data
    QS->>QS: compute blended risk score
    QS-->>R: 200 updated quotation with risk_score + margin
```

### 7.2 Approval Routing

```mermaid
sequenceDiagram
    participant R as Sales Rep
    participant GW as API Gateway
    participant QS as Quotation Service
    participant CS as Catalog Service
    participant EMAIL as Email Service

    R->>GW: POST /api/quotations/:id/submit
    GW->>QS: forward
    QS->>CS: GET /approval-chains (get routing config)
    CS-->>QS: chain definition
    QS->>QS: determine required approvers from risk score
    QS->>QS: set status = PENDING_APPROVAL, log audit entry
    QS->>EMAIL: send approval request to Sales Manager
    QS-->>R: 200 {status: PENDING_APPROVAL, required_approvers: [...]}

    Note over QS: Manager approves
    GW->>QS: POST /api/quotations/:id/approve (Manager JWT)
    QS->>QS: log approval, check if Finance needed
    alt Finance required
        QS->>EMAIL: send to Finance
        QS-->>GW: 200 {status: PENDING_FINANCE_APPROVAL}
    else No Finance needed
        QS->>QS: status = APPROVED
        QS->>MQ: publish quotation.approved event
        QS-->>GW: 200 {status: APPROVED}
    end
```

### 7.3 Warehouse Split

```mermaid
sequenceDiagram
    participant R as Sales Rep
    participant GW as API Gateway
    participant QS as Quotation Service
    participant FS as Fulfillment Service

    R->>GW: GET /api/quotations/:id/fulfillment-split
    GW->>FS: GET /fulfillment/split-recommendation?order_id=:id
    FS->>FS: load stock per warehouse
    FS->>FS: run split algorithm (minimize shipments + cost weighting)
    FS-->>GW: 200 split recommendation
    GW-->>R: split recommendation

    R->>GW: POST /api/quotations/:id/fulfillment-split/accept
    GW->>FS: POST /fulfillment/splits (create fulfillment records)
    FS->>FS: reserve stock
    FS-->>GW: 201 created
```

### 7.4 Customer Portal Negotiation

```mermaid
sequenceDiagram
    participant C as Customer Browser
    participant GW as API Gateway
    participant QS as Quotation Service
    participant EMAIL as Email Service

    C->>GW: POST /portal/auth/magic-link (request link)
    GW->>AUTH: generate magic link token
    AUTH->>EMAIL: send link
    AUTH-->>GW: 202 accepted

    C->>GW: GET /portal/auth/verify?token=xxx
    GW->>AUTH: verify token (single use)
    AUTH-->>GW: 200 session token
    GW-->>C: session cookie

    C->>GW: GET /portal/quotations/:id
    GW->>QS: GET (portal auth validated — customer owns quotation)
    QS-->>C: quotation details

    C->>GW: POST /portal/quotations/:id/negotiate
    GW->>QS: create negotiation entry
    QS->>QS: apply proposed discount
    QS->>QS: recompute blended risk score
    alt Risk exceeds threshold
        QS->>QS: status = PENDING_APPROVAL
        QS->>EMAIL: notify rep + manager
    else Within threshold
        QS->>QS: status = UNDER_NEGOTIATION
    end
    QS-->>C: 200 updated quotation
```

---

## 8. Major Asynchronous Flows

### Events via Redis Streams

| Event | Producer | Consumers | Purpose |
|-------|----------|-----------|---------|
| `quotation.approved` | Quotation | Fulfillment, Billing | Trigger split + invoice generation |
| `quotation.confirmed` | Quotation | Billing, Analytics | Trigger final invoice, update report data |
| `fulfillment.stock_arrived` | Fulfillment | Quotation | Trigger "Consolidate Backorder" prompt |
| `fulfillment.shipment_delayed` | Fulfillment | Analytics | Trigger delivery slippage alert |
| `billing.invoice_created` | Billing | Analytics | Update MRR/reporting |
| `billing.subscription_renewed` | Billing | Analytics | Update recurring revenue data |

---

## 9. API Gateway

- **Technology**: Nginx reverse proxy + custom BFF layer (Node.js/Express)
- **Responsibilities**: 
  - Route `/api/*` to internal services
  - Route `/portal/*` to portal-specific endpoints in Quotation and Auth services
  - JWT validation at gateway level (avoids repetition in each service)
  - Rate limiting (auth endpoints: 10 req/min; API: 100 req/min)
  - Request ID injection for tracing

---

## 10. Authentication & Authorization Summary

| Mechanism | Used By | Details |
|-----------|---------|---------|
| JWT Bearer Token | Internal users | HS256, 8-hour expiry, refresh tokens |
| Session Token (httpOnly cookie) | Customer portal | Opaque token, 7-day TTL, stored in Redis |
| Magic Link | Customer portal | UUID token, single-use, 24-hour TTL |
| Service-to-Service | Internal services | Shared secret header `X-Service-Token` |

**Authorization model**: Role-based with resource-ownership checks.

| Role | Quotation access | Approval access | Catalog config | Fulfillment | Billing | Reports |
|------|-----------------|-----------------|----------------|-------------|---------|---------|
| Admin | All | All | Full | View | View | Full |
| Sales Manager | Team's | Approve/Reject | View | View | View | Team |
| Finance | All | Approve/Reject (2nd level) | View | All | Full | Full |
| Sales Rep | Own | Submit | View | View | View | Own |
| Customer (Portal) | Own only | None | None | None | None | None |

---

## 11. Database Strategy

Each service owns its own PostgreSQL database. **No shared database**.

| Service | Database | Rationale |
|---------|----------|-----------|
| Auth | `auth_db` | Identity data must be isolated |
| Catalog | `catalog_db` | Product/config data, low churn |
| Quotation | `quotation_db` | High-write transactional core |
| Fulfillment | `fulfillment_db` | Stock and split data, separate domain |
| Billing | `billing_db` | Financial records, compliance isolation |
| Analytics | `analytics_db` | Read-optimized projections |

**Cross-service data needs** are satisfied via:
1. Synchronous API calls for real-time data (e.g. Quotation reads stock availability from Fulfillment)
2. Asynchronous events for eventual consistency (e.g. Analytics subscribes to quotation events)
3. Cached lookups for frequently-read catalog data (discount ceilings, product prices)

---

## 12. Caching Strategy

| Cache | Technology | TTL | Content |
|-------|-----------|-----|---------|
| Discount ceilings | Redis | 5 min | Per-tier + per-category ceilings |
| Product catalog | Redis | 10 min | Product list, prices |
| Upsell rules | Redis | 15 min | Suggestion rules |
| Portal session tokens | Redis | 7 days | Customer session |
| Magic link tokens | Redis | 24 hours | One-time portal access |
| Analytics snapshots | Redis | 1 min | Dashboard data |

---

## 13. Deployment Topology

```mermaid
graph TB
    subgraph "Internet"
        BROWSER[User Browser]
        MOBILE[Customer Mobile]
    end

    subgraph "DMZ / Edge"
        NGINX[Nginx<br/>TLS termination<br/>+ Rate Limiting]
    end

    subgraph "Application Layer (Docker Compose)"
        GW[API Gateway / BFF<br/>:3000]
        AUTH[Auth Service<br/>:3001]
        CATALOG[Catalog Service<br/>:3002]
        QUOTATION[Quotation Service<br/>:3003]
        FULFILLMENT[Fulfillment Service<br/>:3004]
        BILLING[Billing Service<br/>:3005]
        ANALYTICS[Analytics Service<br/>:3006]
        FRONTEND[React Frontend<br/>:5173 / served by Nginx]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>6 databases)]
        REDIS[(Redis<br/>cache + streams)]
    end

    BROWSER --> NGINX
    MOBILE --> NGINX
    NGINX --> FRONTEND
    NGINX --> GW
    GW --> AUTH
    GW --> CATALOG
    GW --> QUOTATION
    GW --> FULFILLMENT
    GW --> BILLING
    GW --> ANALYTICS
    AUTH --> PG
    CATALOG --> PG
    QUOTATION --> PG
    FULFILLMENT --> PG
    BILLING --> PG
    ANALYTICS --> PG
    AUTH --> REDIS
    QUOTATION --> REDIS
    CATALOG --> REDIS
    ANALYTICS --> REDIS
    QUOTATION --> REDIS
    BILLING --> REDIS
    FULFILLMENT --> REDIS
```

**Deployment**: Docker Compose for hackathon (single `docker-compose.yml`). Production path: Kubernetes.

---

## 14. Network & Trust Boundaries

| Boundary | Description |
|----------|-------------|
| **Internet → Nginx** | Public internet, TLS enforced |
| **Nginx → Frontend** | Static file serving |
| **Nginx → Gateway** | Reverse proxy, only gateway exposed |
| **Gateway → Services** | Internal Docker network, not externally accessible |
| **Services → Databases** | Internal network, credentials via env vars |
| **Services → Redis** | Internal network |
| **Services → Email** | Outbound SMTP/HTTPS only |

---

## 15. Failure Modes & Resilience

| Failure | Mitigation |
|---------|-----------|
| Auth Service down | Gateway returns 503; no other service is affected |
| Catalog Service down | Quotation Service uses cached discount ceilings (5-min TTL) |
| Fulfillment Service down | Quotation can be approved; split calculation deferred; user sees degraded message |
| Billing Service down | Event queued in Redis Streams; processed when recovered |
| Analytics Service down | Dashboard shows stale data with last-update timestamp |
| Redis down | Services fall back to direct DB reads; performance degrades but correctness maintained |
| Message lost | Redis Streams with consumer groups + dead-letter handling |

---

## 16. Implementation Checkpoints — Architecture

**CHECK-ARCH-001**
- **Covers**: REQ-NF-008, REQ-SEC-002
- **Precondition**: All services deployed
- **Action**: Customer portal user (session token) attempts to call `/api/quotations` (internal endpoint)
- **Expected**: 401 or 403 response — portal session token rejected by internal auth
- **Verification**: Automated security test

**CHECK-ARCH-002**
- **Covers**: REQ-IMP-002
- **Precondition**: All services running
- **Action**: GET `/health` on each service port (3001–3006)
- **Expected**: HTTP 200 with `{status: "ok"}` from each
- **Verification**: Docker Compose healthcheck + automated test

**CHECK-ARCH-003**
- **Covers**: REQ-NF-007
- **Precondition**: System fully running with seed data
- **Action**: Run 20 concurrent quotation create requests
- **Expected**: All return 201 within 3s; no data corruption
- **Verification**: Load test script (k6 or Artillery)

**CHECK-ARCH-004**
- **Covers**: REQ-F-160, REQ-CON-005
- **Precondition**: System deployed with seed data
- **Action**: Execute complete end-to-end flow: create quotation → add lines → submit → approve → split → confirm → record payment
- **Expected**: Each step transitions to correct state; final invoice status is PAID
- **Verification**: Automated e2e test (Playwright)
