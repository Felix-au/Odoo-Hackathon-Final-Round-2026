import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock env module — must be first so it intercepts before env.ts runs process.exit
vi.mock('../../src/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3004,
    FULFILLMENT_DATABASE_URL: 'postgresql://test:test@localhost:5435/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'dev_jwt_secret_change_in_prod_must_be_64_chars_minimum_dev_only_x',
    SERVICE_TOKEN: 'dev_service_token_for_internal_calls_min_16',
    LOG_LEVEL: 'error',
  },
}));

vi.mock('ioredis', () => {
  const MockRedis = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    xadd: vi.fn().mockResolvedValue('1-0'),
    defineCommand: vi.fn(),
    sendCommand: vi.fn().mockResolvedValue(null),
    options: { enableAutoPipelining: false },
  }));
  return { default: MockRedis };
});

const PROD_1 = '11111111-1111-1111-1111-111111111111';
const PROD_2 = '22222222-2222-2222-2222-222222222222';
const WH_A   = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const WH_B   = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CUST_1 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ORDER_1 = '00000001-0000-0000-0000-000000000001';

// Use vi.hoisted so the mock object exists when vi.mock factory runs (factories are hoisted to top)
const mockPrismaStock = vi.hoisted(() => {
  const db = {
    warehouseStock: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    fulfillmentOrder: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    fulfillmentSplit: {
      deleteMany: vi.fn(),
    },
    backorderRecord: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
  };
  // Wire $transaction to execute the callback with the db object
  db.$transaction = vi.fn((fn: unknown): unknown =>
    typeof fn === 'function' ? (fn as (p: typeof db) => unknown)(db) : fn,
  );
  return db;
});

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrismaStock),
  FulfillmentStatus: {
    PENDING: 'PENDING',
    RESERVED: 'RESERVED',
    PICKING: 'PICKING',
    SHIPPED: 'SHIPPED',
    DELIVERED: 'DELIVERED',
    BACKORDERED: 'BACKORDERED',
    CANCELLED: 'CANCELLED',
  },
}));

// ─── JWT Helper ───────────────────────────────────────────────────────────────
import jwt from 'jsonwebtoken';

function makeToken(role = 'SALES_REP') {
  return jwt.sign(
    { sub: 'user-uuid-001', email: 'test@example.com', role },
    process.env['JWT_SECRET']!,
    { expiresIn: '1h' },
  );
}

// ─── App setup ────────────────────────────────────────────────────────────────
import { buildApp } from '../../src/app';

let app: FastifyInstance;

beforeAll(async () => {
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
    expect(res.json()).toMatchObject({ status: 'healthy', service: 'fulfillment-service' });
  });
});

