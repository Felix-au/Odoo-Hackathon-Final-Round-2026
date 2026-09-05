/**
 * Quotation Service — API Integration Tests
 *
 * Tests run against an in-memory Fastify instance with mocked Prisma and Redis.
 * Verifies all documented checkpoints:
 * - CHECK-QUOT-001: Full quotation lifecycle (create, add lines, blended risk score, live margin)
 * - CHECK-QUOT-002: Blended risk score triggers approval routing (PENDING_MANAGER_APPROVAL)
 * - CHECK-QUOT-003: Rejection creates immutable audit log with reason
 * - CHECK-QUOT-004: Portal customer negotiation re-triggers approval when thresholds exceeded
 * - CHECK-QUOT-005: Customer confirms via portal -> status CONFIRMED
 * - CHECK-QUOT-006: Idempotent confirmation prevents duplicate processing
 * - CHECK-QUOT-007: Live margin update on discount change
 * - CHECK-QUOT-008: Access control (SALES_REP isolation & Portal isolation)
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

// ─── Environment ─────────────────────────────────────────────────────────────
const TEST_JWT_SECRET = 'dev_jwt_secret_change_in_prod_must_be_64_chars_minimum_dev_only_x';
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3003';
process.env['QUOTATION_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/quotation_test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['JWT_SECRET'] = TEST_JWT_SECRET;
process.env['SERVICE_TOKEN'] = 'test-service-token-1234567890';

// ─── Mock Redis ──────────────────────────────────────────────────────────────
vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    ping: vi.fn().mockResolvedValue('PONG'),
    xadd: vi.fn().mockResolvedValue('msg-123'),
    xgroup: vi.fn().mockResolvedValue('OK'),
    xreadgroup: vi.fn().mockResolvedValue(null),
    xack: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    disconnect: vi.fn(),
  }));
  return { default: MockRedis };
});

// ─── Mock In-Memory Database ──────────────────────────────────────────────────
let dbCustomers: any[] = [];
let dbQuotations: any[] = [];
let dbQuotationLines: any[] = [];
let dbApprovalLogs: any[] = [];
let dbNegotiations: any[] = [];

const mockPrisma = {
  customer: {
    findUnique: vi.fn((args) => {
      if (args.where.id) {
        return Promise.resolve(dbCustomers.find((c) => c.id === args.where.id) || null);
      }
      if (args.where.companyId_email) {
        return Promise.resolve(
          dbCustomers.find(
            (c) =>
              c.companyId === args.where.companyId_email.companyId &&
              c.email === args.where.companyId_email.email,
          ) || null,
        );
      }
      return Promise.resolve(null);
    }),
    findMany: vi.fn(() => Promise.resolve([...dbCustomers])),
    count: vi.fn(() => Promise.resolve(dbCustomers.length)),
    create: vi.fn((args) => {
      const customer = { id: `cust-${Date.now()}-${Math.random()}`, ...args.data };
      dbCustomers.push(customer);
      return Promise.resolve(customer);
    }),
    update: vi.fn((args) => {
      const idx = dbCustomers.findIndex((c) => c.id === args.where.id);
      if (idx !== -1) {
        dbCustomers[idx] = { ...dbCustomers[idx], ...args.data };
        return Promise.resolve(dbCustomers[idx]);
      }
      return Promise.resolve(null);
    }),
  },

  quotation: {
    findUnique: vi.fn((args) => {
      const q = dbQuotations.find((item) => {
        if (args.where.id) return item.id === args.where.id;
        if (args.where.idempotencyKey) return item.idempotencyKey === args.where.idempotencyKey;
        return false;
      });
      if (!q) return Promise.resolve(null);

      const customer = dbCustomers.find((c) => c.id === q.customerId) || { name: 'Acme Corp', tier: 'GOLD' };
      const lines = dbQuotationLines.filter((l) => l.quotationId === q.id);
      const approvalLogs = dbApprovalLogs.filter((a) => a.quotationId === q.id);
      const negotiations = dbNegotiations.filter((n) => n.quotationId === q.id);

      return Promise.resolve({
        ...q,
        customer,
        lines,
        approvalLogs,
        negotiations,
      });
    }),

    findMany: vi.fn((args) => {
      let filtered = [...dbQuotations];
      if (args?.where?.companyId) {
        filtered = filtered.filter((q) => q.companyId === args.where.companyId);
      }
      if (args?.where?.repId) {
        filtered = filtered.filter((q) => q.repId === args.where.repId);
      }
      if (args?.where?.status) {
        filtered = filtered.filter((q) => q.status === args.where.status);
      }

      return Promise.resolve(
        filtered.map((q) => ({
          ...q,
          customer: dbCustomers.find((c) => c.id === q.customerId) || { name: 'Acme', tier: 'GOLD' },
          lines: dbQuotationLines.filter((l) => l.quotationId === q.id),
        })),
      );
    }),

    count: vi.fn(() => Promise.resolve(dbQuotations.length)),

    create: vi.fn((args) => {
      const q = {
        id: `quot-${Date.now()}-${Math.random()}`,
        version: 1,
        blendedRiskScore: 0,
        totalAmount: new Prisma.Decimal(0),
        totalMarginPct: 0,
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        ...args.data,
      };
      dbQuotations.push(q);
      const customer = dbCustomers.find((c) => c.id === q.customerId) || { name: 'Acme', tier: 'GOLD' };
      return Promise.resolve({ ...q, customer, lines: [] });
    }),

    update: vi.fn((args) => {
      const idx = dbQuotations.findIndex((q) => q.id === args.where.id);
      if (idx !== -1) {
        const current = dbQuotations[idx];
        let newVersion = current.version;
        if (args.data.version?.increment) {
          newVersion += 1;
        }

        dbQuotations[idx] = {
          ...current,
          ...args.data,
          version: newVersion,
          updatedAt: new Date(),
          lastActivityAt: new Date(),
        };

        const customer = dbCustomers.find((c) => c.id === current.customerId) || { name: 'Acme', tier: 'GOLD' };
        const lines = dbQuotationLines.filter((l) => l.quotationId === current.id);
        const approvalLogs = dbApprovalLogs.filter((a) => a.quotationId === current.id);
        const negotiations = dbNegotiations.filter((n) => n.quotationId === current.id);

        return Promise.resolve({
          ...dbQuotations[idx],
          customer,
          lines,
          approvalLogs,
          negotiations,
        });
      }
      return Promise.resolve(null);
    }),

    delete: vi.fn((args) => {
      dbQuotations = dbQuotations.filter((q) => q.id !== args.where.id);
      dbQuotationLines = dbQuotationLines.filter((l) => l.quotationId !== args.where.id);
      return Promise.resolve({ id: args.where.id });
    }),
  },

  quotationLine: {
    findUnique: vi.fn((args) => {
      const line = dbQuotationLines.find((l) => l.id === args.where.id);
      return Promise.resolve(line || null);
    }),
    findMany: vi.fn((args) => {
      const lines = dbQuotationLines.filter((l) => l.quotationId === args.where.quotationId);
      return Promise.resolve(lines);
    }),
    create: vi.fn((args) => {
      const line = { id: `line-${Date.now()}-${Math.random()}`, ...args.data };
      dbQuotationLines.push(line);
      return Promise.resolve(line);
    }),
    update: vi.fn((args) => {
      const idx = dbQuotationLines.findIndex((l) => l.id === args.where.id);
      if (idx !== -1) {
        dbQuotationLines[idx] = { ...dbQuotationLines[idx], ...args.data };
        return Promise.resolve(dbQuotationLines[idx]);
      }
      return Promise.resolve(null);
    }),
    delete: vi.fn((args) => {
      dbQuotationLines = dbQuotationLines.filter((l) => l.id !== args.where.id);
      return Promise.resolve({ id: args.where.id });
    }),
  },

  approvalLog: {
    create: vi.fn((args) => {
      const log = { id: `log-${Date.now()}`, createdAt: new Date(), ...args.data };
      dbApprovalLogs.push(log);
      return Promise.resolve(log);
    }),
    findMany: vi.fn((args) => {
      const logs = dbApprovalLogs.filter((a) => a.quotationId === args.where.quotationId);
      return Promise.resolve(logs);
    }),
  },

  customerNegotiation: {
    create: vi.fn((args) => {
      const neg = { id: `neg-${Date.now()}`, createdAt: new Date(), ...args.data };
      dbNegotiations.push(neg);
      return Promise.resolve(neg);
    }),
    findMany: vi.fn((args) => {
      const negs = dbNegotiations.filter((n) => n.quotationId === args.where.quotationId);
      return Promise.resolve(negs);
    }),
    update: vi.fn((args) => {
      const idx = dbNegotiations.findIndex((n) => n.id === args.where.id);
      if (idx !== -1) {
        dbNegotiations[idx] = { ...dbNegotiations[idx], ...args.data };
        return Promise.resolve(dbNegotiations[idx]);
      }
      return Promise.resolve(null);
    }),
  },

  $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  $disconnect: vi.fn(),
};

vi.mock('@prisma/client', async () => {
  const actual = await vi.importActual('@prisma/client');
  return {
    ...actual,
    PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeToken(
  role: string = 'SALES_REP',
  userId: string = 'rep-user-1',
  companyId: string = 'default',
) {
  return jwt.sign(
    { sub: userId, id: userId, email: `${userId}@example.com`, role, companyId },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

let app: FastifyInstance;

beforeAll(async () => {
  // Seed an initial customer
  dbCustomers = [
    {
      id: 'cust-acme-1',
      companyId: 'default',
      name: 'Acme Corporation',
      email: 'acme@example.com',
      tier: 'GOLD',
      currency: 'USD',
      hasPortalAccess: true,
    },
    {
      id: 'cust-beta-2',
      companyId: 'default',
      name: 'Beta Logistics',
      email: 'beta@example.com',
      tier: 'SILVER',
      currency: 'USD',
      hasPortalAccess: true,
    },
  ];
  dbQuotations = [];
  dbQuotationLines = [];
  dbApprovalLogs = [];
  dbNegotiations = [];

  const { buildApp } = await import('../../src/app');
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('Quotation API Endpoints & Checkpoints', () => {
  let createdQuotationId: string;
  let serviceLineId: string;

  it('GET /health returns healthy status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('quotation-service');
  });

  // ─── CHECK-QUOT-001: Full quotation lifecycle ──────────────────────────────
  it('CHECK-QUOT-001: full quotation lifecycle — create, add lines, risk score, margin', async () => {
    const repToken = makeToken('SALES_REP', 'rep-user-1');

    // 1. Create quotation
    const createRes = await app.inject({
      method: 'POST',
      url: '/quotations',
      headers: { Authorization: `Bearer ${repToken}` },
      payload: {
        customerId: 'cust-acme-1',
        currency: 'USD',
        notes: 'Strategic Enterprise Deal',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const quote = JSON.parse(createRes.body);
    expect(quote.status).toBe('DRAFT');
    expect(quote.customerId).toBe('cust-acme-1');
    createdQuotationId = quote.id;

    // 2. Add Hardware line (12% discount, ceiling 15% -> compliant)
    const line1Res = await app.inject({
      method: 'POST',
      url: `/quotations/${createdQuotationId}/lines`,
      headers: { Authorization: `Bearer ${repToken}` },
      payload: {
        productId: 'prod-hw-1',
        productName: 'Enterprise Laptop Pro',
        categoryId: 'cat-hardware',
        categoryName: 'Hardware',
        quantity: 5,
        unitPrice: 1000.0,
        costPrice: 700.0,
        discountPct: 12.0,
      },
    });

    expect(line1Res.statusCode).toBe(200);
    const quoteWithLine1 = JSON.parse(line1Res.body);
    expect(quoteWithLine1.lines.length).toBe(1);

    // 3. Add Service line (18% discount, ceiling 10% -> violation)
    const line2Res = await app.inject({
      method: 'POST',
      url: `/quotations/${createdQuotationId}/lines`,
      headers: { Authorization: `Bearer ${repToken}` },
      payload: {
        productId: 'prod-svc-1',
        productName: 'Enterprise Setup Service',
        categoryId: 'cat-service',
        categoryName: 'Services',
        quantity: 2,
        unitPrice: 2000.0,
        costPrice: 1000.0,
        discountPct: 18.0,
      },
    });

    expect(line2Res.statusCode).toBe(200);
    const quoteWithLine2 = JSON.parse(line2Res.body);
    expect(quoteWithLine2.lines.length).toBe(2);
    expect(quoteWithLine2.blendedRiskScore).toBeGreaterThan(0);
    expect(quoteWithLine2.totalMarginPct).toBeGreaterThan(0);

    serviceLineId = quoteWithLine2.lines[1].id;
  });

  // ─── CHECK-QUOT-007: Live margin indicator ─────────────────────────────────
  it('CHECK-QUOT-007: live margin update on line update', async () => {
    const repToken = makeToken('SALES_REP', 'rep-user-1');

    const updateRes = await app.inject({
      method: 'PUT',
      url: `/quotations/${createdQuotationId}/lines/${serviceLineId}`,
      headers: { Authorization: `Bearer ${repToken}` },
      payload: {
        discountPct: 19.0,
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const body = JSON.parse(updateRes.body);
    expect(body.blendedRiskScore).toBeGreaterThan(0);
    expect(body.totalMarginPct).toBeDefined();
    expect(body.lineViolations.length).toBe(2);
  });

  // ─── CHECK-QUOT-002: Submit triggers approval routing ──────────────────────
  it('CHECK-QUOT-002: submit quotation triggers approval routing to PENDING_MANAGER_APPROVAL', async () => {
    const repToken = makeToken('SALES_REP', 'rep-user-1');

    const submitRes = await app.inject({
      method: 'POST',
      url: `/quotations/${createdQuotationId}/submit`,
      headers: { Authorization: `Bearer ${repToken}` },
    });

    expect(submitRes.statusCode).toBe(200);
    const body = JSON.parse(submitRes.body);
    expect(body.status).toBe('PENDING_MANAGER_APPROVAL');
    expect(body.approvalRequired).toBe(true);
  });

  // ─── CHECK-QUOT-003: Rejection creates audit log ───────────────────────────
  it('CHECK-QUOT-003: rejection creates immutable audit log with reason', async () => {
    const mgrToken = makeToken('SALES_MANAGER', 'mgr-user-1');

    const rejectRes = await app.inject({
      method: 'POST',
      url: `/quotations/${createdQuotationId}/reject`,
      headers: { Authorization: `Bearer ${mgrToken}` },
      payload: {
        reason: 'Service discount exceeds maximum policy of 15%',
      },
    });

    expect(rejectRes.statusCode).toBe(200);
    const body = JSON.parse(rejectRes.body);
    expect(body.status).toBe('REJECTED');
    expect(body.approvalLogs.length).toBeGreaterThan(0);

    const log = body.approvalLogs[0];
    expect(log.action).toBe('APPROVE' ? 'REJECT' : 'REJECT');
    expect(log.reason).toBe('Service discount exceeds maximum policy of 15%');
  });

  // ─── Resubmit & Approve flow ───────────────────────────────────────────────
  it('allows rep to resubmit and manager to approve', async () => {
    const repToken = makeToken('SALES_REP', 'rep-user-1');
    const mgrToken = makeToken('SALES_MANAGER', 'mgr-user-1');

    // Resubmit from REJECTED
    const resubmitRes = await app.inject({
      method: 'POST',
      url: `/quotations/${createdQuotationId}/submit`,
      headers: { Authorization: `Bearer ${repToken}` },
    });
    expect(resubmitRes.statusCode).toBe(200);

    // Manager approves
    const approveRes = await app.inject({
      method: 'POST',
      url: `/quotations/${createdQuotationId}/approve`,
      headers: { Authorization: `Bearer ${mgrToken}` },
      payload: {
        reason: 'Approved for Q3 enterprise quota',
      },
    });
    expect(approveRes.statusCode).toBe(200);

    // Send to customer
    const sendRes = await app.inject({
      method: 'POST',
      url: `/quotations/${createdQuotationId}/send`,
      headers: { Authorization: `Bearer ${repToken}` },
    });
    expect(sendRes.statusCode).toBe(200);
    expect(JSON.parse(sendRes.body).status).toBe('SENT');
  });

  // ─── CHECK-QUOT-004: Portal customer negotiation ───────────────────────────
  it('CHECK-QUOT-004: portal customer negotiation re-triggers approval when thresholds exceeded', async () => {
    const negotiateRes = await app.inject({
      method: 'POST',
      url: `/portal/quotations/${createdQuotationId}/negotiate`,
      headers: { 'x-portal-customer-id': 'cust-acme-1' },
      payload: {
        message: 'Could we get an additional discount across the order?',
        proposedDiscount: 25.0,
      },
    });

    expect(negotiateRes.statusCode).toBe(200);
    const body = JSON.parse(negotiateRes.body);
    expect(body.reEnteredApproval).toBe(true);
    expect(body.status).toBe('PENDING_MANAGER_APPROVAL');
  });

  // ─── Re-approve after negotiation ──────────────────────────────────────────
  it('manager re-approves after negotiation', async () => {
    const mgrToken = makeToken('SALES_MANAGER', 'mgr-user-1');

    const approveRes = await app.inject({
      method: 'POST',
      url: `/quotations/${createdQuotationId}/approve`,
      headers: { Authorization: `Bearer ${mgrToken}` },
      payload: { reason: 'Concession approved' },
    });
    expect(approveRes.statusCode).toBe(200);
  });

  // ─── CHECK-QUOT-005 & CHECK-QUOT-006: Customer Confirmation & Idempotency ───
  it('CHECK-QUOT-005 & CHECK-QUOT-006: customer confirms with idempotency key', async () => {
    const idempotencyKey = 'unique-checkout-token-999';

    // First confirmation request
    const confirmRes1 = await app.inject({
      method: 'POST',
      url: `/portal/quotations/${createdQuotationId}/confirm`,
      headers: {
        'x-portal-customer-id': 'cust-acme-1',
        'idempotency-key': idempotencyKey,
      },
    });

    expect(confirmRes1.statusCode).toBe(200);
    const body1 = JSON.parse(confirmRes1.body);
    expect(body1.status).toBe('CONFIRMED');
    expect(body1.confirmedAt).toBeDefined();

    // Duplicate confirmation request (idempotent duplicate prevention)
    const confirmRes2 = await app.inject({
      method: 'POST',
      url: `/portal/quotations/${createdQuotationId}/confirm`,
      headers: {
        'x-portal-customer-id': 'cust-acme-1',
        'idempotency-key': idempotencyKey,
      },
    });

    expect(confirmRes2.statusCode).toBe(200);
    const body2 = JSON.parse(confirmRes2.body);
    expect(body2.status).toBe('CONFIRMED');
  });

  // ─── CHECK-QUOT-008: Access Control ────────────────────────────────────────
  it('CHECK-QUOT-008: SALES_REP cannot view another reps quotation', async () => {
    const otherRepToken = makeToken('SALES_REP', 'rep-user-other');

    const res = await app.inject({
      method: 'GET',
      url: `/quotations/${createdQuotationId}`,
      headers: { Authorization: `Bearer ${otherRepToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('CHECK-QUOT-008: Portal customer cannot view another customers quotation', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/portal/quotations/${createdQuotationId}`,
      headers: { 'x-portal-customer-id': 'cust-other-company' },
    });

    expect(res.statusCode).toBe(403);
  });

  // ─── Pipeline / Kanban ─────────────────────────────────────────────────────
  it('GET /quotations/pipeline returns Kanban board groups', async () => {
    const repToken = makeToken('SALES_REP', 'rep-user-1');

    const res = await app.inject({
      method: 'GET',
      url: '/quotations/pipeline',
      headers: { Authorization: `Bearer ${repToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.CONFIRMED.count).toBeGreaterThan(0);
    expect(body.data.DRAFT).toBeDefined();
    expect(body.data.PENDING_MANAGER_APPROVAL).toBeDefined();
  });
});
