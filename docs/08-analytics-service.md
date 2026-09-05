# DealFlow360 — Analytics & Reporting Service

---

## 1. Purpose

The Analytics Service provides **reporting, dashboard data, and deal health monitoring**. It is computationally isolated to prevent heavy aggregate queries from blocking transactional services. It maintains pre-aggregated projections built from events emitted by other services.

---

## 2. Responsibilities

- Deal Health dashboard data (stalled deals, discount anomalies, delivery slippage)
- Sales performance reporting
- Pipeline status breakdown
- Discount anomaly detection per rep
- MRR and recurring revenue tracking
- PDF and XLS report export
- Nudge/escalation action triggers
- Configurable thresholds (stall days, anomaly std dev)

---

## 3. Non-Responsibilities

- Source-of-truth for any business data (reads only)
- Quotation state (Quotation Service is authoritative)
- Invoice data (Billing Service is authoritative)

---

## 4. Requirements Implemented

| Requirement | Description |
|------------|-------------|
| REQ-F-060 | Sales performance dashboard |
| REQ-F-061 | Export PDF and XLS |
| REQ-F-062–065 | Report filters (period, team, status, product) |
| REQ-F-150 | Stalled deals |
| REQ-F-151 | Discount anomaly alerts |
| REQ-F-152 | Delivery promise slippage |
| REQ-F-153 | Clicking alert opens quotation |
| REQ-F-154 | Nudge/escalation from alert |
| REQ-BONUS-004 | Automated nudge/escalation action |
| REQ-RPT-001–007 | All reporting requirements |
| REQ-D-019 | DealHealthConfig entity |

---

## 5. Database Schema

```prisma
// analytics-service/src/db/prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("ANALYTICS_DATABASE_URL")
}

// ─────────────────────────────────────────────
// Quotation snapshots (replicated from events)
// ─────────────────────────────────────────────

model QuotationSnapshot {
  id               String   @id       // quotationId from quotation_db
  companyId        String
  repId            String
  repName          String
  customerId       String
  customerName     String
  customerTier     String
  status           String
  totalAmount      Decimal  @db.Decimal(12, 4)
  totalMarginPct   Float
  blendedRiskScore Float
  currency         String
  lastActivityAt   DateTime
  createdAt        DateTime
  confirmedAt      DateTime?
  updatedAt        DateTime

  @@index([companyId, status])
  @@index([companyId, repId])
  @@index([lastActivityAt])
}

model QuotationLineSnapshot {
  id            String  @id
  quotationId   String
  companyId     String
  productId     String
  productName   String
  categoryId    String
  categoryName  String
  discountPct   Float
  lineTotal     Decimal @db.Decimal(12, 4)
  marginPct     Float

  @@index([quotationId])
  @@index([companyId, productId])
}

// ─────────────────────────────────────────────
// Deal Health Config
// ─────────────────────────────────────────────

model DealHealthConfig {
  id                    String  @id @default(uuid())
  companyId             String  @unique @default("default")
  stallDaysThreshold    Int     @default(7)     // days of inactivity = stalled
  anomalyStdDevFactor   Float   @default(2.0)   // discount > repAvg + (factor * stdDev) = anomaly
  deliverySlippageDays  Int     @default(3)     // days past expected ship date = slippage alert
  updatedAt             DateTime @updatedAt
}

// ─────────────────────────────────────────────
// Deal Health Alerts
// ─────────────────────────────────────────────

model DealAlert {
  id           String   @id @default(uuid())
  companyId    String
  quotationId  String
  type         String   // STALLED | DISCOUNT_ANOMALY | DELIVERY_SLIPPAGE
  severity     String   @default("MEDIUM")  // LOW | MEDIUM | HIGH
  message      String
  isResolved   Boolean  @default(false)
  resolvedAt   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  nudges       NudgeAction[]

  @@index([companyId, isResolved])
  @@index([quotationId])
}

model NudgeAction {
  id          String   @id @default(uuid())
  alertId     String
  quotationId String
  triggeredBy String   // userId
  type        String   // EMAIL_NUDGE | ESCALATION
  sentTo      String[] // email addresses or user IDs
  createdAt   DateTime @default(now())

  alert       DealAlert @relation(fields: [alertId], references: [id])

  @@index([alertId])
}

// ─────────────────────────────────────────────
// Billing Snapshots
// ─────────────────────────────────────────────

model InvoiceSnapshot {
  id          String   @id   // invoiceId
  companyId   String
  orderId     String
  customerId  String
  type        String
  status      String
  amount      Decimal  @db.Decimal(12, 4)
  currency    String
  paidAt      DateTime?
  createdAt   DateTime

  @@index([companyId, type])
  @@index([companyId, status])
}

model SubscriptionSnapshot {
  id             String   @id
  companyId      String
  orderId        String
  customerId     String
  planName       String
  interval       String
  quantity       Int
  unitPrice      Decimal  @db.Decimal(12, 4)
  status         String
  nextBillingDate DateTime

  @@index([companyId, status])
  @@index([nextBillingDate])
}
```

