# DealFlow360 — Catalog Service

---

## 1. Purpose

The Catalog Service is the **backend configuration authority** for DealFlow360. It owns all master data that the rest of the system reads to make decisions: products, price lists, discount tiers, approval chain configuration, warehouse definitions, subscription plan definitions, and upsell/cross-sell rules.

It exists as a separate service because:
- **Independent business responsibility**: Backend configuration is an Admin concern entirely separate from the sales workflow
- **Read-heavy with caching**: Other services frequently read catalog data; isolating it allows aggressive caching without polluting quotation write paths
- **Schema independence**: Catalog schema evolves separately from quotation or billing schemas

---

## 2. Responsibilities

- Product CRUD (with variants)
- Product Category management
- Price list CRUD (tier-based + currency-specific)
- Discount tier configuration (per-tier ceiling, per-category ceiling)
- Approval chain configuration (risk score → required approvers)
- Warehouse definition (name, shipping cost weight)
- Subscription plan definitions (intervals, proration rules, cancellation rules)
- Upsell/cross-sell rule management (product pairings, promotions, margin thresholds)
- Serving cached configuration to other services

---

## 3. Non-Responsibilities

- Stock levels (owned by Fulfillment Service)
- Quotation state (owned by Quotation Service)
- Subscription line state (owned by Billing Service)
- User management (owned by Auth Service)

---

## 4. Requirements Implemented

| Requirement | Description |
|------------|-------------|
| REQ-F-010 | Product CRUD with all attributes |
| REQ-F-011 | Product variants (attribute, value, extra price) |
| REQ-F-012 | Price lists by customer tier |
| REQ-F-013 | Currency-specific price list rules |
| REQ-F-020 | Discount ceilings per customer tier |
| REQ-F-021 | Category-specific discount ceilings |
| REQ-F-022 | Approval chain: Sales Manager range |
| REQ-F-023 | Approval chain: Finance range |
| REQ-F-030 | Warehouse CRUD |
| REQ-F-031 | Stock level initial config (actual levels in Fulfillment) |
| REQ-F-033 | Shipping cost weighting per warehouse |
| REQ-F-040 | Recurring plan definitions |
| REQ-F-041 | Plans attached to products |
| REQ-F-042 | Proration rules |
| REQ-F-043 | Cancellation rules |
| REQ-F-044 | Partial refund rules |
| REQ-F-050 | Upsell/cross-sell product pairings |
| REQ-F-051 | Promoted products flag |
| REQ-F-052 | Minimum margin threshold on suggestions |
| REQ-BONUS-001 | Multi-currency price list support |
| REQ-BONUS-002 | Multi-company: company_id on all entities |

---

## 5. Internal Module Structure

```
catalog-service/src/
├── config/env.ts
├── db/
│   ├── prisma/schema.prisma
│   └── repositories/
│       ├── product.repository.ts
│       ├── category.repository.ts
│       ├── price-list.repository.ts
│       ├── discount-tier.repository.ts
│       ├── approval-chain.repository.ts
│       ├── warehouse.repository.ts
│       ├── subscription-plan.repository.ts
│       └── upsell-rule.repository.ts
├── domain/services/
│   ├── product.service.ts
│   ├── price-list.service.ts
│   ├── discount-tier.service.ts
│   ├── approval-chain.service.ts
│   ├── warehouse.service.ts
│   ├── subscription-plan.service.ts
│   └── upsell-rule.service.ts
├── api/routes/
│   ├── products.routes.ts
│   ├── categories.routes.ts
│   ├── price-lists.routes.ts
│   ├── discount-tiers.routes.ts
│   ├── approval-chains.routes.ts
│   ├── warehouses.routes.ts
│   ├── subscription-plans.routes.ts
│   └── upsell-rules.routes.ts
├── cache/
│   └── catalog-cache.ts    # Redis cache wrapper
└── app.ts
```

---

## 6. Database Schema

