# DealFlow360 — Billing Service

---

## 1. Purpose

The Billing Service is the **financial record-keeping and recurring billing authority**. It manages invoices, subscription billing schedules, proration calculations, credit notes, and payment recording. It exists separately because:

- **Financial compliance boundary**: Billing records must be independently auditable
- **Separate data ownership**: Invoice and subscription state is a distinct financial domain
- **Independent scaling**: Recurring billing jobs run on schedules, not in response to user requests

---

## 2. Responsibilities

- Invoice generation (one-time + recurring)
- Subscription line lifecycle (active, paused, cancelled)
- Billing schedule computation
- Proration calculations for mid-cycle changes
- Credit note generation on cancellation
- Payment recording
- Upcoming renewal tracking
- Billing summary for Analytics Service

---

## 3. Non-Responsibilities

- Quotation state (Quotation Service)
- Stock levels (Fulfillment Service)
- Product/plan definitions (Catalog Service — reads from there)
- External payment gateway integration (out of scope — payment is recorded manually)

---

## 4. Requirements Implemented

| Requirement | Description |
|------------|-------------|
| REQ-F-040–044 | Subscription plan configuration (via Catalog; billing enforces rules) |
| REQ-F-130 | One-time and recurring lines shown separately |
| REQ-F-131 | Upcoming billing schedule for recurring lines |
| REQ-F-132 | Mid-cycle proration on quantity change |
| REQ-F-133 | Cancel or modify subscription controls |
| REQ-F-134 | Automatic partial refund or credit note on cancellation |
| REQ-F-161 | Payment recording + invoice status update |
| REQ-F-162 | One-time + recurring on same order billed correctly |
| REQ-BR-010 | One-time and recurring lines billed separately |
| REQ-BR-011 | Mid-cycle changes trigger proration |
| REQ-BR-012 | Cancellations trigger credit note/partial refund |
| REQ-RPT-006 | Recurring revenue summary (MRR, upcoming renewals) |

---

## 5. Database Schema

```prisma
// billing-service/src/db/prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("BILLING_DATABASE_URL")
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  OVERDUE
  VOIDED
  CREDIT_NOTE
}

enum InvoiceType {
  ONE_TIME
  RECURRING
  CREDIT_NOTE
  PRORATION
}

enum SubscriptionStatus {
  ACTIVE
  PAUSED
  CANCELLED
  EXPIRED
}

// ─────────────────────────────────────────────
// Invoices
// ─────────────────────────────────────────────

model Invoice {
  id            String        @id @default(uuid())
  companyId     String        @default("default")
  orderId       String        // quotationId from quotation_db
  customerId    String
  type          InvoiceType
  status        InvoiceStatus @default(DRAFT)
  currency      String        @default("USD")
  subtotal      Decimal       @db.Decimal(12, 4)
  taxAmount     Decimal       @db.Decimal(12, 4) @default(0)
  totalAmount   Decimal       @db.Decimal(12, 4)
  dueDate       DateTime?
  paidAt        DateTime?
  voidedAt      DateTime?
  notes         String?
  idempotencyKey String?      @unique
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  lines         InvoiceLine[]
  payments      Payment[]

  @@index([companyId, orderId])
  @@index([companyId, customerId])
  @@index([status])
}

model InvoiceLine {
  id          String  @id @default(uuid())
  invoiceId   String
  productId   String
  description String
  quantity    Int     @default(1)
  unitPrice   Decimal @db.Decimal(12, 4)
  discountPct Float   @default(0)
  lineTotal   Decimal @db.Decimal(12, 4)
  taxRate     Float   @default(0)
  taxAmount   Decimal @db.Decimal(12, 4) @default(0)

  invoice     Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([invoiceId])
}

// ─────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────

model SubscriptionLine {
  id                String             @id @default(uuid())
  companyId         String             @default("default")
  orderId           String
  customerId        String
  planId            String             // logical FK to catalog_db.SubscriptionPlan
  planName          String             // snapshot
  interval          String             // MONTHLY | QUARTERLY | YEARLY
  unitPrice         Decimal            @db.Decimal(12, 4)
  quantity          Int                @default(1)
  currency          String             @default("USD")
  status            SubscriptionStatus @default(ACTIVE)
  startDate         DateTime
  currentPeriodStart DateTime
  currentPeriodEnd  DateTime
  nextBillingDate   DateTime
  cancelledAt       DateTime?
  cancellationPolicy String            // end_of_period | immediate
  partialRefundPct  Float              @default(0)
  createdAt         DateTime           @default(now())
  updatedAt         DateTime           @updatedAt

  billingHistory    BillingCycle[]

  @@index([companyId, orderId])
  @@index([nextBillingDate, status])
  @@index([companyId, customerId])
}

model BillingCycle {
  id                 String          @id @default(uuid())
  subscriptionLineId String
  periodStart        DateTime
  periodEnd          DateTime
  amount             Decimal         @db.Decimal(12, 4)
  invoiceId          String?
  billedAt           DateTime?
  createdAt          DateTime        @default(now())

  subscriptionLine   SubscriptionLine @relation(fields: [subscriptionLineId], references: [id])

  @@index([subscriptionLineId])
}

// ─────────────────────────────────────────────
// Payments
// ─────────────────────────────────────────────

model Payment {
  id              String   @id @default(uuid())
  companyId       String   @default("default")
  invoiceId       String
  amount          Decimal  @db.Decimal(12, 4)
  currency        String   @default("USD")
  method          String   // cash | bank_transfer | card | check
  reference       String?  // external payment reference
  recordedBy      String   // userId from auth_db
  recordedAt      DateTime @default(now())
  idempotencyKey  String?  @unique

  invoice         Invoice  @relation(fields: [invoiceId], references: [id])

  @@index([invoiceId])
}
```

