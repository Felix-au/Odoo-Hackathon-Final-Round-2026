/**
 * Catalog Service — API Integration Tests
 *
 * Tests run against an in-memory Fastify instance with mocked Prisma and Redis.
 * No real DB or Redis connection required.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

// ─── Minimal test-only app ─────────────────────────────────────────────────

vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    ping: vi.fn().mockResolvedValue('PONG'),
    on: vi.fn(),
    disconnect: vi.fn(),
  }));
  return { default: MockRedis };
});

const mockPrisma = {
  product: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn().mockResolvedValue(0),
  },
  productCategory: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  priceList: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  },
  discountTier: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    delete: vi.fn(),
  },
  approvalChain: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  warehouseDefinition: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  subscriptionPlan: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  },
  upsellRule: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  productVariant: {
    createMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  $disconnect: vi.fn(),
  $transaction: vi.fn((fn: unknown) => typeof fn === 'function' ? fn(mockPrisma) : fn),
};

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
}));

// ─── JWT Helper ───────────────────────────────────────────────────────────────

const TEST_JWT_SECRET = 'test-secret-32-chars-xxxxxxxxxxxx';

process.env['CATALOG_DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['JWT_SECRET'] = TEST_JWT_SECRET;
process.env['SERVICE_TOKEN'] = 'test-service-token-1234567890';

function makeToken(role: string = 'SALES_REP', companyId: string = 'default') {
  return jwt.sign(
    { sub: 'user-1', email: 'test@example.com', role, companyId },
    TEST_JWT_SECRET,
    { expiresIn: '1h' },
  );
}

// ─── App Setup ────────────────────────────────────────────────────────────────

let app: FastifyInstance;

beforeAll(async () => {
  const { buildApp } = await import('../../src/app');
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with healthy status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('catalog-service');
  });
});

describe('Authentication Enforcement', () => {
  it('returns 401 on GET /catalog/products without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/catalog/products' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 on GET /catalog/products with valid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/products',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
  });

  it('accepts x-service-token for internal service-to-service calls', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/products',
      headers: { 'x-service-token': 'test-service-token-1234567890', 'x-company-id': 'default' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('Role Enforcement', () => {
  it('returns 403 on POST /catalog/products with SALES_REP role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/catalog/products',
      headers: { authorization: `Bearer ${makeToken('SALES_REP')}` },
      payload: { name: 'Test', categoryId: 'cat-1', basePrice: 100 },
    });
    expect(res.statusCode).toBe(403);
  });

  it('calls create on POST /catalog/products with ADMIN role', async () => {
    const newProduct = {
      id: 'new-prod', companyId: 'default', name: 'Widget A', categoryId: 'cat-1',
      basePrice: 199, costPrice: 80, unit: 'unit', taxRate: 18,
      description: null, isActive: true, createdAt: new Date(), updatedAt: new Date(),
    };
    mockPrisma.product.create.mockResolvedValue(newProduct);

    const res = await app.inject({
      method: 'POST',
      url: '/catalog/products',
      headers: { authorization: `Bearer ${makeToken('ADMIN')}` },
      payload: { name: 'Widget A', categoryId: 'cat-1', basePrice: 199 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe('Widget A');
  });
});

describe('GET /catalog/price-lists/resolve', () => {
  it('returns 400 when required params are missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/price-lists/resolve?productId=p1',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when product does not exist', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/catalog/price-lists/resolve?productId=missing&customerTier=GOLD&currency=USD',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /catalog/discount-tiers/ceilings (CHECK-CAT-002)', () => {
  it('returns structured ceilings map', async () => {
    mockPrisma.discountTier.findMany.mockResolvedValue([
      { id: '1', companyId: 'default', customerTier: 'BRONZE', categoryId: null, ceilingPct: 5, createdAt: new Date() },
      { id: '2', companyId: 'default', customerTier: 'SILVER', categoryId: null, ceilingPct: 10, createdAt: new Date() },
      { id: '3', companyId: 'default', customerTier: 'GOLD', categoryId: null, ceilingPct: 15, createdAt: new Date() },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/catalog/discount-tiers/ceilings',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tierCeilings).toBeDefined();
    expect(body.tierCeilings['BRONZE']).toBe(5);
    expect(body.tierCeilings['SILVER']).toBe(10);
    expect(body.tierCeilings['GOLD']).toBe(15);
    expect(body.categoryCeilings).toBeDefined();
  });
});

describe('GET /catalog/approval-chains/resolve (CHECK-CAT-003)', () => {
  it('returns 400 when riskScore is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/approval-chains/resolve',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('resolves correct chain for risk score 75', async () => {
    mockPrisma.approvalChain.findFirst.mockResolvedValue({
      id: '3', companyId: 'default', name: 'Manager + Finance',
      minRiskScore: 30, maxRiskScore: 999, requiredRoles: ['SALES_MANAGER', 'FINANCE'],
      createdAt: new Date(), updatedAt: new Date(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/catalog/approval-chains/resolve?riskScore=75',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.requiredRoles).toContain('SALES_MANAGER');
    expect(body.requiredRoles).toContain('FINANCE');
  });
});

describe('GET /catalog/upsell-rules/suggestions (CHECK-CAT-004)', () => {
  it('returns 400 when productIds param is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/catalog/upsell-rules/suggestions',
      headers: { authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns empty suggestions when no rules match', async () => {
    mockPrisma.upsellRule.findMany.mockResolvedValue([]);

    const res = await app.inject({
      method: 'GET',
      url: '/catalog/upsell-rules/suggestions?productIds=prod-1,prod-2',
      headers: { authorization: `Bearer ${makeToken()}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
    expect(res.json().total).toBe(0);
  });
});
