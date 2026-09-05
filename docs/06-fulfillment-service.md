# DealFlow360 — Fulfillment Service

---

## 1. Purpose

The Fulfillment Service owns **warehouse stock and order fulfillment logic**. It manages stock levels across multiple warehouses, computes optimal fulfillment splits, tracks backorders, and handles stock arrivals. It exists as a separate service because:

- **Separate data ownership**: Warehouse stock is a distinct domain from quotations and billing
- **Independent scaling**: High-volume operations (stock checks, split calculations) must not block quotation saves
- **Clear domain boundary**: Inventory management is a separate operational concern

---

## 2. Responsibilities

- Warehouse stock level management (CRUD + adjustments)
- Fulfillment split recommendation algorithm
- Manual override storage and tracking
- Backorder management
- Stock arrival events
- Fulfillment status tracking per order
- Replenishment rule configuration

---

## 3. Non-Responsibilities

- Warehouse definitions (owned by Catalog Service — names and cost weights)
- Subscription billing (Billing Service)
- Quotation state (Quotation Service)
- Shipping carrier integration (out of scope for hackathon)

---

## 4. Requirements Implemented

| Requirement | Description |
|------------|-------------|
| REQ-F-031 | Configure stock levels per warehouse |
| REQ-F-032 | Configure replenishment rules per warehouse |
| REQ-F-033 | Shipping cost weighting used by split algorithm |
| REQ-F-034 | Auto-split logic minimizes number of shipments |
| REQ-F-120 | Recommend warehouse split based on live stock |
| REQ-F-121 | Display warehouse name, quantity per warehouse, shipment count + cost |
| REQ-F-122 | Accept Suggested Split |
| REQ-F-123 | Manual Override — rep reassigns quantities |
| REQ-F-124 | Consolidate Remaining Backorder prompt on stock arrival |
| REQ-BR-009 | Auto split minimizes shipments with cost weighting |
| REQ-BONUS-005 | Consolidate backorder prompt automatic |

---

## 5. Database Schema

```prisma
// fulfillment-service/src/db/prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("FULFILLMENT_DATABASE_URL")
}

enum FulfillmentStatus {
  PENDING
  RESERVED
  PICKING
  SHIPPED
  DELIVERED
  BACKORDERED
  CANCELLED
}

// ─────────────────────────────────────────────
// Stock
// ─────────────────────────────────────────────

model WarehouseStock {
  id               String   @id @default(uuid())
  companyId        String   @default("default")
  warehouseId      String   // logical FK to catalog_db.WarehouseDefinition
  warehouseName    String   // snapshot
  productId        String   // logical FK to catalog_db.Product
  variantId        String?
  quantityOnHand   Int      @default(0)
  quantityReserved Int      @default(0)
  reorderPoint     Int      @default(10)
  reorderQty       Int      @default(50)
  updatedAt        DateTime @updatedAt

  @@unique([companyId, warehouseId, productId, variantId])
  @@index([companyId, warehouseId])
  @@index([companyId, productId])
}

// ─────────────────────────────────────────────
// Fulfillment Order
// ─────────────────────────────────────────────

model FulfillmentOrder {
  id          String  @id @default(uuid())
  companyId   String  @default("default")
  orderId     String  // quotationId from quotation_db
  customerId  String
  currency    String  @default("USD")
  isOverride  Boolean @default(false)  // true if rep manually overrode suggested split
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  splits      FulfillmentSplit[]

  @@index([companyId, orderId])
}

model FulfillmentSplit {
  id                String            @id @default(uuid())
  fulfillmentOrderId String
  warehouseId       String
  warehouseName     String
  productId         String
  variantId         String?
  productName       String
  quantityRequested Int
  quantityFulfilled Int               @default(0)
  quantityBackordered Int             @default(0)
  estimatedShipDate DateTime?
  status            FulfillmentStatus @default(PENDING)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  fulfillmentOrder  FulfillmentOrder  @relation(fields: [fulfillmentOrderId], references: [id], onDelete: Cascade)

  @@index([fulfillmentOrderId])
  @@index([warehouseId, status])
}

model BackorderRecord {
  id               String   @id @default(uuid())
  companyId        String   @default("default")
  fulfillmentSplitId String
  orderId          String
  productId        String
  variantId        String?
  quantityNeeded   Int
  warehouseId      String
  resolvedAt       DateTime?
  createdAt        DateTime @default(now())

  @@index([companyId, productId])
  @@index([orderId])
}
```