---

## 6. Proration Calculation Logic

```typescript
// domain/services/proration.service.ts

interface ProrationInput {
  subscriptionLineId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  changeDate: Date;          // date of quantity change
  oldQuantity: number;
  newQuantity: number;
  unitPrice: number;
  prorationMode: 'DAILY' | 'NONE';
}

interface ProrationResult {
  creditAmount: number;      // credit for unused portion at old qty
  chargeAmount: number;      // charge for remaining period at new qty
  netAmount: number;         // chargeAmount - creditAmount (can be negative → refund)
  creditNote?: boolean;      // true if net is negative
}

function computeProration(input: ProrationInput): ProrationResult {
  if (input.prorationMode === 'NONE') {
    return { creditAmount: 0, chargeAmount: 0, netAmount: 0 };
  }

  const periodDays = daysBetween(input.currentPeriodStart, input.currentPeriodEnd);
  const remainingDays = daysBetween(input.changeDate, input.currentPeriodEnd);
  const dailyRate = input.unitPrice / periodDays;

  const creditAmount = dailyRate * remainingDays * input.oldQuantity;
  const chargeAmount = dailyRate * remainingDays * input.newQuantity;
  const netAmount = chargeAmount - creditAmount;

  return {
    creditAmount,
    chargeAmount,
    netAmount,
    creditNote: netAmount < 0
  };
}
```

---

## 7. Cancellation Logic

```typescript
// domain/services/cancellation.service.ts

interface CancellationResult {
  effectiveDate: Date;        // when subscription actually ends
  refundAmount: number;       // based on partialRefundPct
  creditNoteAmount: number;   // same as refundAmount, recorded as credit note
}

function computeCancellation(
  subscription: SubscriptionLine,
  cancelledAt: Date
): CancellationResult {
  if (subscription.cancellationPolicy === 'end_of_period') {
    return {
      effectiveDate: subscription.currentPeriodEnd,
      refundAmount: 0,
      creditNoteAmount: 0
    };
  }

  // immediate cancellation
  const remainingDays = daysBetween(cancelledAt, subscription.currentPeriodEnd);
  const periodDays = daysBetween(subscription.currentPeriodStart, subscription.currentPeriodEnd);
  const remainingPct = remainingDays / periodDays;
  const paidAmount = subscription.unitPrice * subscription.quantity;
  const refundAmount = paidAmount * remainingPct * (subscription.partialRefundPct / 100);

  return {
    effectiveDate: cancelledAt,
    refundAmount,
    creditNoteAmount: refundAmount
  };
}
```