```prisma
// catalog-service/src/db/prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("CATALOG_DATABASE_URL")
}

enum CustomerTier {
  BRONZE
  SILVER
  GOLD
}

enum BillingInterval {
  MONTHLY
  QUARTERLY
  YEARLY
}

enum ProrationMode {
  DAILY
  NONE
}

// ─────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────

model ProductCategory {
  id                  String    @id @default(uuid())
  companyId           String    @default("default")
  name                String
  discountCeilingPct  Float     @default(0)   // category-level discount ceiling
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  products Product[]

  @@unique([companyId, name])
  @@index([companyId])
}

model Product {
  id          String          @id @default(uuid())
  companyId   String          @default("default")
  name        String
  categoryId  String
  basePrice   Decimal         @db.Decimal(12, 4)
  unit        String          @default("unit")
  taxRate     Float           @default(0)      // percentage e.g. 18.0
  description String?
  costPrice   Decimal         @db.Decimal(12, 4) @default(0)  // for margin calculations
  isActive    Boolean         @default(true)
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  category    ProductCategory @relation(fields: [categoryId], references: [id])
  variants    ProductVariant[]
  planLinks   ProductPlanLink[]
  upsellFrom  UpsellRule[]    @relation("TriggerProduct")
  upsellTo    UpsellRule[]    @relation("SuggestedProduct")

  @@index([companyId])
  @@index([categoryId])
}

model ProductVariant {
  id          String   @id @default(uuid())
  productId   String
  attribute   String   // e.g. "Size", "Pack"
  value       String   // e.g. "Large", "10-pack"
  extraPrice  Decimal  @db.Decimal(12, 4) @default(0)
  isActive    Boolean  @default(true)

  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
}

// ─────────────────────────────────────────────
// Price Lists
// ─────────────────────────────────────────────

model PriceList {
  id           String       @id @default(uuid())
  companyId    String       @default("default")
  name         String
  customerTier CustomerTier
  currency     String       @default("USD")   // ISO 4217
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  rules        PriceListRule[]

  @@index([companyId, customerTier])
}

model PriceListRule {
  id          String    @id @default(uuid())
  priceListId String
  productId   String
  fixedPrice  Decimal?  @db.Decimal(12, 4)  // override base price
  discountPct Float?    // percentage discount from base price
  minQty      Int       @default(1)

  priceList   PriceList @relation(fields: [priceListId], references: [id], onDelete: Cascade)

  @@index([priceListId, productId])
}

// ─────────────────────────────────────────────
// Discount Tiers & Approval Chains
// ─────────────────────────────────────────────

model DiscountTier {
  id              String       @id @default(uuid())
  companyId       String       @default("default")
  customerTier    CustomerTier
  categoryId      String?      // null = applies to all categories
  ceilingPct      Float        // maximum allowed discount percentage
  createdAt       DateTime     @default(now())

  @@index([companyId, customerTier])
}

model ApprovalChain {
  id             String   @id @default(uuid())
  companyId      String   @default("default")
  name           String
  minRiskScore   Float    // inclusive lower bound (e.g. 0)
  maxRiskScore   Float    // exclusive upper bound (e.g. 100, null = infinity)
  requiredRoles  String[] // ordered array: ["SALES_MANAGER"] or ["SALES_MANAGER", "FINANCE"]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([companyId])
}

// ─────────────────────────────────────────────
// Warehouses (definitions — stock in Fulfillment)
// ─────────────────────────────────────────────

model WarehouseDefinition {
  id                 String   @id @default(uuid())
  companyId          String   @default("default")
  name               String
  location           String?
  shippingCostWeight Float    @default(1.0)  // relative weight for split algorithm
  isActive           Boolean  @default(true)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([companyId])
}

// ─────────────────────────────────────────────
// Subscription Plans
// ─────────────────────────────────────────────

model SubscriptionPlan {
  id                  String           @id @default(uuid())
  companyId           String           @default("default")
  name                String
  interval            BillingInterval
  basePrice           Decimal          @db.Decimal(12, 4)
  currency            String           @default("USD")
  prorationMode       ProrationMode    @default(DAILY)
  cancellationPolicy  String           @default("end_of_period")  // end_of_period | immediate
  partialRefundPct    Float            @default(0)   // % of remaining period refunded on cancel
  isActive            Boolean          @default(true)
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt

  productLinks ProductPlanLink[]

  @@index([companyId])
}

model ProductPlanLink {
  id         String           @id @default(uuid())
  productId  String
  planId     String

  product    Product          @relation(fields: [productId], references: [id], onDelete: Cascade)
  plan       SubscriptionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@unique([productId, planId])
}

// ─────────────────────────────────────────────
// Upsell / Cross-sell Rules
// ─────────────────────────────────────────────

model UpsellRule {
  id                String   @id @default(uuid())
  companyId         String   @default("default")
  triggerProductId  String
  suggestedProductId String
  minMarginPct      Float    @default(0)    // only surface if suggested product margin >= this
  isPromoted        Boolean  @default(false)
  priority          Int      @default(0)    // higher = ranked higher
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  triggerProduct    Product  @relation("TriggerProduct", fields: [triggerProductId], references: [id])
  suggestedProduct  Product  @relation("SuggestedProduct", fields: [suggestedProductId], references: [id])

  @@index([companyId, triggerProductId])
}
```

---

## 7. API Endpoints

### Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/catalog/products` | JWT (any internal) | List products (paginated, filterable) |
| GET | `/catalog/products/:id` | JWT | Get product with variants |
| POST | `/catalog/products` | JWT (ADMIN) | Create product |
| PUT | `/catalog/products/:id` | JWT (ADMIN) | Update product |
| DELETE | `/catalog/products/:id` | JWT (ADMIN) | Soft-delete product |
| POST | `/catalog/products/:id/variants` | JWT (ADMIN) | Add variant |
| PUT | `/catalog/products/:id/variants/:vid` | JWT (ADMIN) | Update variant |
| DELETE | `/catalog/products/:id/variants/:vid` | JWT (ADMIN) | Delete variant |

**GET /catalog/products — Query Parameters**:
- `page` (default 1), `pageSize` (default 20, max 100)
- `categoryId` — filter by category
- `search` — full-text search on name
- `isActive` (default true)
- `currency` — return prices in this currency

**Product Response**:
```json
{
  "id": "uuid",
  "name": "Enterprise Laptop Pro",
  "category": { "id": "uuid", "name": "Hardware" },
  "basePrice": "1299.00",
  "unit": "unit",
  "taxRate": 18.0,
  "costPrice": "900.00",
  "description": "...",
  "isActive": true,
  "variants": [
    {
      "id": "uuid",
      "attribute": "Size",
      "value": "16-inch",
      "extraPrice": "200.00"
    }
  ]
}
```

### Price Lists

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/catalog/price-lists` | JWT | List price lists |
| POST | `/catalog/price-lists` | JWT (ADMIN) | Create price list |
| PUT | `/catalog/price-lists/:id` | JWT (ADMIN) | Update price list |
| GET | `/catalog/price-lists/resolve` | JWT | Resolve price for product + customer tier + currency |

**GET /catalog/price-lists/resolve — Query Parameters**:
- `productId` (required)
- `customerTier` (required): `BRONZE | SILVER | GOLD`
- `currency` (required): ISO 4217
- `quantity` (optional): for quantity-based rules

**Response**:
```json
{
  "productId": "uuid",
  "resolvedPrice": "1100.00",
  "currency": "USD",
  "priceListId": "uuid",
  "appliedRule": "tier_discount"
}
```

### Discount Tiers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/catalog/discount-tiers` | JWT | List all discount tier configs |
| POST | `/catalog/discount-tiers` | JWT (ADMIN) | Create/update discount ceiling |
| DELETE | `/catalog/discount-tiers/:id` | JWT (ADMIN) | Delete discount ceiling |
| GET | `/catalog/discount-tiers/ceilings` | JWT (any) | Get all ceilings as structured map (cached) |

**GET /catalog/discount-tiers/ceilings Response** (used by Quotation Service):
```json
{
  "tierCeilings": {
    "BRONZE": 5.0,
    "SILVER": 10.0,
    "GOLD": 15.0
  },
  "categoryCeilings": {
    "category-uuid-hardware": 15.0,
    "category-uuid-services": 10.0
  }
}
```

### Approval Chains

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/catalog/approval-chains` | JWT | List approval chain configs |
| POST | `/catalog/approval-chains` | JWT (ADMIN) | Create approval chain rule |
| PUT | `/catalog/approval-chains/:id` | JWT (ADMIN) | Update rule |
| DELETE | `/catalog/approval-chains/:id` | JWT (ADMIN) | Delete rule |
| GET | `/catalog/approval-chains/resolve` | JWT | Get required approvers for a risk score |

**GET /catalog/approval-chains/resolve?riskScore=75 Response**:
```json
{
  "riskScore": 75.0,
  "requiresApproval": true,
  "requiredRoles": ["SALES_MANAGER", "FINANCE"],
  "chainId": "uuid"
}
```

### Warehouses

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/catalog/warehouses` | JWT | List warehouse definitions |
| POST | `/catalog/warehouses` | JWT (ADMIN) | Create warehouse |
| PUT | `/catalog/warehouses/:id` | JWT (ADMIN) | Update warehouse |
| DELETE | `/catalog/warehouses/:id` | JWT (ADMIN) | Soft-delete |

### Subscription Plans

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/catalog/subscription-plans` | JWT | List plans |
| GET | `/catalog/subscription-plans/:id` | JWT | Get plan details |
| POST | `/catalog/subscription-plans` | JWT (ADMIN) | Create plan |
| PUT | `/catalog/subscription-plans/:id` | JWT (ADMIN) | Update plan |
| GET | `/catalog/products/:id/plans` | JWT | Get plans linked to product |

### Upsell Rules

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/catalog/upsell-rules` | JWT (ADMIN) | List all rules |
| POST | `/catalog/upsell-rules` | JWT (ADMIN) | Create pairing |
| PUT | `/catalog/upsell-rules/:id` | JWT (ADMIN) | Update rule |
| DELETE | `/catalog/upsell-rules/:id` | JWT (ADMIN) | Delete rule |
| GET | `/catalog/upsell-rules/suggestions` | JWT | Get ranked suggestions for a product list |