---

## 6. Warehouse Split Algorithm

```typescript
// domain/services/split-algorithm.service.ts

interface SplitRequest {
  orderId: string;
  companyId: string;
  lines: Array<{
    productId: string;
    variantId?: string;
    productName: string;
    quantityNeeded: number;
  }>;
}

interface WarehouseStockView {
  warehouseId: string;
  warehouseName: string;
  shippingCostWeight: number;  // from Catalog Service
  availableQty: number;        // quantityOnHand - quantityReserved
}

interface SplitRecommendation {
  splits: Array<{
    warehouseId: string;
    warehouseName: string;
    productId: string;
    quantityFromHere: number;
    quantityBackordered: number;
  }>;
  estimatedShipmentCount: number;
  estimatedTotalShippingCost: number;  // relative units
  hasBackorder: boolean;
  backorderedItems: Array<{ productId: string; quantity: number }>;
}

/**
 * Algorithm:
 * 1. For each line item, find all warehouses that have stock
 * 2. Sort warehouses by: (a) availability of most items (minimize warehouse count),
 *    then (b) shipping cost weight (prefer lower cost warehouses)
 * 3. Greedily assign quantities starting from "best" warehouse
 * 4. Create backorder records for quantities that cannot be fulfilled
 *
 * Goal: Minimize number of distinct warehouses used (= fewer shipments)
 * Tiebreaker: Prefer warehouses with lower shippingCostWeight
 */
function computeOptimalSplit(
  request: SplitRequest,
  warehouseStocks: Map<string, WarehouseStockView[]>  // productId → stocks per warehouse
): SplitRecommendation {
  // ... implementation
}
```

---

## 7. API Endpoints

### Stock Management

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/fulfillment/stock` | JWT | List all stock across warehouses |
| GET | `/fulfillment/stock/:warehouseId` | JWT | Stock for a specific warehouse |
| PUT | `/fulfillment/stock` | JWT (ADMIN, FINANCE) | Set stock level for product+warehouse |
| POST | `/fulfillment/stock/adjust` | JWT (ADMIN, FINANCE) | Adjust stock (+/-) |
| POST | `/fulfillment/stock/arrival` | JWT (ADMIN, FINANCE) | Record stock arrival (triggers backorder check) |

**POST /fulfillment/stock/arrival** (REQ-BONUS-005):
```json
{
  "warehouseId": "uuid",
  "productId": "uuid",
  "variantId": null,
  "quantityArrived": 50
}
```
→ Publishes `fulfillment.stock_arrived` event
→ Quotation Service checks for open backorders on this product and prompts rep

### Split Recommendation

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/fulfillment/split-recommendation` | JWT | Get optimal split for an order |
| POST | `/fulfillment/orders` | JWT | Accept split (creates fulfillment records, reserves stock) |
| PUT | `/fulfillment/orders/:id` | JWT | Manual override of split |
| GET | `/fulfillment/orders/:orderId` | JWT | Get fulfillment status for order |
| POST | `/fulfillment/orders/:id/consolidate-backorder` | JWT | Consolidate backorder after stock arrival |