---

## 8. API Endpoints

### Invoices

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/billing/invoices` | JWT | List invoices (filterable by orderId, status, customerId) |
| GET | `/billing/invoices/:id` | JWT | Get invoice with lines |
| POST | `/billing/invoices/:id/send` | JWT (SALES_REP, ADMIN) | Mark invoice as SENT |
| POST | `/billing/invoices/:id/payments` | JWT (FINANCE, ADMIN) | Record payment |
| POST | `/billing/invoices/:id/void` | JWT (FINANCE, ADMIN) | Void invoice |

**POST /billing/invoices/:id/payments Request**:
```json
{
  "amount": "5720.00",
  "currency": "USD",
  "method": "bank_transfer",
  "reference": "TXN-20260905-001",
  "idempotencyKey": "payment-uuid-unique"
}
```

**Response 200**:
```json
{
  "invoiceId": "uuid",
  "status": "PAID",
  "paidAt": "2026-09-05T07:00:00Z",
  "payment": {
    "id": "uuid",
    "amount": "5720.00",
    "method": "bank_transfer",
    "reference": "TXN-20260905-001"
  }
}
```

### Subscriptions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/billing/subscriptions` | JWT | List subscription lines |
| GET | `/billing/subscriptions/:id` | JWT | Get subscription with schedule |
| PUT | `/billing/subscriptions/:id/quantity` | JWT | Change quantity (triggers proration) |
| POST | `/billing/subscriptions/:id/cancel` | JWT | Cancel subscription |
| GET | `/billing/subscriptions/upcoming` | JWT | Get upcoming renewals in next 30 days |
| GET | `/billing/schedules` | JWT | Get billing schedule for order |

**GET /billing/schedules?orderId=:id Response**:
```json
{
  "orderId": "uuid",
  "oneTimeInvoice": {
    "id": "uuid",
    "amount": "6498.00",
    "status": "SENT",
    "dueDate": "2026-09-20"
  },
  "recurringLines": [
    {
      "id": "uuid",
      "planName": "ProSupport Monthly",
      "quantity": 5,
      "unitPrice": "49.99",
      "nextBillingDate": "2026-10-05",
      "status": "ACTIVE",
      "schedule": [
        { "date": "2026-10-05", "amount": "249.95" },
        { "date": "2026-11-05", "amount": "249.95" }
      ]
    }
  ]
}
```

**PUT /billing/subscriptions/:id/quantity Request**:
```json
{
  "newQuantity": 8,
  "changeDate": "2026-09-15"
}
```

**Response 200**:
```json
{
  "subscriptionId": "uuid",
  "oldQuantity": 5,
  "newQuantity": 8,
  "proration": {
    "creditAmount": "37.49",
    "chargeAmount": "59.99",
    "netAmount": "22.50",
    "creditNote": false
  },
  "adjustmentInvoiceId": "uuid"
}
```

**POST /billing/subscriptions/:id/cancel Request**:
```json
{
  "cancelledAt": "2026-09-15",
  "reason": "Customer downsized team"
}
```

**Response 200**:
```json
{
  "subscriptionId": "uuid",
  "effectiveDate": "2026-09-30",
  "creditNoteAmount": "124.97",
  "creditNoteInvoiceId": "uuid",
  "status": "CANCELLED"
}
```

---

## 9. Recurring Billing Job

A scheduled cron job runs daily at 00:00 UTC:

```typescript
// jobs/billing-cron.job.ts

async function runDailyBillingJob(): Promise<void> {
  const today = new Date();
  
  // Find all active subscriptions where nextBillingDate <= today
  const dueSubs = await subscriptionRepo.findDueForBilling(today);
  
  for (const sub of dueSubs) {
    // Generate recurring invoice
    const invoice = await invoiceService.generateRecurringInvoice(sub);
    
    // Publish event for analytics
    await eventPublisher.publish('billing.invoice_created', {
      invoiceId: invoice.id,
      orderId: sub.orderId,
      customerId: sub.customerId,
      amount: invoice.totalAmount,
      type: 'RECURRING'
    });
    
    // Advance nextBillingDate
    await subscriptionRepo.advanceBillingDate(sub.id);
  }
}
```

---

## 10. Events Published

| Event | Trigger | Payload |
|-------|---------|---------|
| `billing.invoice_created` | Invoice generated | `{ invoiceId, orderId, customerId, amount, currency, type }` |
| `billing.invoice_paid` | Payment recorded | `{ invoiceId, orderId, customerId, amount, paidAt }` |
| `billing.subscription_renewed` | Recurring billing cycle | `{ subscriptionId, orderId, customerId, amount, period }` |
| `billing.subscription_cancelled` | Subscription cancelled | `{ subscriptionId, orderId, refundAmount }` |
| `billing.credit_note_issued` | Credit note created | `{ creditNoteId, orderId, customerId, amount }` |

---

## 11. Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `quotation.confirmed` | Quotation | Generate one-time invoice + create subscription lines for recurring items |
| `quotation.rejected` | Quotation | No billing action needed |

---

## 12. Implementation Checkpoints

**CHECK-BILL-001**
- **Covers**: REQ-F-162, REQ-BR-010
- **Precondition**: Order confirmed with 2 hardware lines + 1 subscription line
- **Action**: Listen for `quotation.confirmed` event; check billing DB
- **Expected**: One `ONE_TIME` invoice created for hardware lines; one `SubscriptionLine` record created for recurring line with correct `nextBillingDate`
- **Test**: `billing.event.test.ts > quotation confirmed creates correct invoices`

**CHECK-BILL-002**
- **Covers**: REQ-F-161
- **Precondition**: Invoice in SENT status
- **Action**: `POST /billing/invoices/:id/payments` with full amount + idempotency key
- **Expected**: Invoice status → PAID; paidAt timestamp set; Payment record created
- **Test**: `billing.api.test.ts > record payment`

**CHECK-BILL-003**
- **Covers**: REQ-IMP-006
- **Precondition**: Invoice in SENT status
- **Action**: POST payment twice with same idempotency key
- **Expected**: Second call returns 200 with same payment result; invoice status stays PAID; only one Payment record in DB
- **Test**: `billing.api.test.ts > idempotent payment`

**CHECK-BILL-004**
- **Covers**: REQ-F-132, REQ-BR-011
- **Precondition**: Active subscription (5 qty, $49.99/mo); change date = day 15 of 30-day period
- **Action**: `PUT /billing/subscriptions/:id/quantity { newQuantity: 8, changeDate: "..." }`
- **Expected**: Proration invoice created; credit = $49.99 * 5 * (15/30) = $124.98; charge = $49.99 * 8 * (15/30) = $199.96; net = $74.98; adjustment invoice for $74.98
- **Test**: `proration.service.test.ts > mid-cycle quantity increase`

**CHECK-BILL-005**
- **Covers**: REQ-F-133, REQ-F-134, REQ-BR-012
- **Precondition**: Active subscription with partialRefundPct=50
- **Action**: `POST /billing/subscriptions/:id/cancel { cancelledAt: "..." }` (immediate)
- **Expected**: Credit note generated for 50% of remaining period; subscriptionLine status → CANCELLED
- **Test**: `billing.api.test.ts > cancellation with partial refund`

**CHECK-BILL-006**
- **Covers**: REQ-F-131
- **Precondition**: Confirmed order with recurring line
- **Action**: `GET /billing/schedules?orderId=:id`
- **Expected**: Returns upcoming billing dates and amounts for all recurring lines; one-time invoice also included
- **Test**: `billing.api.test.ts > billing schedule`
