# DealFlow360 — Event-Driven Communication

---

## 1. Message Broker: Redis Streams

**Technology**: Redis Streams (Redis 7.x)  
**Client**: ioredis 5.x  
**Pattern**: Consumer Groups — each consumer group gets its own cursor; multiple consumers per group for scaling

### Why Redis Streams (Not Kafka/RabbitMQ)

Redis Streams provide:
- **Persistent, ordered messages** (unlike pub/sub which loses messages if consumer is down)
- **Consumer groups** for parallel processing + exactly-once delivery semantics
- **Dead-letter equivalent** via `XACK` + separate error stream
- **Zero additional infrastructure** (Redis already used for caching)

For hackathon scale (dozens of events/sec, not millions), Redis Streams are entirely sufficient.

---

## 2. Stream Naming Convention

```
dealflow360:<event-category>.<event-name>
```

| Stream | Events Written To It |
|--------|---------------------|
| `dealflow360:quotation` | quotation.* events |
| `dealflow360:fulfillment` | fulfillment.* events |
| `dealflow360:billing` | billing.* events |

---

## 3. Event Schema Standard

Every event follows this envelope:

```typescript
interface DomainEvent<T = unknown> {
  eventId: string;       // UUID v4 — unique per event
  eventType: string;     // e.g. "quotation.confirmed"
  version: string;       // schema version e.g. "1.0"
  timestamp: string;     // ISO 8601 UTC
  companyId: string;     // for multi-company routing
  payload: T;
}
```

**Example**:
```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "quotation.confirmed",
  "version": "1.0",
  "timestamp": "2026-09-05T06:00:00.000Z",
  "companyId": "default",
  "payload": {
    "quotationId": "uuid",
    "customerId": "uuid",
    "repId": "uuid",
    "totalAmount": "6749.60",
    "currency": "USD",
    "confirmedAt": "2026-09-05T06:00:00Z",
    "lines": [...]
  }
}
```

---

## 4. Complete Event Catalog

### 4.1 Quotation Events (Stream: `dealflow360:quotation`)

#### `quotation.status_changed`
- **Producer**: Quotation Service
- **Consumers**: Analytics Service
- **Trigger**: Any quotation status transition
- **Payload**:
```typescript
{
  quotationId: string;
  customerId: string;
  repId: string;
  oldStatus: QuotationStatus;
  newStatus: QuotationStatus;
  blendedRiskScore: number;
  totalAmount: string;
  currency: string;
  customerName: string;   // snapshot
  repName: string;        // snapshot
  customerTier: string;   // snapshot
}
```
- **Delivery**: At-least-once
- **Ordering**: Per quotationId (important — use quotationId as partition key)
- **Idempotency**: Consumers must handle duplicate events (check `eventId` against processed set)

---

#### `quotation.approved`
- **Producer**: Quotation Service
- **Consumers**: Fulfillment Service (makes order available for split), Analytics Service
- **Trigger**: Status → APPROVED
- **Payload**:
```typescript
{
  quotationId: string;
  customerId: string;
  repId: string;
  lines: Array<{
    lineId: string;
    productId: string;
    variantId: string | null;
    productName: string;
    quantity: number;
    isRecurring: boolean;
    planId: string | null;
  }>;
  totalAmount: string;
  currency: string;
}
```

---

#### `quotation.confirmed`
- **Producer**: Quotation Service
- **Consumers**: Billing Service (generate invoices), Fulfillment Service, Analytics Service
- **Trigger**: Status → CONFIRMED (by rep or customer portal)
- **Payload**:
```typescript
{
  quotationId: string;
  customerId: string;
  repId: string;
  confirmedAt: string;    // ISO date
  currency: string;
  totalAmount: string;
  lines: Array<{
    lineId: string;
    productId: string;
    variantId: string | null;
    productName: string;
    categoryId: string;
    quantity: number;
    unitPrice: string;
    discountPct: number;
    lineTotal: string;
    taxAmount: string;
    isRecurring: boolean;
    planId: string | null;
    planInterval: string | null;
    planName: string | null;
    costPrice: string;
  }>;
}
```
- **Idempotency**: Critical — Billing must check if invoice already created for this quotationId before creating new one

---

#### `quotation.rejected`
- **Producer**: Quotation Service
- **Consumers**: Analytics Service
- **Trigger**: Status → REJECTED
- **Payload**:
```typescript
{
  quotationId: string;
  customerId: string;
  repId: string;
  reason: string;
  rejectedBy: string;  // userId
  rejectedByRole: string;
}
```

---

#### `quotation.negotiation_received`
- **Producer**: Quotation Service
- **Consumers**: Analytics Service (update snapshot)
- **Trigger**: Customer submits portal negotiation
- **Payload**:
```typescript
{
  quotationId: string;
  customerId: string;
  negotiationId: string;
  proposedDiscount: number | null;
  message: string | null;
  reEnteredApproval: boolean;
}
```

---

