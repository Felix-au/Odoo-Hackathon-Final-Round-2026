/**
 * Billing Service — API Integration Tests
 *
 * Verifies all documented checkpoints:
 * - CHECK-BILL-001: Quotation confirmed creates one-time invoice + subscription line
 * - CHECK-BILL-002: Record payment on SENT invoice transitions to PAID
 * - CHECK-BILL-003: Idempotent payment request returns same payment without duplicating
 * - CHECK-BILL-004: Mid-cycle quantity change computes proration and creates adjustment invoice
 * - CHECK-BILL-005: Immediate cancellation generates credit note and cancels subscription
 * - CHECK-BILL-006: Billing schedule returns one-time invoice and recurring line projections
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { Prisma, InvoiceStatus, InvoiceType, SubscriptionStatus } from '@prisma/client';

// ─── Environment ─────────────────────────────────────────────────────────────
const TEST_JWT_SECRET = 'dev_jwt_secret_change_in_prod_must_be_64_chars_minimum_dev_only_x';
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3005';
process.env['BILLING_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/billing_test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['JWT_SECRET'] = TEST_JWT_SECRET;
process.env['SERVICE_TOKEN'] = 'test-service-token-1234567890';

// ─── Mock Redis ──────────────────────────────────────────────────────────────
vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    xadd: vi.fn().mockResolvedValue('msg-123'),
    xgroup: vi.fn().mockResolvedValue('OK'),
    xreadgroup: vi.fn().mockResolvedValue(null),
    xack: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    disconnect: vi.fn(),
  }));
  return { default: MockRedis };
});

// ─── In-Memory Database Mocks ─────────────────────────────────────────────────
let dbInvoices: any[] = [];
let dbInvoiceLines: any[] = [];
let dbSubscriptions: any[] = [];
let dbBillingCycles: any[] = [];
let dbPayments: any[] = [];

const mockPrisma = {
  $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
  $disconnect: vi.fn().mockResolvedValue(undefined),

  invoice: {
    findUnique: vi.fn((args) => {
      const inv = dbInvoices.find((i) => {
        if (args.where.id) return i.id === args.where.id;
        if (args.where.idempotencyKey) return i.idempotencyKey === args.where.idempotencyKey;
        return false;
      });
      if (!inv) return Promise.resolve(null);
      const lines = dbInvoiceLines.filter((l) => l.invoiceId === inv.id);
      const payments = dbPayments.filter((p) => p.invoiceId === inv.id);
      return Promise.resolve({ ...inv, lines, payments });
    }),

    findMany: vi.fn((args) => {
      let res = [...dbInvoices];
      if (args?.where?.orderId) res = res.filter((i) => i.orderId === args.where.orderId);
      if (args?.where?.customerId) res = res.filter((i) => i.customerId === args.where.customerId);
      if (args?.where?.status) res = res.filter((i) => i.status === args.where.status);
      if (args?.where?.type) res = res.filter((i) => i.type === args.where.type);

      const skip = args?.skip || 0;
      const take = args?.take !== undefined ? args.take : res.length;
      return Promise.resolve(
        res.slice(skip, skip + take).map((inv) => ({
          ...inv,
          lines: dbInvoiceLines.filter((l) => l.invoiceId === inv.id),
          payments: dbPayments.filter((p) => p.invoiceId === inv.id),
        })),
      );
    }),

    count: vi.fn((args) => {
      let res = [...dbInvoices];
      if (args?.where?.orderId) res = res.filter((i) => i.orderId === args.where.orderId);
      if (args?.where?.customerId) res = res.filter((i) => i.customerId === args.where.customerId);
      if (args?.where?.status) res = res.filter((i) => i.status === args.where.status);
      return Promise.resolve(res.length);
    }),

    create: vi.fn((args) => {
      const inv = {
        id: `inv-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        companyId: args.data.companyId || 'default',
        orderId: args.data.orderId,
        customerId: args.data.customerId,
        type: args.data.type,
        status: args.data.status || 'DRAFT',
        currency: args.data.currency || 'USD',
        subtotal: args.data.subtotal,
        taxAmount: args.data.taxAmount || new Prisma.Decimal(0),
        totalAmount: args.data.totalAmount,
        dueDate: args.data.dueDate || null,
        paidAt: null,
        voidedAt: null,
        notes: args.data.notes || null,
        idempotencyKey: args.data.idempotencyKey || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbInvoices.push(inv);

      if (args.data.lines?.create) {
        for (const line of args.data.lines.create) {
          const l = {
            id: `line-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            invoiceId: inv.id,
            ...line,
          };
          dbInvoiceLines.push(l);
        }
      }

      return Promise.resolve({
        ...inv,
        lines: dbInvoiceLines.filter((l) => l.invoiceId === inv.id),
        payments: [],
      });
    }),

    update: vi.fn((args) => {
      const idx = dbInvoices.findIndex((i) => i.id === args.where.id);
      if (idx === -1) return Promise.resolve(null);
      dbInvoices[idx] = { ...dbInvoices[idx], ...args.data };
      return Promise.resolve({
        ...dbInvoices[idx],
        lines: dbInvoiceLines.filter((l) => l.invoiceId === args.where.id),
        payments: dbPayments.filter((p) => p.invoiceId === args.where.id),
      });
    }),
  },

  subscriptionLine: {
    findUnique: vi.fn((args) => {
      const sub = dbSubscriptions.find((s) => s.id === args.where.id);
      if (!sub) return Promise.resolve(null);
      const billingHistory = dbBillingCycles.filter((b) => b.subscriptionLineId === sub.id);
      return Promise.resolve({ ...sub, billingHistory });
    }),

    findMany: vi.fn((args) => {
      let res = [...dbSubscriptions];
      if (args?.where?.orderId) res = res.filter((s) => s.orderId === args.where.orderId);
      if (args?.where?.customerId) res = res.filter((s) => s.customerId === args.where.customerId);
      if (args?.where?.status) res = res.filter((s) => s.status === args.where.status);
      if (args?.where?.nextBillingDate) {
        if (args.where.nextBillingDate.lte) {
          res = res.filter((s) => new Date(s.nextBillingDate) <= new Date(args.where.nextBillingDate.lte));
        }
      }

      const skip = args?.skip || 0;
      const take = args?.take !== undefined ? args.take : res.length;
      return Promise.resolve(
        res.slice(skip, skip + take).map((s) => ({
          ...s,
          billingHistory: dbBillingCycles.filter((b) => b.subscriptionLineId === s.id),
        })),
      );
    }),

    count: vi.fn((args) => {
      let res = [...dbSubscriptions];
      if (args?.where?.orderId) res = res.filter((s) => s.orderId === args.where.orderId);
      if (args?.where?.customerId) res = res.filter((s) => s.customerId === args.where.customerId);
      if (args?.where?.status) res = res.filter((s) => s.status === args.where.status);
      return Promise.resolve(res.length);
    }),

    create: vi.fn((args) => {
      const sub = {
        id: `sub-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        companyId: args.data.companyId || 'default',
        orderId: args.data.orderId,
        customerId: args.data.customerId,
        planId: args.data.planId,
        planName: args.data.planName,
        interval: args.data.interval,
        unitPrice: args.data.unitPrice,
        quantity: args.data.quantity,
        currency: args.data.currency || 'USD',
        status: args.data.status || 'ACTIVE',
        startDate: args.data.startDate,
        currentPeriodStart: args.data.currentPeriodStart,
        currentPeriodEnd: args.data.currentPeriodEnd,
        nextBillingDate: args.data.nextBillingDate,
        cancelledAt: null,
        cancellationPolicy: args.data.cancellationPolicy || 'end_of_period',
        partialRefundPct: args.data.partialRefundPct || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbSubscriptions.push(sub);

      if (args.data.billingHistory?.create) {
        for (const b of args.data.billingHistory.create) {
          dbBillingCycles.push({
            id: `cycle-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            subscriptionLineId: sub.id,
            ...b,
          });
        }
      }

      return Promise.resolve({
        ...sub,
        billingHistory: dbBillingCycles.filter((b) => b.subscriptionLineId === sub.id),
      });
    }),

    update: vi.fn((args) => {
      const idx = dbSubscriptions.findIndex((s) => s.id === args.where.id);
      if (idx === -1) return Promise.resolve(null);
      dbSubscriptions[idx] = { ...dbSubscriptions[idx], ...args.data };
      return Promise.resolve({
        ...dbSubscriptions[idx],
        billingHistory: dbBillingCycles.filter((b) => b.subscriptionLineId === args.where.id),
      });
    }),
  },

  payment: {
    findUnique: vi.fn((args) => {
      if (args.where.idempotencyKey) {
        return Promise.resolve(dbPayments.find((p) => p.idempotencyKey === args.where.idempotencyKey) || null);
      }
      return Promise.resolve(null);
    }),

    findMany: vi.fn((args) => {
      let res = [...dbPayments];
      if (args?.where?.invoiceId) res = res.filter((p) => p.invoiceId === args.where.invoiceId);
      return Promise.resolve(res);
    }),

    create: vi.fn((args) => {
      const p = {
        id: `pay-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        companyId: args.data.companyId || 'default',
        invoiceId: args.data.invoiceId,
        amount: args.data.amount,
        currency: args.data.currency || 'USD',
        method: args.data.method,
        reference: args.data.reference || null,
        recordedBy: args.data.recordedBy,
        idempotencyKey: args.data.idempotencyKey || null,
        recordedAt: new Date(),
      };
      dbPayments.push(p);
      return Promise.resolve(p);
    }),
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateAuthToken(role: string = 'FINANCE', id: string = 'usr-001') {
  return jwt.sign(
    { sub: id, id, email: `${role.toLowerCase()}@test.com`, role, companyId: 'default' },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe('Billing Service API Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { buildApp } = await import('../../src/app');
    app = await buildApp({
      prisma: mockPrisma as any,
    });
    await app.ready();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    dbInvoices = [];
    dbInvoiceLines = [];
    dbSubscriptions = [];
    dbBillingCycles = [];
    dbPayments = [];
  });

  // ─── Health Check ─────────────────────────────────────────────────────────
  describe('GET /health', () => {
    it('returns healthy status when database is reachable', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.status).toBe('healthy');
      expect(json.service).toBe('billing-service');
      expect(json.version).toBe('1.0.0');
    });
  });

  // ─── CHECK-BILL-001: Quotation Confirmed Event ────────────────────────────
  describe('CHECK-BILL-001: Quotation Confirmed generates correct invoices and subscriptions', () => {
    it('splits non-recurring lines into ONE_TIME invoice and recurring into SubscriptionLine', async () => {
      const { BillingService } = await import('../../src/domain/services/billing.service');
      const { InvoiceRepository } = await import('../../src/db/repositories/invoice.repository');
      const { SubscriptionRepository } = await import('../../src/db/repositories/subscription.repository');
      const { PaymentRepository } = await import('../../src/db/repositories/payment.repository');
      const { BillingEventPublisher } = await import('../../src/events/publisher');

      const invoiceRepo = new InvoiceRepository(mockPrisma as any);
      const subRepo = new SubscriptionRepository(mockPrisma as any);
      const payRepo = new PaymentRepository(mockPrisma as any);
      const eventPublisher = new BillingEventPublisher(null);

      const billingService = new BillingService(invoiceRepo, subRepo, payRepo, eventPublisher);

      const result = await billingService.handleQuotationConfirmed({
        quotationId: 'quot-101',
        companyId: 'default',
        customerId: 'cust-101',
        currency: 'USD',
        totalAmount: 6498,
        lines: [
          {
            productId: 'hw-01',
            productName: 'Server Blade A',
            quantity: 2,
            unitPrice: 2000,
            isRecurring: false,
          },
          {
            productId: 'hw-02',
            productName: 'Rack Switch 48P',
            quantity: 1,
            unitPrice: 1500,
            isRecurring: false,
          },
          {
            productId: 'sub-plan-pro',
            productName: 'ProSupport Monthly',
            planId: 'plan-pro',
            planInterval: 'MONTHLY',
            quantity: 5,
            unitPrice: 49.99,
            isRecurring: true,
          },
        ],
      });

      // 1. ONE_TIME Invoice created for 2 hardware lines
      expect(result.invoice).toBeDefined();
      expect(result.invoice?.type).toBe(InvoiceType.ONE_TIME);
      expect(Number(result.invoice?.totalAmount)).toBe(5500);
      expect(result.invoice?.lines.length).toBe(2);

      // 2. SubscriptionLine created for recurring line
      expect(result.subscriptions.length).toBe(1);
      const sub = result.subscriptions[0];
      expect(sub.planName).toBe('ProSupport Monthly');
      expect(sub.quantity).toBe(5);
      expect(Number(sub.unitPrice)).toBe(49.99);
      expect(sub.interval).toBe('MONTHLY');
      expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
    });
  });

  // ─── CHECK-BILL-002: Record Payment ───────────────────────────────────────
  describe('CHECK-BILL-002: Record Payment on Invoice', () => {
    it('records full payment, transitions invoice to PAID and sets paidAt', async () => {
      // Seed an invoice in SENT status
      const seedInvoice = await mockPrisma.invoice.create({
        data: {
          companyId: 'default',
          orderId: 'quot-001',
          customerId: 'cust-001',
          type: InvoiceType.ONE_TIME,
          status: InvoiceStatus.SENT,
          subtotal: new Prisma.Decimal(5720),
          totalAmount: new Prisma.Decimal(5720),
          lines: {
            create: [
              {
                productId: 'prod-01',
                description: 'Enterprise Licenses',
                quantity: 1,
                unitPrice: new Prisma.Decimal(5720),
                lineTotal: new Prisma.Decimal(5720),
              },
            ],
          },
        },
      });

      const token = generateAuthToken('FINANCE');

      const res = await app.inject({
        method: 'POST',
        url: `/billing/invoices/${seedInvoice.id}/payments`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        payload: {
          amount: '5720.00',
          currency: 'USD',
          method: 'bank_transfer',
          reference: 'TXN-20260905-001',
          idempotencyKey: 'payment-uuid-unique',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.invoiceId).toBe(seedInvoice.id);
      expect(json.status).toBe(InvoiceStatus.PAID);
      expect(json.paidAt).toBeDefined();
      expect(json.payment).toBeDefined();
      expect(Number(json.payment.amount)).toBe(5720);
      expect(json.payment.method).toBe('bank_transfer');
      expect(json.payment.reference).toBe('TXN-20260905-001');
    });
  });

  // ─── CHECK-BILL-003: Idempotent Payment ───────────────────────────────────
  describe('CHECK-BILL-003: Idempotent Payment Prevention', () => {
    it('returns original payment when called twice with same idempotency key and does not duplicate', async () => {
      const seedInvoice = await mockPrisma.invoice.create({
        data: {
          companyId: 'default',
          orderId: 'quot-002',
          customerId: 'cust-002',
          type: InvoiceType.ONE_TIME,
          status: InvoiceStatus.SENT,
          subtotal: new Prisma.Decimal(1200),
          totalAmount: new Prisma.Decimal(1200),
          lines: {
            create: [
              {
                productId: 'prod-02',
                description: 'Consulting block',
                quantity: 1,
                unitPrice: new Prisma.Decimal(1200),
                lineTotal: new Prisma.Decimal(1200),
              },
            ],
          },
        },
      });

      const token = generateAuthToken('FINANCE');
      const idempotencyKey = 'idemp-key-test-123';

      // First call
      const res1 = await app.inject({
        method: 'POST',
        url: `/billing/invoices/${seedInvoice.id}/payments`,
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          amount: '1200.00',
          currency: 'USD',
          method: 'card',
          idempotencyKey,
        },
      });

      expect(res1.statusCode).toBe(200);
      const json1 = res1.json();
      expect(json1.status).toBe(InvoiceStatus.PAID);

      // Second call with same idempotencyKey
      const res2 = await app.inject({
        method: 'POST',
        url: `/billing/invoices/${seedInvoice.id}/payments`,
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          amount: '1200.00',
          currency: 'USD',
          method: 'card',
          idempotencyKey,
        },
      });

      expect(res2.statusCode).toBe(200);
      const json2 = res2.json();
      expect(json2.status).toBe(InvoiceStatus.PAID);
      expect(json2.payment.id).toBe(json1.payment.id);

      // Assert only 1 payment was created
      const matchingPayments = dbPayments.filter((p) => p.invoiceId === seedInvoice.id);
      expect(matchingPayments.length).toBe(1);
    });
  });

  // ─── CHECK-BILL-004: Mid-Cycle Quantity Change & Proration ────────────────
  describe('CHECK-BILL-004: Mid-cycle Quantity Change Proration', () => {
    it('computes daily proration and creates adjustment invoice', async () => {
      const now = new Date('2026-09-01T00:00:00Z');
      const periodEnd = new Date('2026-10-01T00:00:00Z'); // 30 days
      const changeDate = '2026-09-16T00:00:00Z'; // exactly 15 days remaining

      const seedSub = await mockPrisma.subscriptionLine.create({
        data: {
          companyId: 'default',
          orderId: 'quot-003',
          customerId: 'cust-003',
          planId: 'plan-pro',
          planName: 'ProSupport Monthly',
          interval: 'MONTHLY',
          unitPrice: new Prisma.Decimal(49.99),
          quantity: 5,
          currency: 'USD',
          status: SubscriptionStatus.ACTIVE,
          startDate: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextBillingDate: periodEnd,
        },
      });

      const token = generateAuthToken('SALES_REP');

      const res = await app.inject({
        method: 'PUT',
        url: `/billing/subscriptions/${seedSub.id}/quantity`,
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          newQuantity: 8,
          changeDate,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.subscriptionId).toBe(seedSub.id);
      expect(json.oldQuantity).toBe(5);
      expect(json.newQuantity).toBe(8);
      expect(json.adjustmentInvoiceId).toBeDefined();
      expect(json.proration).toBeDefined();
      expect(json.proration.netAmount).toBeCloseTo(74.985, 1);
      expect(json.proration.creditNote).toBe(false);

      // Verify adjustment invoice created
      const adjInvoice = dbInvoices.find((i) => i.id === json.adjustmentInvoiceId);
      expect(adjInvoice).toBeDefined();
      expect(adjInvoice.type).toBe(InvoiceType.PRORATION);
      expect(adjInvoice.status).toBe(InvoiceStatus.SENT);
    });
  });

  // ─── CHECK-BILL-005: Cancellation & Credit Note ───────────────────────────
  describe('CHECK-BILL-005: Cancellation with Partial Refund', () => {
    it('cancels subscription immediately and generates credit note invoice for 50% remaining', async () => {
      const now = new Date('2026-09-01T00:00:00Z');
      const periodEnd = new Date('2026-10-01T00:00:00Z');
      const cancelDate = '2026-09-16T00:00:00Z'; // 15 / 30 = 50% remaining

      const seedSub = await mockPrisma.subscriptionLine.create({
        data: {
          companyId: 'default',
          orderId: 'quot-004',
          customerId: 'cust-004',
          planId: 'plan-enterprise',
          planName: 'Enterprise Cloud Support',
          interval: 'MONTHLY',
          unitPrice: new Prisma.Decimal(100),
          quantity: 5, // total $500
          currency: 'USD',
          status: SubscriptionStatus.ACTIVE,
          startDate: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextBillingDate: periodEnd,
          cancellationPolicy: 'immediate',
          partialRefundPct: 50, // 50% of remaining $250 = $125
        },
      });

      const token = generateAuthToken('SALES_REP');

      const res = await app.inject({
        method: 'POST',
        url: `/billing/subscriptions/${seedSub.id}/cancel`,
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          cancelledAt: cancelDate,
          reason: 'Customer downsizing operations',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.subscriptionId).toBe(seedSub.id);
      expect(json.status).toBe('CANCELLED');
      expect(json.creditNoteInvoiceId).toBeDefined();
      expect(json.creditNoteAmount).toBeCloseTo(125, 0);

      // Verify credit note invoice created
      const creditNote = dbInvoices.find((i) => i.id === json.creditNoteInvoiceId);
      expect(creditNote).toBeDefined();
      expect(creditNote.type).toBe(InvoiceType.CREDIT_NOTE);
      expect(creditNote.status).toBe(InvoiceStatus.CREDIT_NOTE);
    });
  });

  // ─── CHECK-BILL-006: Billing Schedule ─────────────────────────────────────
  describe('CHECK-BILL-006: Order Billing Schedule', () => {
    it('returns combined one-time invoice and projected recurring lines for an order', async () => {
      const orderId = 'order-sch-999';

      // 1. One-time invoice
      await mockPrisma.invoice.create({
        data: {
          companyId: 'default',
          orderId,
          customerId: 'cust-999',
          type: InvoiceType.ONE_TIME,
          status: InvoiceStatus.SENT,
          subtotal: new Prisma.Decimal(6498),
          totalAmount: new Prisma.Decimal(6498),
          dueDate: new Date('2026-09-20T00:00:00Z'),
          lines: {
            create: [
              {
                productId: 'hw-99',
                description: 'Server Rack',
                quantity: 1,
                unitPrice: new Prisma.Decimal(6498),
                lineTotal: new Prisma.Decimal(6498),
              },
            ],
          },
        },
      });

      // 2. Subscription line
      await mockPrisma.subscriptionLine.create({
        data: {
          companyId: 'default',
          orderId,
          customerId: 'cust-999',
          planId: 'plan-pro',
          planName: 'ProSupport Monthly',
          interval: 'MONTHLY',
          unitPrice: new Prisma.Decimal(49.99),
          quantity: 5,
          currency: 'USD',
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date('2026-09-05T00:00:00Z'),
          currentPeriodStart: new Date('2026-09-05T00:00:00Z'),
          currentPeriodEnd: new Date('2026-10-05T00:00:00Z'),
          nextBillingDate: new Date('2026-10-05T00:00:00Z'),
        },
      });

      const token = generateAuthToken('SALES_REP');

      const res = await app.inject({
        method: 'GET',
        url: `/billing/schedules?orderId=${orderId}`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.orderId).toBe(orderId);
      expect(json.oneTimeInvoice).toBeDefined();
      expect(json.oneTimeInvoice.amount).toBe('6498.00');
      expect(json.oneTimeInvoice.status).toBe('SENT');
      expect(json.recurringLines.length).toBe(1);

      const rec = json.recurringLines[0];
      expect(rec.planName).toBe('ProSupport Monthly');
      expect(rec.quantity).toBe(5);
      expect(rec.unitPrice).toBe('49.99');
      expect(rec.schedule.length).toBe(2);
      expect(rec.schedule[0].amount).toBe('249.95');
      expect(rec.schedule[1].amount).toBe('249.95');
    });
  });

  // ─── Additional Route Tests ───────────────────────────────────────────────
  describe('Invoices & Subscriptions List & Void', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/billing/invoices',
      });
      expect(res.statusCode).toBe(401);
    });

    it('voids an unpaid invoice', async () => {
      const invoice = await mockPrisma.invoice.create({
        data: {
          companyId: 'default',
          orderId: 'quot-void-1',
          customerId: 'cust-1',
          type: InvoiceType.ONE_TIME,
          status: InvoiceStatus.SENT,
          subtotal: new Prisma.Decimal(100),
          totalAmount: new Prisma.Decimal(100),
        },
      });

      const token = generateAuthToken('FINANCE');

      const res = await app.inject({
        method: 'POST',
        url: `/billing/invoices/${invoice.id}/void`,
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.status).toBe(InvoiceStatus.VOIDED);
    });

    it('lists upcoming renewals', async () => {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 10);

      await mockPrisma.subscriptionLine.create({
        data: {
          companyId: 'default',
          orderId: 'quot-up-1',
          customerId: 'cust-1',
          planId: 'plan-1',
          planName: 'Plan 1',
          interval: 'MONTHLY',
          unitPrice: new Prisma.Decimal(100),
          quantity: 1,
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date(),
          currentPeriodStart: new Date(),
          currentPeriodEnd: nextDate,
          nextBillingDate: nextDate,
        },
      });

      const token = generateAuthToken('SALES_REP');

      const res = await app.inject({
        method: 'GET',
        url: '/billing/subscriptions/upcoming?days=30',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBe(1);
    });
  });
});