**GET /fulfillment/split-recommendation?orderId=:id Response**:
```json
{
  "orderId": "uuid",
  "splits": [
    {
      "warehouseId": "uuid",
      "warehouseName": "Main Warehouse",
      "shippingCostWeight": 1.0,
      "items": [
        {
          "productId": "uuid",
          "productName": "Enterprise Laptop Pro",
          "quantityFromHere": 3,
          "quantityBackordered": 0
        }
      ]
    },
    {
      "warehouseId": "uuid",
      "warehouseName": "East Depot",
      "shippingCostWeight": 1.3,
      "items": [
        {
          "productId": "uuid",
          "productName": "Enterprise Laptop Pro",
          "quantityFromHere": 2,
          "quantityBackordered": 0
        }
      ]
    }
  ],
  "estimatedShipmentCount": 2,
  "estimatedTotalShippingCost": 2.3,
  "hasBackorder": false,
  "backorderedItems": []
}
```

**POST /fulfillment/orders** (Accept Split):
```json
{
  "orderId": "uuid",
  "splits": [
    {
      "warehouseId": "uuid",
      "productId": "uuid",
      "quantity": 3
    },
    {
      "warehouseId": "uuid-east",
      "productId": "uuid",
      "quantity": 2
    }
  ],
  "isOverride": false
}
```

---

## 8. Events Published

| Event | Trigger | Payload |
|-------|---------|---------|
| `fulfillment.stock_arrived` | Stock arrival recorded | `{ companyId, warehouseId, productId, variantId, quantityArrived, affectedOrderIds[] }` |
| `fulfillment.shipment_delayed` | Estimated ship date passes without shipping | `{ orderId, splitId, warehouseId, daysDelayed }` |
| `fulfillment.split_accepted` | Rep accepts fulfillment split | `{ orderId, warehouseCount, hasBackorder }` |

---

## 9. Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `quotation.confirmed` | Quotation | Load order lines; make stock data available for split recommendation |
| `quotation.rejected` | Quotation | Release any reserved stock |

---

## 10. Implementation Checkpoints

**CHECK-FULL-001**
- **Covers**: REQ-F-120, REQ-F-121, REQ-BR-009
- **Precondition**: 2 warehouses configured; product has 3 units in Warehouse A, 5 in Warehouse B; order needs 5 units
- **Action**: `GET /fulfillment/split-recommendation?orderId=:id`
- **Expected**: Recommendation suggests 3 from A, 2 from B (uses both); estimatedShipmentCount = 2
- **Test**: `fulfillment.api.test.ts > split recommendation`

**CHECK-FULL-002**
- **Covers**: REQ-F-122
- **Precondition**: Split recommendation ready
- **Action**: `POST /fulfillment/orders` with suggested split
- **Expected**: FulfillmentOrder created; stock reserved (quantityReserved updated); status = RESERVED
- **Test**: `fulfillment.api.test.ts > accept split reserves stock`

**CHECK-FULL-003**
- **Covers**: REQ-F-123
- **Precondition**: Suggested split available
- **Action**: `POST /fulfillment/orders` with `isOverride: true` and different distribution
- **Expected**: Custom split stored; `isOverride` flag = true in DB
- **Test**: `fulfillment.api.test.ts > manual override`

**CHECK-FULL-004**
- **Covers**: REQ-F-124, REQ-BONUS-005
- **Precondition**: Order has backordered items; rep notified
- **Action**: `POST /fulfillment/stock/arrival` for the backordered product
- **Expected**: `fulfillment.stock_arrived` event published; Quotation Service picks it up; rep sees "Consolidate Backorder" prompt
- **Test**: `fulfillment.api.test.ts > stock arrival triggers backorder prompt`

**CHECK-FULL-005**
- **Covers**: REQ-F-034
- **Precondition**: Product available in 3 warehouses; order can be fulfilled from 1
- **Action**: `GET /fulfillment/split-recommendation`
- **Expected**: Algorithm recommends single warehouse (minimizes shipment count); highest-cost warehouse not used if unnecessary
- **Test**: `split-algorithm.service.test.ts > minimize shipment count`