### 4.2 Fulfillment Events (Stream: `dealflow360:fulfillment`)

#### `fulfillment.stock_arrived`
- **Producer**: Fulfillment Service
- **Consumers**: Quotation Service (trigger backorder consolidation prompt), Analytics Service
- **Trigger**: Admin/Finance records stock arrival via `POST /fulfillment/stock/arrival`
- **Payload**:
```typescript
{
  warehouseId: string;
  warehouseName: string;
  productId: string;
  variantId: string | null;
  quantityArrived: number;
  newQuantityOnHand: number;
  affectedOrderIds: string[];  // orders with open backorders for this product
}
```
- **Consumer action (Quotation Service)**: Set a flag on affected quotations/orders to show "Consolidate Backorder" prompt; send notification to rep

---

#### `fulfillment.shipment_delayed`
- **Producer**: Fulfillment Service (triggered by scheduled job)
- **Consumers**: Analytics Service
- **Trigger**: Scheduled check detects estimated ship date has passed without shipping
- **Payload**:
```typescript
{
  orderId: string;
  splitId: string;
  warehouseId: string;
  productId: string;
  daysDelayed: number;
  expectedShipDate: string;
}
```
- **Consumer action (Analytics)**: Create DELIVERY_SLIPPAGE alert in DealAlert table

---

#### `fulfillment.split_accepted`
- **Producer**: Fulfillment Service
- **Consumers**: Analytics Service
- **Trigger**: Rep accepts fulfillment split (suggested or manual)
- **Payload**:
```typescript
{
  orderId: string;
  fulfillmentOrderId: string;
  warehouseCount: number;
  hasBackorder: boolean;
  isOverride: boolean;
}
```

---

### 4.3 Billing Events (Stream: `dealflow360:billing`)

#### `billing.invoice_created`
- **Producer**: Billing Service
- **Consumers**: Analytics Service
- **Trigger**: Invoice generated (from confirmed quotation or recurring cycle)
- **Payload**:
```typescript
{
  invoiceId: string;
  orderId: string;
  customerId: string;
  type: 'ONE_TIME' | 'RECURRING' | 'PRORATION' | 'CREDIT_NOTE';
  amount: string;
  currency: string;
  dueDate: string | null;
}
```

---

#### `billing.invoice_paid`
- **Producer**: Billing Service
- **Consumers**: Analytics Service
- **Trigger**: Payment recorded
- **Payload**:
```typescript
{
  invoiceId: string;
  orderId: string;
  customerId: string;
  amount: string;
  currency: string;
  paidAt: string;
  method: string;
}
```

---

#### `billing.subscription_renewed`
- **Producer**: Billing Service (recurring billing cron)
- **Consumers**: Analytics Service
- **Trigger**: Recurring billing cycle runs
- **Payload**:
```typescript
{
  subscriptionLineId: string;
  orderId: string;
  customerId: string;
  amount: string;
  currency: string;
  interval: string;
  periodStart: string;
  periodEnd: string;
  newNextBillingDate: string;
}
```

---

#### `billing.subscription_cancelled`
- **Producer**: Billing Service
- **Consumers**: Analytics Service
- **Trigger**: Subscription cancelled
- **Payload**:
```typescript
{
  subscriptionLineId: string;
  orderId: string;
  customerId: string;
  cancelledAt: string;
  effectiveDate: string;
  refundAmount: string;
  creditNoteId: string | null;
}
```

---

## 5. Consumer Group Configuration

```typescript
// Each service that consumes events registers a consumer group

async function setupConsumerGroups(redis: Redis): Promise<void> {
  const streams = [
    { stream: 'dealflow360:quotation', groups: ['billing-service', 'fulfillment-service', 'analytics-service'] },
    { stream: 'dealflow360:fulfillment', groups: ['quotation-service', 'analytics-service'] },
    { stream: 'dealflow360:billing', groups: ['analytics-service'] },
  ];
  
  for (const { stream, groups } of streams) {
    for (const group of groups) {
      try {
        await redis.xgroup('CREATE', stream, group, '$', 'MKSTREAM');
      } catch (e) {
        if (!(e as Error).message.includes('BUSYGROUP')) throw e;
        // Group already exists — OK
      }
    }
  }
}
```

---

## 6. Event Publisher

```typescript
// events/event-publisher.ts
export class EventPublisher {
  constructor(private redis: Redis) {}

  async publish<T>(
    stream: string,
    event: Omit<DomainEvent<T>, 'eventId' | 'timestamp'>
  ): Promise<string> {
    const fullEvent: DomainEvent<T> = {
      ...event,
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    
    // XADD to Redis Stream
    const messageId = await this.redis.xadd(
      stream,
      '*',  // auto-generate message ID
      'data', JSON.stringify(fullEvent)
    );
    
    logger.info({ eventType: event.eventType, eventId: fullEvent.eventId, messageId }, 'Event published');
    return messageId;
  }
}
```

---

## 7. Event Consumer