---

## 6. Deal Health Algorithms

### Stalled Deal Detection

```typescript
// domain/services/deal-health.service.ts

async function detectStalledDeals(companyId: string): Promise<DealAlert[]> {
  const config = await getDealHealthConfig(companyId);
  const cutoffDate = subDays(new Date(), config.stallDaysThreshold);
  
  const stalledQuotations = await QuotationSnapshot.findMany({
    where: {
      companyId,
      status: { in: ['DRAFT', 'PENDING_MANAGER_APPROVAL', 'PENDING_FINANCE_APPROVAL', 'SENT', 'UNDER_NEGOTIATION'] },
      lastActivityAt: { lt: cutoffDate },
    }
  });
  
  return stalledQuotations.map(q => ({
    quotationId: q.id,
    type: 'STALLED',
    severity: calculateStalledSeverity(q, config),
    message: `Quotation for ${q.customerName} has been inactive for ${daysSince(q.lastActivityAt)} days`
  }));
}
```

### Discount Anomaly Detection

```typescript
async function detectDiscountAnomalies(companyId: string): Promise<DealAlert[]> {
  const config = await getDealHealthConfig(companyId);
  
  // Get all reps' recent discount history (last 90 days)
  const repDiscountStats = await getRepDiscountStatistics(companyId, 90);
  
  const alerts: DealAlert[] = [];
  
  for (const { repId, repName, recentQuotations } of repDiscountStats) {
    const discounts = recentQuotations.map(q => q.blendedRiskScore);
    const avg = mean(discounts);
    const stdDev = standardDeviation(discounts);
    const threshold = avg + (config.anomalyStdDevFactor * stdDev);
    
    // Check current DRAFT/PENDING quotations for this rep
    const currentQuotations = await QuotationSnapshot.findMany({
      where: { companyId, repId, status: { in: ['DRAFT', 'PENDING_MANAGER_APPROVAL'] } }
    });
    
    for (const q of currentQuotations) {
      if (q.blendedRiskScore > threshold && q.blendedRiskScore > 0) {
        alerts.push({
          quotationId: q.id,
          type: 'DISCOUNT_ANOMALY',
          severity: q.blendedRiskScore > threshold * 1.5 ? 'HIGH' : 'MEDIUM',
          message: `Rep ${repName}'s discount on this deal (score: ${q.blendedRiskScore.toFixed(1)}) is significantly above their average (avg: ${avg.toFixed(1)})`
        });
      }
    }
  }
  
  return alerts;
}
```

---

## 7. API Endpoints

### Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/analytics/dashboard` | JWT (MANAGER, ADMIN) | Summary KPIs |
| GET | `/analytics/deal-health` | JWT (MANAGER, ADMIN) | All active alerts |
| PUT | `/analytics/deal-health/config` | JWT (ADMIN) | Update threshold config |