describe('Authentication Enforcement', () => {
  it('returns 401 on GET /fulfillment/stock without token', async () => {
    const res = await app.inject({ method: 'GET', url: '/fulfillment/stock' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 on GET /fulfillment/stock with valid token', async () => {
    mockPrismaStock.warehouseStock.findMany.mockResolvedValueOnce([]);
    const res = await app.inject({
      method: 'GET',
      url: '/fulfillment/stock',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts x-service-token for internal calls', async () => {
    mockPrismaStock.warehouseStock.findMany.mockResolvedValueOnce([]);
    const res = await app.inject({
      method: 'GET',
      url: '/fulfillment/stock',
      headers: { 'x-service-token': 'dev_service_token_for_internal_calls_min_16' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('Role Enforcement', () => {
  it('returns 403 on PUT /fulfillment/stock with SALES_REP role', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/fulfillment/stock',
      headers: { Authorization: `Bearer ${makeToken('SALES_REP')}` },
      payload: {
        warehouseId: WH_A,
        warehouseName: 'Main',
        productId: PROD_1,
        quantityOnHand: 10,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows PUT /fulfillment/stock with ADMIN role', async () => {
    mockPrismaStock.warehouseStock.findFirst.mockResolvedValueOnce(null);
    mockPrismaStock.warehouseStock.create.mockResolvedValueOnce({
      id: 'stock-1',
      warehouseId: WH_A,
      productId: PROD_1,
      quantityOnHand: 10,
      quantityReserved: 0,
    });
    const res = await app.inject({
      method: 'PUT',
      url: '/fulfillment/stock',
      headers: { Authorization: `Bearer ${makeToken('ADMIN')}` },
      payload: {
        warehouseId: WH_A,
        warehouseName: 'Main Warehouse',
        productId: PROD_1,
        quantityOnHand: 10,
      },
    });
    expect(res.statusCode).toBe(200);
  });
});

// CHECK-FULL-001: split recommendation
describe('GET /fulfillment/split-recommendation (CHECK-FULL-001)', () => {
  it('returns 400 when orderId missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/fulfillment/split-recommendation',
      headers: { Authorization: `Bearer ${makeToken()}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it('CHECK-FULL-001: returns split across 2 warehouses when single cannot fulfill', async () => {
    // 3 in WH_A, 5 in WH_B, need 5 → use both
    mockPrismaStock.warehouseStock.findMany.mockResolvedValue([
      { warehouseId: WH_A, warehouseName: 'Main', productId: PROD_1, quantityOnHand: 3, quantityReserved: 0 },
      { warehouseId: WH_B, warehouseName: 'East Depot', productId: PROD_1, quantityOnHand: 5, quantityReserved: 0 },
    ]);

    const lines = JSON.stringify([{ productId: PROD_1, productName: 'Laptop Pro', quantityNeeded: 5 }]);
    const res = await app.inject({
      method: 'GET',
      url: `/fulfillment/split-recommendation?orderId=${ORDER_1}&lines=${encodeURIComponent(lines)}`,
      headers: { Authorization: `Bearer ${makeToken()}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.estimatedShipmentCount).toBe(2);
    expect(body.hasBackorder).toBe(false);

    const totalFulfilled = body.splits
      .filter((s: { warehouseId: string; quantityFromHere: number }) => s.warehouseId !== 'BACKORDER')
      .reduce((sum: number, s: { quantityFromHere: number }) => sum + s.quantityFromHere, 0);
    expect(totalFulfilled).toBe(5);
  });
});

// CHECK-FULL-002: accept split reserves stock
describe('POST /fulfillment/orders (CHECK-FULL-002)', () => {
  it('CHECK-FULL-002: creates fulfillment order and reserves stock', async () => {
    const createdOrder = {
      id: 'fo-0001',
      orderId: ORDER_1,
      customerId: CUST_1,
      isOverride: false,
      splits: [
        { id: 'sp-0001', warehouseId: WH_A, productId: PROD_1, quantityRequested: 3, status: 'RESERVED' },
        { id: 'sp-0002', warehouseId: WH_B, productId: PROD_1, quantityRequested: 2, status: 'RESERVED' },
      ],
    };

    mockPrismaStock.fulfillmentOrder.create.mockResolvedValueOnce(createdOrder);
    mockPrismaStock.warehouseStock.updateMany.mockResolvedValue({ count: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/fulfillment/orders',
      headers: { Authorization: `Bearer ${makeToken()}` },
      payload: {
        orderId: ORDER_1,
        customerId: CUST_1,
        isOverride: false,
        splits: [
          { warehouseId: WH_A, warehouseName: 'Main', productId: PROD_1, productName: 'Laptop', quantity: 3 },
          { warehouseId: WH_B, warehouseName: 'East', productId: PROD_1, productName: 'Laptop', quantity: 2 },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.order.isOverride).toBe(false);
    expect(body.order.splits).toHaveLength(2);
  });
});

// CHECK-FULL-003: manual override
describe('POST /fulfillment/orders with isOverride=true (CHECK-FULL-003)', () => {
  it('CHECK-FULL-003: stores override flag = true', async () => {
    const createdOrder = {
      id: 'fo-0002',
      orderId: ORDER_1,
      customerId: CUST_1,
      isOverride: true,
      splits: [
        { id: 'sp-0003', warehouseId: WH_B, productId: PROD_1, quantityRequested: 5, status: 'RESERVED' },
      ],
    };

    mockPrismaStock.fulfillmentOrder.create.mockResolvedValueOnce(createdOrder);
    mockPrismaStock.warehouseStock.updateMany.mockResolvedValue({ count: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/fulfillment/orders',
      headers: { Authorization: `Bearer ${makeToken()}` },
      payload: {
        orderId: ORDER_1,
        customerId: CUST_1,
        isOverride: true,
        splits: [
          { warehouseId: WH_B, warehouseName: 'East', productId: PROD_1, productName: 'Laptop', quantity: 5 },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().order.isOverride).toBe(true);
  });
});

// CHECK-FULL-004: stock arrival triggers backorder event
describe('POST /fulfillment/stock/arrival (CHECK-FULL-004)', () => {
  it('CHECK-FULL-004: records arrival and returns affectedOrderIds', async () => {
    const stockAfterArrival = {
      id: 'stock-1',
      warehouseId: WH_A,
      productId: PROD_1,
      quantityOnHand: 60,
      quantityReserved: 0,
    };

    // adjust uses findFirst then update
    mockPrismaStock.warehouseStock.findFirst.mockResolvedValueOnce({ id: 'stock-1' });
    mockPrismaStock.warehouseStock.update.mockResolvedValueOnce(stockAfterArrival);

    // backorder records for this product
    mockPrismaStock.backorderRecord.findMany.mockResolvedValueOnce([
      { id: 'bo-1', orderId: ORDER_1, productId: PROD_1, quantityNeeded: 10, resolvedAt: null },
    ]);

    const res = await app.inject({
      method: 'POST',
      url: '/fulfillment/stock/arrival',
      headers: { Authorization: `Bearer ${makeToken('ADMIN')}` },
      payload: {
        warehouseId: WH_A,
        productId: PROD_1,
        quantityArrived: 50,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.affectedOrderIds).toContain(ORDER_1);
  });
});