```typescript
// events/event-consumer.ts
export class EventConsumer {
  private isRunning = false;

  constructor(
    private redis: Redis,
    private stream: string,
    private group: string,
    private consumerName: string,
    private handlers: Map<string, (payload: unknown) => Promise<void>>
  ) {}

  async start(): Promise<void> {
    this.isRunning = true;
    await this.processLoop();
  }

  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP', this.group, this.consumerName,
          'COUNT', 10,
          'BLOCK', 5000,  // block for 5s
          'STREAMS', this.stream, '>'
        );

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [messageId, fields] of messages) {
            await this.processMessage(messageId, fields);
          }
        }
      } catch (error) {
        logger.error({ error }, 'Consumer loop error');
        await sleep(1000);
      }
    }
  }

  private async processMessage(messageId: string, fields: string[]): Promise<void> {
    const data = JSON.parse(fields[1]) as DomainEvent;
    
    // Idempotency check: have we processed this eventId?
    const processed = await this.redis.get(`event:processed:${data.eventId}`);
    if (processed) {
      await this.redis.xack(this.stream, this.group, messageId);
      return;
    }
    
    const handler = this.handlers.get(data.eventType);
    if (!handler) {
      logger.warn({ eventType: data.eventType }, 'No handler for event type');
      await this.redis.xack(this.stream, this.group, messageId);
      return;
    }
    
    try {
      await handler(data.payload);
      
      // Mark as processed (expire after 24h)
      await this.redis.setex(`event:processed:${data.eventId}`, 86400, '1');
      await this.redis.xack(this.stream, this.group, messageId);
      
    } catch (error) {
      logger.error({ eventId: data.eventId, error }, 'Event processing failed');
      // Don't ACK → message will be redelivered (at-least-once)
      // After N retries → dead-letter handling
      await this.handleDeadLetter(messageId, data, error as Error);
    }
  }

  private async handleDeadLetter(
    messageId: string,
    event: DomainEvent,
    error: Error
  ): Promise<void> {
    const attempts = await this.redis.hincrby(`event:attempts:${event.eventId}`, 'count', 1);
    
    if (attempts >= 3) {
      // Move to dead-letter stream
      await this.redis.xadd(
        `dealflow360:dead-letter`,
        '*',
        'data', JSON.stringify({ event, error: error.message, attempts }),
        'originalStream', this.stream
      );
      await this.redis.xack(this.stream, this.group, messageId);
      logger.error({ eventId: event.eventId, attempts }, 'Event moved to dead-letter stream');
    }
  }
}
```

---

## 8. Dead-Letter Handling

```
dealflow360:dead-letter   →  Separate stream for failed events
```

- **Monitoring**: Analytics service monitors dead-letter stream; alerts on new entries
- **Reprocessing**: Admin can trigger manual reprocessing via internal tool
- **Alerting**: Log entry + (optionally) notification to ops channel

---

## 9. Implementation Checkpoints — Events

**CHECK-EVENT-001**
- **Covers**: `quotation.confirmed` → Billing
- **Precondition**: Quotation with one-time line + recurring line confirmed
- **Action**: Confirm quotation → wait 1s → check billing_db
- **Expected**: One `ONE_TIME` invoice created; one `SubscriptionLine` record created; both reference correct orderId
- **Test**: `event.integration.test.ts > quotation confirmed triggers billing`

**CHECK-EVENT-002**
- **Covers**: `quotation.confirmed` idempotency
- **Precondition**: `quotation.confirmed` event published for the same quotationId twice (simulating retry)
- **Action**: Process event twice
- **Expected**: Only one invoice created in billing_db; second processing is no-op
- **Test**: `event.integration.test.ts > confirmed event idempotency`

**CHECK-EVENT-003**
- **Covers**: `fulfillment.stock_arrived` → backorder prompt
- **Precondition**: Order has backordered items for product X; stock arrives
- **Action**: POST `/fulfillment/stock/arrival` for product X
- **Expected**: `fulfillment.stock_arrived` published; Quotation Service receives it; backorder prompt flag set; rep sees "Consolidate Backorder" UI element
- **Test**: `event.integration.test.ts > stock arrival triggers backorder prompt`

**CHECK-EVENT-004**
- **Covers**: `quotation.status_changed` → Analytics snapshot
- **Precondition**: Analytics consumer group running
- **Action**: Change quotation status from DRAFT → PENDING_MANAGER_APPROVAL
- **Expected**: `QuotationSnapshot` in analytics_db updated to reflect new status within 2s
- **Test**: `event.integration.test.ts > status change updates analytics snapshot`

**CHECK-EVENT-005**
- **Covers**: Dead-letter handling
- **Precondition**: Billing consumer handler throws exception 3 times for same event
- **Action**: Publish event that triggers handler error → wait for retries
- **Expected**: After 3 failures, event in `dealflow360:dead-letter` stream; event ID in dead-letter payload
- **Test**: `event.unit.test.ts > dead letter after max retries`
