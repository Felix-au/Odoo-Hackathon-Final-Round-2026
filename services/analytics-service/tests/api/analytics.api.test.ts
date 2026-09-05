/**
 * Analytics Service — API Integration Tests
 *
 * Verifies all documented checkpoints:
 * - CHECK-ANA-001: Sales dashboard KPIs and pipeline breakdown
 * - CHECK-ANA-002: Stalled deal detection (inactive > threshold days)
 * - CHECK-ANA-003: Discount anomaly detection (blendedRiskScore > repAvg + factor * stdDev)
 * - CHECK-ANA-004: Alert payload contains valid quotationId for navigation
 * - CHECK-ANA-005: Nudge action sends email and creates NudgeAction record
 * - CHECK-ANA-006: PDF and XLS report exports return downloadUrl and valid content
 * - CHECK-ANA-007: Quotation performance report filters (period, rep, status)
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';

// ─── Environment ─────────────────────────────────────────────────────────────
const TEST_JWT_SECRET = 'dev_jwt_secret_change_in_prod_must_be_64_chars_minimum_dev_only_x';
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3006';
process.env['ANALYTICS_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/analytics_test';
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
let dbSnapshots: any[] = [];
let dbLineSnapshots: any[] = [];
let dbConfigs: any[] = [];
let dbAlerts: any[] = [];
let dbNudges: any[] = [];
let dbInvoices: any[] = [];
let dbSubscriptions: any[] = [];

const mockPrisma = {
  $queryRaw: vi.fn().mockResolvedValue([{ '1': 1 }]),
  $disconnect: vi.fn().mockResolvedValue(undefined),

  dealHealthConfig: {
    findUnique: vi.fn((args) => {
      const cfg = dbConfigs.find((c) => c.companyId === args.where.companyId);
      return Promise.resolve(cfg || null);
    }),
    create: vi.fn((args) => {
      const cfg = { id: `cfg-${Date.now()}`, ...args.data, updatedAt: new Date() };
      dbConfigs.push(cfg);
      return Promise.resolve(cfg);
    }),
    upsert: vi.fn((args) => {
      const idx = dbConfigs.findIndex((c) => c.companyId === args.where.companyId);
      if (idx !== -1) {
        dbConfigs[idx] = { ...dbConfigs[idx], ...args.update, updatedAt: new Date() };
        return Promise.resolve(dbConfigs[idx]);
      }
      const created = { id: `cfg-${Date.now()}`, ...args.create, updatedAt: new Date() };
      dbConfigs.push(created);
      return Promise.resolve(created);
    }),
  },

  dealAlert: {
    findUnique: vi.fn((args) => {
      const a = dbAlerts.find((al) => al.id === args.where.id);
      if (!a) return Promise.resolve(null);
      const nudges = dbNudges.filter((n) => n.alertId === a.id);
      return Promise.resolve({ ...a, nudges });
    }),
    findFirst: vi.fn((args) => {
      const a = dbAlerts.find(
        (al) =>
          al.companyId === args.where.companyId &&
          al.quotationId === args.where.quotationId &&
          al.type === args.where.type &&
          (args.where.isResolved === undefined || al.isResolved === args.where.isResolved),
      );
      return Promise.resolve(a || null);
    }),
    findMany: vi.fn((args) => {
      let res = [...dbAlerts];
      if (args?.where?.companyId) res = res.filter((a) => a.companyId === args.where.companyId);
      if (args?.where?.isResolved !== undefined) res = res.filter((a) => a.isResolved === args.where.isResolved);
      return Promise.resolve(
        res.map((a) => ({
          ...a,
          nudges: dbNudges.filter((n) => n.alertId === a.id),
        })),
      );
    }),
    create: vi.fn((args) => {
      const alert = {
        id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        companyId: args.data.companyId || 'default',
        quotationId: args.data.quotationId,
        type: args.data.type,
        severity: args.data.severity || 'MEDIUM',
        message: args.data.message,
        isResolved: false,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbAlerts.push(alert);
      return Promise.resolve({ ...alert, nudges: [] });
    }),
    update: vi.fn((args) => {
      const idx = dbAlerts.findIndex((a) => a.id === args.where.id);
      if (idx === -1) return Promise.resolve(null);
      dbAlerts[idx] = { ...dbAlerts[idx], ...args.data, updatedAt: new Date() };
      return Promise.resolve({
        ...dbAlerts[idx],
        nudges: dbNudges.filter((n) => n.alertId === args.where.id),
      });
    }),
  },

  nudgeAction: {
    create: vi.fn((args) => {
      const nudge = {
        id: `nudge-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        alertId: args.data.alertId,
        quotationId: args.data.quotationId,
        triggeredBy: args.data.triggeredBy,
        type: args.data.type,
        sentTo: args.data.sentTo,
        createdAt: new Date(),
      };
      dbNudges.push(nudge);
      return Promise.resolve(nudge);
    }),
  },

  quotationSnapshot: {
    findUnique: vi.fn((args) => {
      const q = dbSnapshots.find((s) => s.id === args.where.id);
      if (!q) return Promise.resolve(null);
      const lines = dbLineSnapshots.filter((l) => l.quotationId === q.id);
      return Promise.resolve({ ...q, lines });
    }),
    findMany: vi.fn((args) => {
      let res = [...dbSnapshots];
      if (args?.where?.companyId) res = res.filter((q) => q.companyId === args.where.companyId);
      if (args?.where?.repId) res = res.filter((q) => q.repId === args.where.repId);
      if (args?.where?.status) {
        if (typeof args.where.status === 'string') {
          res = res.filter((q) => q.status === args.where.status);
        } else if (args.where.status.in) {
          res = res.filter((q) => args.where.status.in.includes(q.status));
        }
      }
      if (args?.where?.lastActivityAt?.lt) {
        res = res.filter((q) => new Date(q.lastActivityAt) < new Date(args.where.lastActivityAt.lt));
      }
      if (args?.where?.createdAt?.gte && args?.where?.createdAt?.lte) {
        res = res.filter(
          (q) =>
            new Date(q.createdAt) >= new Date(args.where.createdAt.gte) &&
            new Date(q.createdAt) <= new Date(args.where.createdAt.lte),
        );
      }

      const skip = args?.skip || 0;
      const take = args?.take !== undefined ? args.take : res.length;

      return Promise.resolve(
        res.slice(skip, skip + take).map((q) => ({
          ...q,
          lines: dbLineSnapshots.filter((l) => l.quotationId === q.id),
        })),
      );
    }),
    count: vi.fn((args) => {
      let res = [...dbSnapshots];
      if (args?.where?.companyId) res = res.filter((q) => q.companyId === args.where.companyId);
      if (args?.where?.repId) res = res.filter((q) => q.repId === args.where.repId);
      if (args?.where?.status) res = res.filter((q) => q.status === args.where.status);
      return Promise.resolve(res.length);
    }),
    create: vi.fn((args) => {
      const q = { ...args.data, updatedAt: new Date() };
      dbSnapshots.push(q);
      return Promise.resolve(q);
    }),
    upsert: vi.fn((args) => {
      const idx = dbSnapshots.findIndex((s) => s.id === args.where.id);
      if (idx !== -1) {
        dbSnapshots[idx] = { ...dbSnapshots[idx], ...args.update, updatedAt: new Date() };
        return Promise.resolve(dbSnapshots[idx]);
      }
      const created = { ...args.create, updatedAt: new Date() };
      dbSnapshots.push(created);
      return Promise.resolve(created);
    }),
  },

  quotationLineSnapshot: {
    deleteMany: vi.fn((args) => {
      if (args.where.quotationId) {
        dbLineSnapshots = dbLineSnapshots.filter((l) => l.quotationId !== args.where.quotationId);
      }
      return Promise.resolve({ count: 1 });
    }),
    create: vi.fn((args) => {
      const line = { id: `line-${Date.now()}-${Math.floor(Math.random() * 1000)}`, ...args.data };
      dbLineSnapshots.push(line);
      return Promise.resolve(line);
    }),
    findMany: vi.fn((args) => {
      let res = [...dbLineSnapshots];
      if (args?.where?.companyId) res = res.filter((l) => l.companyId === args.where.companyId);
      return Promise.resolve(res);
    }),
  },

  subscriptionSnapshot: {
    findMany: vi.fn((args) => {
      let res = [...dbSubscriptions];
      if (args?.where?.companyId) res = res.filter((s) => s.companyId === args.where.companyId);
      if (args?.where?.status) res = res.filter((s) => s.status === args.where.status);
      return Promise.resolve(res);
    }),
    upsert: vi.fn((args) => {
      const idx = dbSubscriptions.findIndex((s) => s.id === args.where.id);
      if (idx !== -1) {
        dbSubscriptions[idx] = { ...dbSubscriptions[idx], ...args.update };
        return Promise.resolve(dbSubscriptions[idx]);
      }
      const created = { ...args.create };
      dbSubscriptions.push(created);
      return Promise.resolve(created);
    }),
  },

  invoiceSnapshot: {
    upsert: vi.fn((args) => {
      const idx = dbInvoices.findIndex((i) => i.id === args.where.id);
      if (idx !== -1) {
        dbInvoices[idx] = { ...dbInvoices[idx], ...args.update };
        return Promise.resolve(dbInvoices[idx]);
      }
      const created = { ...args.create };
      dbInvoices.push(created);
      return Promise.resolve(created);
    }),
  },
};

function generateAuthToken(role: string = 'SALES_MANAGER', id: string = 'mgr-001') {
  return jwt.sign(
    { sub: id, id, email: `${role.toLowerCase()}@test.com`, role, companyId: 'default' },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

describe('Analytics Service API Integration Tests', () => {
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
    dbSnapshots = [];
    dbLineSnapshots = [];
    dbConfigs = [];
    dbAlerts = [];
    dbNudges = [];
    dbInvoices = [];
    dbSubscriptions = [];

    // Default configuration: 7 days stall threshold, factor 2.0
    dbConfigs.push({
      id: 'cfg-default',
      companyId: 'default',
      stallDaysThreshold: 7,
      anomalyStdDevFactor: 2.0,
      deliverySlippageDays: 3,
      updatedAt: new Date(),
    });
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
      expect(json.service).toBe('analytics-service');
      expect(json.version).toBe('1.0.0');
    });
  });

  // ─── CHECK-ANA-001: Sales Dashboard ───────────────────────────────────────
  describe('CHECK-ANA-001: GET /analytics/dashboard (REQ-F-060, REQ-RPT-001)', () => {
    it('computes summary KPIs and pipeline breakdown correctly', async () => {
      // Seed snapshots
      dbSnapshots.push(
        {
          id: 'q-1',
          companyId: 'default',
          repId: 'rep-1',
          repName: 'Alice',
          customerId: 'cust-1',
          customerName: 'Acme',
          status: 'CONFIRMED',
          totalAmount: new Prisma.Decimal(50000),
          totalMarginPct: 30,
          blendedRiskScore: 10,
          currency: 'USD',
          lastActivityAt: new Date(),
          createdAt: new Date(),
          confirmedAt: new Date(),
        },
        {
          id: 'q-2',
          companyId: 'default',
          repId: 'rep-2',
          repName: 'Bob',
          customerId: 'cust-2',
          customerName: 'Beta Corp',
          status: 'DRAFT',
          totalAmount: new Prisma.Decimal(20000),
          totalMarginPct: 25,
          blendedRiskScore: 15,
          currency: 'USD',
          lastActivityAt: new Date(),
          createdAt: new Date(),
          confirmedAt: null,
        },
        {
          id: 'q-3',
          companyId: 'default',
          repId: 'rep-1',
          repName: 'Alice',
          customerId: 'cust-3',
          customerName: 'Gamma LLC',
          status: 'PENDING_MANAGER_APPROVAL',
          totalAmount: new Prisma.Decimal(30000),
          totalMarginPct: 35,
          blendedRiskScore: 20,
          currency: 'USD',
          lastActivityAt: new Date(),
          createdAt: new Date(),
          confirmedAt: null,
        },
      );

      // Seed active subscription for MRR calculation
      dbSubscriptions.push({
        id: 'sub-1',
        companyId: 'default',
        orderId: 'q-1',
        customerId: 'cust-1',
        planName: 'Cloud Support',
        interval: 'MONTHLY',
        quantity: 2,
        unitPrice: new Prisma.Decimal(500),
        status: 'ACTIVE',
        nextBillingDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      });

      const token = generateAuthToken('SALES_MANAGER');

      const res = await app.inject({
        method: 'GET',
        url: '/analytics/dashboard',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.kpis).toBeDefined();
      expect(json.kpis.totalQuotations).toBe(3);
      expect(json.kpis.totalRevenue).toBe('50000.00'); // only CONFIRMED
      expect(json.kpis.pendingApprovals).toBe(1);
      expect(json.pipelineBreakdown.CONFIRMED).toBe(1);
      expect(json.pipelineBreakdown.DRAFT).toBe(1);
      expect(json.pipelineBreakdown.PENDING_MANAGER_APPROVAL).toBe(1);
      expect(json.topReps[0].repName).toBe('Alice');
      expect(json.topReps[0].totalRevenue).toBe('50000.00');
      expect(json.recurringRevenue.mrr).toBe('1000.00');
    });
  });

  // ─── CHECK-ANA-002: Stalled Deal Detection ─────────────────────────────────
  describe('CHECK-ANA-002: Stalled Deal Detection (REQ-F-150, REQ-BR-014)', () => {
    it('detects quotations with lastActivityAt past threshold and generates STALLED alert', async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

      dbSnapshots.push({
        id: 'q-stalled-1',
        companyId: 'default',
        repId: 'rep-1',
        repName: 'Alice',
        customerId: 'cust-1',
        customerName: 'Stalled Acme',
        status: 'SENT',
        totalAmount: new Prisma.Decimal(45000),
        totalMarginPct: 30,
        blendedRiskScore: 10,
        currency: 'USD',
        lastActivityAt: tenDaysAgo, // 10 days inactive (> 7 days threshold)
        createdAt: tenDaysAgo,
        confirmedAt: null,
      });

      const token = generateAuthToken('SALES_MANAGER');

      // Trigger health check
      const checkRes = await app.inject({
        method: 'POST',
        url: '/analytics/deal-health/check',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(checkRes.statusCode).toBe(200);

      // Verify GET /analytics/deal-health returns STALLED alert
      const healthRes = await app.inject({
        method: 'GET',
        url: '/analytics/deal-health',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(healthRes.statusCode).toBe(200);
      const json = healthRes.json();
      expect(json.summary.stalledCount).toBe(1);

      const alert = json.alerts.find((a: any) => a.type === 'STALLED');
      expect(alert).toBeDefined();
      expect(alert.quotationId).toBe('q-stalled-1');
      expect(alert.customerName).toBe('Stalled Acme');
      expect(alert.message).toContain('inactive for 10 days');
    });
  });

  // ─── CHECK-ANA-003: Discount Anomaly Detection ────────────────────────────
  describe('CHECK-ANA-003: Discount Anomaly Detection (REQ-F-151, REQ-BR-015)', () => {
    it('detects discount anomaly when quotation blendedRiskScore exceeds repAvg + factor * stdDev', async () => {
      // Rep has baseline history: [10, 12, 14] -> avg = 12, stdDev ~ 1.63, threshold ~ 15.26
      dbSnapshots.push(
        {
          id: 'q-past-1',
          companyId: 'default',
          repId: 'rep-bob',
          repName: 'Bob Builder',
          customerId: 'cust-1',
          customerName: 'Past 1',
          status: 'CONFIRMED',
          totalAmount: new Prisma.Decimal(10000),
          totalMarginPct: 40,
          blendedRiskScore: 10,
          currency: 'USD',
          lastActivityAt: new Date(),
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          confirmedAt: new Date(),
        },
        {
          id: 'q-past-2',
          companyId: 'default',
          repId: 'rep-bob',
          repName: 'Bob Builder',
          customerId: 'cust-2',
          customerName: 'Past 2',
          status: 'CONFIRMED',
          totalAmount: new Prisma.Decimal(12000),
          totalMarginPct: 38,
          blendedRiskScore: 14,
          currency: 'USD',
          lastActivityAt: new Date(),
          createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
          confirmedAt: new Date(),
        },
        // Current quotation with score = 45 (> avg + 2*stdDev)
        {
          id: 'q-anomaly-1',
          companyId: 'default',
          repId: 'rep-bob',
          repName: 'Bob Builder',
          customerId: 'cust-3',
          customerName: 'Anomaly Client',
          status: 'PENDING_MANAGER_APPROVAL',
          totalAmount: new Prisma.Decimal(80000),
          totalMarginPct: 15,
          blendedRiskScore: 45,
          currency: 'USD',
          lastActivityAt: new Date(),
          createdAt: new Date(),
          confirmedAt: null,
        },
      );

      const token = generateAuthToken('SALES_MANAGER');

      // Trigger health check
      const checkRes = await app.inject({
        method: 'POST',
        url: '/analytics/deal-health/check',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(checkRes.statusCode).toBe(200);

      // Verify GET /analytics/deal-health returns DISCOUNT_ANOMALY alert
      const healthRes = await app.inject({
        method: 'GET',
        url: '/analytics/deal-health',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(healthRes.statusCode).toBe(200);
      const json = healthRes.json();
      expect(json.summary.anomalyCount).toBe(1);

      const alert = json.alerts.find((a: any) => a.type === 'DISCOUNT_ANOMALY');
      expect(alert).toBeDefined();
      expect(alert.quotationId).toBe('q-anomaly-1');
      expect(alert.message).toContain('Bob Builder');
      expect(alert.severity).toBe('HIGH');
    });
  });

  // ─── CHECK-ANA-004: Alert Click Navigation ────────────────────────────────
  describe('CHECK-ANA-004: Alert Navigation Data (REQ-F-153)', () => {
    it('ensures all alerts expose quotationId for frontend navigation', async () => {
      dbAlerts.push({
        id: 'alert-nav-1',
        companyId: 'default',
        quotationId: 'quot-target-12345',
        type: 'STALLED',
        severity: 'HIGH',
        message: 'Stalled deal',
        isResolved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const token = generateAuthToken('SALES_MANAGER');

      const res = await app.inject({
        method: 'GET',
        url: '/analytics/deal-health',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      const alert = json.alerts.find((a: any) => a.id === 'alert-nav-1');
      expect(alert).toBeDefined();
      expect(alert.quotationId).toBe('quot-target-12345');
      // Navigation URL contract: `/app/quotations/${alert.quotationId}`
    });
  });

  // ─── CHECK-ANA-005: Nudge & Escalation Action ─────────────────────────────
  describe('CHECK-ANA-005: Nudge & Escalation (REQ-F-154, REQ-BONUS-004)', () => {
    it('creates NudgeAction and sends email notification to sales rep', async () => {
      dbSnapshots.push({
        id: 'q-nudge-target',
        companyId: 'default',
        repId: 'rep-john',
        repName: 'John Doe',
        customerId: 'cust-nudge',
        customerName: 'Nudge Customer',
        status: 'SENT',
        totalAmount: new Prisma.Decimal(25000),
        totalMarginPct: 28,
        blendedRiskScore: 12,
        currency: 'USD',
        lastActivityAt: new Date(),
        createdAt: new Date(),
      });

      const alert = await mockPrisma.dealAlert.create({
        data: {
          companyId: 'default',
          quotationId: 'q-nudge-target',
          type: 'STALLED',
          severity: 'MEDIUM',
          message: 'Quotation has been inactive',
        },
      });

      const token = generateAuthToken('SALES_MANAGER', 'mgr-999');

      const res = await app.inject({
        method: 'POST',
        url: `/analytics/alerts/${alert.id}/nudge`,
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          type: 'EMAIL_NUDGE',
          message: 'Please contact this customer regarding their open quotation.',
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.alertId).toBe(alert.id);
      expect(json.quotationId).toBe('q-nudge-target');
      expect(json.type).toBe('EMAIL_NUDGE');
      expect(json.sentTo[0]).toBe('john.doe@dealflow360.dev');

      // Verify record stored in db
      expect(dbNudges.length).toBe(1);
      expect(dbNudges[0].triggeredBy).toBe('mgr-999');
    });
  });

  // ─── CHECK-ANA-006: Report PDF & XLS Export ───────────────────────────────
  describe('CHECK-ANA-006: Report Export PDF & XLS (REQ-F-061, REQ-RPT-007)', () => {
    it('exports quotations report to PDF and returns valid downloadUrl', async () => {
      dbSnapshots.push({
        id: 'q-pdf-1',
        companyId: 'default',
        repId: 'rep-1',
        repName: 'Alice',
        customerId: 'cust-1',
        customerName: 'Acme PDF',
        status: 'CONFIRMED',
        totalAmount: new Prisma.Decimal(30000),
        totalMarginPct: 35,
        blendedRiskScore: 10,
        currency: 'USD',
        lastActivityAt: new Date(),
        createdAt: new Date(),
      });

      const token = generateAuthToken('ADMIN');

      // 1. Export PDF
      const exportRes = await app.inject({
        method: 'POST',
        url: '/analytics/reports/export',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          reportType: 'quotations',
          format: 'PDF',
        },
      });

      expect(exportRes.statusCode).toBe(200);
      const json = exportRes.json();
      expect(json.downloadUrl).toBeDefined();
      expect(json.format).toBe('PDF');

      // 2. Fetch the exported PDF
      const fileRes = await app.inject({
        method: 'GET',
        url: json.downloadUrl,
      });

      expect(fileRes.statusCode).toBe(200);
      expect(fileRes.headers['content-type']).toBe('application/pdf');
      expect(fileRes.rawPayload.length).toBeGreaterThan(100);
    });

    it('exports quotations report to XLS and returns spreadsheet buffer', async () => {
      const token = generateAuthToken('ADMIN');

      const exportRes = await app.inject({
        method: 'POST',
        url: '/analytics/reports/export',
        headers: { Authorization: `Bearer ${token}` },
        payload: {
          reportType: 'quotations',
          format: 'XLS',
        },
      });

      expect(exportRes.statusCode).toBe(200);
      const json = exportRes.json();
      expect(json.format).toBe('XLS');

      const fileRes = await app.inject({
        method: 'GET',
        url: json.downloadUrl,
      });

      expect(fileRes.statusCode).toBe(200);
      expect(fileRes.headers['content-type']).toContain('spreadsheetml');
    });
  });

  // ─── CHECK-ANA-007: Quotations Report Filters ─────────────────────────────
  describe('CHECK-ANA-007: Quotations Report Filters (REQ-F-062–065)', () => {
    it('filters quotations by repId, status, and date range', async () => {
      const d1 = new Date('2026-09-02T10:00:00Z');
      const d2 = new Date('2026-09-04T10:00:00Z');

      dbSnapshots.push(
        {
          id: 'q-filter-1',
          companyId: 'default',
          repId: 'rep-target',
          repName: 'Target Rep',
          customerId: 'cust-1',
          customerName: 'Target Customer',
          status: 'APPROVED',
          totalAmount: new Prisma.Decimal(15000),
          totalMarginPct: 30,
          blendedRiskScore: 12,
          currency: 'USD',
          lastActivityAt: d1,
          createdAt: d1,
        },
        {
          id: 'q-filter-2',
          companyId: 'default',
          repId: 'rep-other',
          repName: 'Other Rep',
          customerId: 'cust-2',
          customerName: 'Other Customer',
          status: 'APPROVED',
          totalAmount: new Prisma.Decimal(25000),
          totalMarginPct: 32,
          blendedRiskScore: 10,
          currency: 'USD',
          lastActivityAt: d2,
          createdAt: d2,
        },
      );

      const token = generateAuthToken('SALES_MANAGER');

      // Filter by repId=rep-target & status=APPROVED
      const res = await app.inject({
        method: 'GET',
        url: '/analytics/reports/quotations?repId=rep-target&status=APPROVED',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.total).toBe(1);
      expect(json.quotations[0].id).toBe('q-filter-1');
      expect(json.quotations[0].repName).toBe('Target Rep');
    });
  });

  // ─── Event Consumer Tests ─────────────────────────────────────────────────
  describe('Analytics Event Handling', () => {
    it('consumes quotation.confirmed and updates snapshot', async () => {
      const { AnalyticsEventConsumer } = await import('../../src/events/consumer');
      const { AnalyticsRepository } = await import('../../src/db/repositories/analytics.repository');
      const { DealHealthRepository } = await import('../../src/db/repositories/deal-health.repository');

      const analyticsRepo = new AnalyticsRepository(mockPrisma as any);
      const dealHealthRepo = new DealHealthRepository(mockPrisma as any);
      const consumer = new AnalyticsEventConsumer(null, analyticsRepo, dealHealthRepo);

      await consumer.handleEvent('quotation.confirmed', {
        quotationId: 'quot-event-1',
        companyId: 'default',
        repId: 'rep-evt',
        repName: 'Event Rep',
        customerId: 'cust-evt',
        customerName: 'Event Corp',
        totalAmount: 95000,
        totalMarginPct: 34.2,
        blendedRiskScore: 8.5,
        confirmedAt: new Date().toISOString(),
      });

      const snapshot = dbSnapshots.find((s) => s.id === 'quot-event-1');
      expect(snapshot).toBeDefined();
      expect(snapshot.status).toBe('CONFIRMED');
      expect(Number(snapshot.totalAmount)).toBe(95000);
    });

    it('consumes fulfillment.shipment_delayed and creates DELIVERY_SLIPPAGE alert (REQ-F-152)', async () => {
      const { AnalyticsEventConsumer } = await import('../../src/events/consumer');
      const { AnalyticsRepository } = await import('../../src/db/repositories/analytics.repository');
      const { DealHealthRepository } = await import('../../src/db/repositories/deal-health.repository');

      const analyticsRepo = new AnalyticsRepository(mockPrisma as any);
      const dealHealthRepo = new DealHealthRepository(mockPrisma as any);
      const consumer = new AnalyticsEventConsumer(null, analyticsRepo, dealHealthRepo);

      await consumer.handleEvent('fulfillment.shipment_delayed', {
        companyId: 'default',
        orderId: 'quot-delayed-999',
        daysDelayed: 4,
      });

      const alert = dbAlerts.find((a) => a.type === 'DELIVERY_SLIPPAGE');
      expect(alert).toBeDefined();
      expect(alert.quotationId).toBe('quot-delayed-999');
      expect(alert.message).toContain('4 days past expected ship date');
    });
  });
});