**GET /catalog/upsell-rules/suggestions?productIds=id1,id2&customerTier=GOLD Response**:
```json
{
  "suggestions": [
    {
      "suggestedProductId": "uuid",
      "suggestedProduct": { "id": "uuid", "name": "ProSupport 1yr", "basePrice": "299.00" },
      "isPromoted": true,
      "priority": 10,
      "estimatedMarginDelta": "+22.0%"
    }
  ]
}
```

---

## 8. Caching Strategy

All frequently-read catalog data is cached in Redis.

| Endpoint | Cache Key | TTL |
|----------|-----------|-----|
| `/catalog/discount-tiers/ceilings` | `catalog:ceilings:<companyId>` | 5 min |
| `/catalog/products` (list) | `catalog:products:<companyId>:<page>:<filters_hash>` | 10 min |
| `/catalog/products/:id` | `catalog:product:<id>` | 10 min |
| `/catalog/upsell-rules/suggestions` | `catalog:upsell:<productIds_hash>:<tier>` | 15 min |
| `/catalog/approval-chains/resolve` | `catalog:chain:<riskScore>:<companyId>` | 5 min |
| `/catalog/warehouses` | `catalog:warehouses:<companyId>` | 5 min |

**Cache invalidation**: When Admin updates any entity, the relevant cache keys are deleted (write-through invalidation). Fastify plugin wraps repositories with cache-aside logic.

---

## 9. Multi-Currency Support (REQ-BONUS-001)

- All prices stored in base currency (configurable per company)
- Exchange rates stored as a `CurrencyRate` table (manual admin entry for hackathon; production would use live rates)
- Price resolution converts base price using stored rate
- Invoices record both original currency price and base currency equivalent

---

## 10. Multi-Company Support (REQ-BONUS-002)

- Every entity has a `companyId` field
- All queries are scoped by `companyId` from JWT claim (`req.user.companyId`)
- Admins can only manage their own company's data
- Default company: `"default"` (used when multi-company not configured)

---

## 11. Validation Rules

### Product
- `name`: required, 2–200 chars, unique per category + company
- `basePrice`: required, >0, max 6 decimal places
- `taxRate`: 0–100
- `costPrice`: >=0 (must be ≤ basePrice for positive margin)

### Discount Tier
- `ceilingPct`: 0–100
- Cannot have duplicate (tier + category + company) combinations

### Approval Chain
- `minRiskScore` < `maxRiskScore`
- Chains must be non-overlapping for same company
- At least one chain must cover 0–infinity (catch-all)

---

## 12. Implementation Checkpoints

**CHECK-CAT-001**
- **Covers**: REQ-F-010, REQ-F-011
- **Precondition**: Catalog service running
- **Action**: `POST /catalog/products` with valid payload including variants
- **Expected**: 201 with product id; subsequent `GET /catalog/products/:id` returns product with variants
- **Test**: `products.api.test.ts`

**CHECK-CAT-002**
- **Covers**: REQ-F-020, REQ-F-021
- **Precondition**: Discount tiers configured
- **Action**: `GET /catalog/discount-tiers/ceilings`
- **Expected**: Returns tierCeilings map with BRONZE/SILVER/GOLD and categoryCeilings map
- **Test**: `discount-tiers.api.test.ts`

**CHECK-CAT-003**
- **Covers**: REQ-F-022, REQ-F-023
- **Precondition**: Approval chains configured (e.g. 0–30: none, 30–70: SALES_MANAGER, 70+: SALES_MANAGER + FINANCE)
- **Action**: `GET /catalog/approval-chains/resolve?riskScore=75`
- **Expected**: `{ requiresApproval: true, requiredRoles: ["SALES_MANAGER", "FINANCE"] }`
- **Test**: `approval-chains.api.test.ts`

**CHECK-CAT-004**
- **Covers**: REQ-F-050, REQ-F-051, REQ-F-052
- **Precondition**: Upsell rules configured with margin threshold
- **Action**: `GET /catalog/upsell-rules/suggestions?productIds=<hardware-id>&customerTier=GOLD`
- **Expected**: Returns ranked list; promoted products appear first; products below margin threshold excluded
- **Test**: `upsell-rules.api.test.ts`

**CHECK-CAT-005**
- **Covers**: REQ-F-012, REQ-F-013, REQ-BONUS-001
- **Precondition**: Price list created for GOLD tier in EUR
- **Action**: `GET /catalog/price-lists/resolve?productId=X&customerTier=GOLD&currency=EUR`
- **Expected**: Returns resolved price in EUR using tier rules
- **Test**: `price-lists.api.test.ts`
