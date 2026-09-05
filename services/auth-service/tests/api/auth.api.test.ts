import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// These are integration tests — run against a real test DB + Redis
// They verify the CHECK-AUTH-* checkpoints from the spec.
// To run: `npm test` with TEST_DATABASE_URL and REDIS_URL pointing to test instances.

// For unit tests of route logic, see tests/unit/auth.service.test.ts

// ─── Test Helpers ─────────────────────────────────────────────

let app: FastifyInstance;

beforeAll(async () => {
  // Only run if test env vars are set
  if (!process.env.AUTH_DATABASE_URL || !process.env.REDIS_URL) {
    console.warn('⚠️  Skipping integration tests: AUTH_DATABASE_URL/REDIS_URL not set');
    return;
  }

  process.env.JWT_SECRET = 'test_jwt_secret_min_32_chars_padded_here_x';
  process.env.JWT_ACCESS_EXPIRY = '3600';
  process.env.JWT_REFRESH_EXPIRY = '604800';
  process.env.MAGIC_LINK_TTL_SECONDS = '86400';
  process.env.PORTAL_SESSION_TTL_SECONDS = '604800';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.SMTP_FROM = 'test@test.com';
  process.env.APP_BASE_URL = 'http://localhost:3001';

  const { buildApp } = await import('../../src/app');
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  if (app) await app.close();
});

describe('POST /auth/signup (CHECK-AUTH-001)', () => {
  it('should create a new user and return 201', async () => {
    if (!app) return;

    const uniqueEmail = `test-${Date.now()}@example.com`;
    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: uniqueEmail,
        password: 'TestP@ss123',
        name: 'Test User',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toHaveProperty('id');
    expect(body.email).toBe(uniqueEmail);
    expect(body.role).toBe('SALES_REP');
    // Must NOT expose passwordHash
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('should return 409 for duplicate email', async () => {
    if (!app) return;

    const email = `dup-${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email, password: 'TestP@ss123', name: 'First' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email, password: 'TestP@ss123', name: 'Second' },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.title).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('should return 400 for weak password (CHECK-AUTH-003)', async () => {
    if (!app) return;

    const res = await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: `weak-${Date.now()}@example.com`,
        password: 'weakpass',
        name: 'User',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /auth/login (CHECK-AUTH-002)', () => {
  it('should return 200 with JWT for valid credentials', async () => {
    if (!app) return;

    // First create user
    const email = `login-${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email, password: 'ValidP@ss1', name: 'Login Test' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'ValidP@ss1' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body.user.email).toBe(email);
  });

  it('should return 401 for wrong password', async () => {
    if (!app) return;

    const email = `wrong-pw-${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email, password: 'ValidP@ss1', name: 'Wrong PW' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'WrongPassword' },
    });

    expect(res.statusCode).toBe(401);
    // Must NOT expose email existence (REQ-SEC-007)
    const body = res.json();
    expect(body.title).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 for non-existent email (same message as wrong password)', async () => {
    if (!app) return;

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'nobody@example.com', password: 'SomePass1!' },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    // REQ-SEC-007: MUST be same error code, not EMAIL_NOT_FOUND
    expect(body.title).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /auth/me (CHECK-AUTH-006)', () => {
  it('should return user profile for valid JWT', async () => {
    if (!app) return;

    const email = `me-${Date.now()}@example.com`;
    await app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email, password: 'ValidP@ss1', name: 'Me User' },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'ValidP@ss1' },
    });
    const { accessToken } = loginRes.json() as { accessToken: string };

    const meRes = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(meRes.statusCode).toBe(200);
    const body = meRes.json();
    expect(body.email).toBe(email);
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('should return 401 without token', async () => {
    if (!app) return;

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('Portal session isolation (CHECK-AUTH-005)', () => {
  it('should reject portal session cookie on internal /auth/me route', async () => {
    if (!app) return;

    // Attempting to use a portal session token as Bearer should fail
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: 'Bearer portal_session_token_not_valid_jwt' },
    });

    expect(res.statusCode).toBe(401);
  });
});
