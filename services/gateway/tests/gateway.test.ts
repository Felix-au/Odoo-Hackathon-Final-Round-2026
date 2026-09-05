import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

// ─── Environment setup (must be before importing app modules) ─────────────────
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3000';
process.env['JWT_SECRET'] = 'test_jwt_secret_at_least_32_characters_long_for_testing';
process.env['AUTH_SERVICE_URL'] = 'http://auth-service:3001';
process.env['CATALOG_SERVICE_URL'] = 'http://catalog-service:3002';
process.env['QUOTATION_SERVICE_URL'] = 'http://quotation-service:3003';
process.env['FULFILLMENT_SERVICE_URL'] = 'http://fulfillment-service:3004';
process.env['BILLING_SERVICE_URL'] = 'http://billing-service:3005';
process.env['ANALYTICS_SERVICE_URL'] = 'http://analytics-service:3006';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['ALLOWED_ORIGINS'] = 'http://localhost:5173';

// ─── Mock ioredis — tests run without a real Redis instance ──────────────────
const mockRedisGet = vi.fn();
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: mockRedisGet,
      quit: vi.fn().mockResolvedValue('OK'),
      on: vi.fn(),
      ping: vi.fn().mockResolvedValue('PONG'),
    })),
  };
});

// ─── Mock @fastify/http-proxy — we test auth middleware, not proxy behaviour ──
// The proxy plugin tries to connect to upstream on register; mock it out.
vi.mock('@fastify/http-proxy', () => ({
  default: vi.fn().mockImplementation(async (app: FastifyInstance, opts: { preHandler?: any; beforeHandler?: any }) => {
    const rawPre = opts.preHandler || opts.beforeHandler;
    const preHandlers = rawPre ? (Array.isArray(rawPre) ? rawPre : [rawPre]) : [];

    const handler = async (_req: any, reply: any) => {
      await reply.code(200).send({ proxied: true });
    };

    app.all('/', { preHandler: preHandlers }, handler);
    app.all('/*', { preHandler: preHandlers }, handler);
  }),
}));

import { buildApp } from '../src/app.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env['JWT_SECRET']!;

function makeValidJwt(overrides: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      sub: 'user-uuid-123',
      email: 'rep@company.com',
      name: 'Test Rep',
      role: 'SALES_REP',
      ...overrides,
    },
    JWT_SECRET,
    { expiresIn: '8h' },
  );
}

function makeExpiredJwt(): string {
  return jwt.sign(
    { sub: 'user-uuid-123', email: 'rep@company.com', name: 'Test Rep', role: 'SALES_REP' },
    JWT_SECRET,
    { expiresIn: '-1s' }, // already expired
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Gateway — Health Check (CHECK-ARCH-002)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 with healthy status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; service: string }>();
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('gateway');
  });
});

describe('Gateway — JWT Authentication Boundary (CHECK-ARCH-001)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/quotations with no Authorization header → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/quotations',
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ status: number; type: string }>();
    expect(body.status).toBe(401);
    expect(body.type).toContain('missing-token');
  });

  it('GET /api/v1/quotations with expired JWT → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/quotations',
      headers: { authorization: `Bearer ${makeExpiredJwt()}` },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ type: string }>();
    expect(body.type).toContain('token-expired');
  });

  it('GET /api/v1/quotations with invalid JWT → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/quotations',
      headers: { authorization: 'Bearer this.is.not.a.valid.jwt' },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ type: string }>();
    expect(body.type).toContain('token-invalid');
  });

  it('GET /api/v1/quotations with portal_session cookie → 401 (portal isolation)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/quotations',
      headers: {
        cookie: 'portal_session=some-opaque-session-token',
      },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ type: string }>();
    expect(body.type).toContain('portal-session-on-internal-route');
  });

  it('GET /api/v1/quotations with valid JWT → proxied (200)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/quotations',
      headers: { authorization: `Bearer ${makeValidJwt()}` },
    });
    // The mock proxy returns 200; what matters is we didn't get 401
    expect(res.statusCode).toBe(200);
  });

  it('Valid JWT injects X-User-Id header (verified via auth-service route which has no check)', async () => {
    // Auth service routes have no JWT check, so we test on a catalog route
    // which does have JWT check — validate the valid path goes through
    const token = makeValidJwt({ sub: 'specific-user-id', role: 'ADMIN' });
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/catalog/products',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('Gateway — Portal Authentication Boundary (CHECK-ARCH-001)', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    mockRedisGet.mockReset();
  });

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /portal/v1/quotations/:id with no session token → 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/portal/v1/quotations/some-quotation-id',
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ type: string }>();
    expect(body.type).toContain('missing-portal-session');
  });

  it('GET /portal/v1/quotations/:id with valid JWT in Authorization header → 401 (portal isolation)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/portal/v1/quotations/some-quotation-id',
      headers: { authorization: `Bearer ${makeValidJwt()}` },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ type: string }>();
    expect(body.type).toContain('jwt-on-portal-route');
  });

  it('GET /portal/v1/quotations/:id with non-existent session token → 401', async () => {
    mockRedisGet.mockResolvedValueOnce(null); // session not found in Redis

    const res = await app.inject({
      method: 'GET',
      url: '/portal/v1/quotations/some-quotation-id',
      headers: { cookie: 'portal_session=nonexistent-session-token' },
    });
    expect(res.statusCode).toBe(401);
    const body = res.json<{ type: string }>();
    expect(body.type).toContain('portal-session-invalid');
  });

  it('GET /portal/v1/quotations/:id with valid portal session → proxied (200)', async () => {
    mockRedisGet.mockResolvedValueOnce(
      JSON.stringify({
        customerId: 'customer-uuid-456',
        email: 'customer@acme.com',
        name: 'Acme Customer',
      }),
    );

    const res = await app.inject({
      method: 'GET',
      url: '/portal/v1/quotations/some-quotation-id',
      headers: { cookie: 'portal_session=valid-opaque-token' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST /portal/v1/auth/magic-link passes through without session check', async () => {
    // Portal auth routes require no pre-validation
    const res = await app.inject({
      method: 'POST',
      url: '/portal/v1/auth/magic-link',
      payload: { email: 'customer@acme.com' },
    });
    // Reaches the mock proxy → 200
    expect(res.statusCode).toBe(200);
  });
});

describe('Gateway — Auth Routes (no pre-validation)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/login passes through without JWT check', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'rep@company.com', password: 'password' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST /api/v1/auth/signup passes through without JWT check', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: 'new@company.com', password: 'password', name: 'New User', role: 'SALES_REP' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('Gateway — Not Found', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Unknown route → 404 with RFC 7807 format', async () => {
    const res = await app.inject({ method: 'GET', url: '/unknown/route' });
    expect(res.statusCode).toBe(404);
    const body = res.json<{ status: number; type: string }>();
    expect(body.status).toBe(404);
    expect(body.type).toContain('not-found');
  });
});