**GET /analytics/dashboard Response**:
```json
{
  "period": { "from": "2026-09-01", "to": "2026-09-05" },
  "kpis": {
    "totalQuotations": 47,
    "totalRevenue": "284500.00",
    "averageMargin": 31.2,
    "approvalRate": 0.87,
    "averageApprovalDays": 1.4,
    "pendingApprovals": 5
  },
  "pipelineBreakdown": {
    "DRAFT": 12,
    "PENDING_MANAGER_APPROVAL": 3,
    "PENDING_FINANCE_APPROVAL": 2,
    "APPROVED": 8,
    "SENT": 10,
    "UNDER_NEGOTIATION": 4,
    "CONFIRMED": 7,
    "REJECTED": 1,
    "LOST": 0
  },
  "topReps": [
    { "repId": "uuid", "repName": "John Doe", "totalRevenue": "95000.00", "quotationCount": 14 }
  ],
  "recurringRevenue": {
    "mrr": "12480.00",
    "upcomingRenewals30Days": "37440.00"
  }
}
```

**GET /analytics/deal-health Response**:
```json
{
  "alerts": [
    {
      "id": "uuid",
      "quotationId": "uuid",
      "type": "STALLED",
      "severity": "HIGH",
      "message": "Quotation for Acme Corp has been inactive for 12 days",
      "customerName": "Acme Corp",
      "repName": "John Doe",
      "quotationAmount": "45000.00",
      "daysSinceActivity": 12,
      "isResolved": false,
      "createdAt": "2026-09-03T00:00:00Z"
    },
    {
      "id": "uuid",
      "quotationId": "uuid",
      "type": "DISCOUNT_ANOMALY",
      "severity": "MEDIUM",
      "message": "Rep Jane's discount (score: 45.2) significantly above average (avg: 12.1)",
      "repName": "Jane Smith",
      "blendedRiskScore": 45.2,
      "repAverageScore": 12.1
    },
    {
      "id": "uuid",
      "type": "DELIVERY_SLIPPAGE",
      "severity": "HIGH",
      "message": "Shipment for order #1234 is 5 days past expected ship date",
      "orderId": "uuid",
      "daysDelayed": 5
    }
  ],
  "summary": {
    "stalledCount": 3,
    "anomalyCount": 2,
    "slippageCount": 1
  }
}
```

### Reporting

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/analytics/reports/quotations` | JWT (MANAGER, ADMIN) | Quotation performance report |
| GET | `/analytics/reports/products` | JWT (MANAGER, ADMIN) | Product sales report |
| GET | `/analytics/reports/discounts` | JWT (MANAGER, ADMIN) | Discount anomaly report per rep |
| GET | `/analytics/reports/recurring` | JWT (MANAGER, FINANCE, ADMIN) | MRR + upcoming renewals |
| POST | `/analytics/reports/export` | JWT (MANAGER, ADMIN) | Generate PDF or XLS report |

**GET /analytics/reports/quotations Query Parameters**:
- `from` (ISO date, default today - 7 days)
- `to` (ISO date, default today)
- `repId` (optional)
- `status` (optional): `APPROVED | PENDING | REJECTED | CONFIRMED`
- `productId` (optional)
- `categoryId` (optional)
- `page`, `pageSize`

**POST /analytics/reports/export Request**:
```json
{
  "reportType": "quotations",
  "format": "PDF",
  "filters": {
    "from": "2026-09-01",
    "to": "2026-09-05",
    "repId": null,
    "status": null
  }
}
```

**Response 200**:
```json
{
  "downloadUrl": "/analytics/reports/exports/export-uuid.pdf",
  "expiresAt": "2026-09-05T10:00:00Z"
}
```

### Nudge Actions (REQ-BONUS-004)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/analytics/alerts/:id/nudge` | JWT (MANAGER, ADMIN) | Send nudge email to rep |
| POST | `/analytics/alerts/:id/escalate` | JWT (MANAGER, ADMIN) | Escalate to manager |
| POST | `/analytics/alerts/:id/resolve` | JWT (MANAGER, ADMIN) | Mark alert as resolved |

**POST /analytics/alerts/:id/nudge Request**:
```json
{
  "type": "EMAIL_NUDGE",
  "message": "This deal has been stalled for too long. Please follow up with the customer today."
}
```

---

## 8. Events Consumed

| Event | Source | Action |
|-------|--------|--------|
| `quotation.status_changed` | Quotation | Update QuotationSnapshot |
| `quotation.confirmed` | Quotation | Update snapshot, update revenue metrics |
| `billing.invoice_paid` | Billing | Update InvoiceSnapshot; update revenue |
| `billing.subscription_renewed` | Billing | Update SubscriptionSnapshot, update MRR |
| `fulfillment.shipment_delayed` | Fulfillment | Create DELIVERY_SLIPPAGE alert |

---

## 9. Deal Health Job (Scheduled)

```typescript
// Runs every 30 minutes
async function runDealHealthCheck(): Promise<void> {
  for (const company of await getActiveCompanies()) {
    const stalledAlerts = await detectStalledDeals(company.id);
    const anomalyAlerts = await detectDiscountAnomalies(company.id);
    
    for (const alert of [...stalledAlerts, ...anomalyAlerts]) {
      await upsertAlert(alert);  // upsert to avoid duplicate alerts for same quotation
    }
  }
}
```

---

## 10. Implementation Checkpoints

**CHECK-ANA-001**
- **Covers**: REQ-F-060, REQ-RPT-001
- **Precondition**: Multiple quotations in various states in analytics DB (seeded via events)
- **Action**: `GET /analytics/dashboard`
- **Expected**: KPIs computed correctly; pipelineBreakdown matches actual quotation statuses
- **Test**: `analytics.api.test.ts > dashboard`

**CHECK-ANA-002**
- **Covers**: REQ-F-150, REQ-BR-014
- **Precondition**: Quotation with lastActivityAt = 10 days ago; stall threshold = 7 days
- **Action**: `GET /analytics/deal-health`
- **Expected**: Alert with type=STALLED appears for that quotation
- **Test**: `deal-health.service.test.ts > stalled deal detection`

**CHECK-ANA-003**
- **Covers**: REQ-F-151, REQ-BR-015
- **Precondition**: Rep has average risk score 12; current quotation has score 45 (> avg + 2*stdDev)
- **Action**: Trigger deal health check job; `GET /analytics/deal-health`
- **Expected**: Alert with type=DISCOUNT_ANOMALY appears
- **Test**: `deal-health.service.test.ts > discount anomaly detection`

**CHECK-ANA-004**
- **Covers**: REQ-F-153
- **Precondition**: Alert exists in dashboard
- **Action**: Frontend clicks alert → navigates to quotation
- **Expected**: Browser navigates to `/app/quotations/:quotationId` from alert's quotationId
- **Test**: `analytics.e2e.test.ts > alert click navigates to quotation`

**CHECK-ANA-005**
- **Covers**: REQ-F-154, REQ-BONUS-004
- **Precondition**: STALLED alert exists; manager is logged in
- **Action**: `POST /analytics/alerts/:id/nudge { type: "EMAIL_NUDGE", message: "..." }`
- **Expected**: Email sent to rep; NudgeAction record created; email received in Mailpit
- **Test**: `analytics.api.test.ts > nudge action sends email`

**CHECK-ANA-006**
- **Covers**: REQ-F-061, REQ-RPT-007
- **Precondition**: Report data exists
- **Action**: `POST /analytics/reports/export { reportType: "quotations", format: "PDF" }`
- **Expected**: Returns downloadUrl; GET downloadUrl returns a valid PDF file
- **Test**: `analytics.api.test.ts > PDF export`

**CHECK-ANA-007**
- **Covers**: REQ-F-062–065
- **Precondition**: Quotations exist across multiple reps and periods
- **Action**: `GET /analytics/reports/quotations?from=2026-09-01&to=2026-09-05&repId=X&status=APPROVED`
- **Expected**: Only quotations matching all filters returned
- **Test**: `analytics.api.test.ts > report filters`
