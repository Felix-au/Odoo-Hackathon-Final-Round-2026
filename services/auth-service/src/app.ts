import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyCookie from '@fastify/cookie';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { env } from './config/env';
import { UserRepository } from './db/repositories/user.repository';
import { RefreshTokenRepository } from './db/repositories/refresh-token.repository';
import { PortalCredentialRepository } from './db/repositories/portal-credential.repository';
import { AuthService } from './domain/services/auth.service';
import { MagicLinkService } from './domain/services/magic-link.service';
import { PortalSessionService } from './domain/services/portal-session.service';
import { EmailClient } from './integrations/email.client';
import { internalAuthRoutes } from './api/routes/internal-auth.routes';
import { portalAuthRoutes } from './api/routes/portal-auth.routes';

export async function buildApp() {
  // ─── Infrastructure ──────────────────────────────────────
  const prisma = new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  let redis: Redis | null = null;
  let isRedisConnected = false;
  try {
    const testRedis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
      connectTimeout: 500,
    });
    testRedis.on('error', () => {});
    await testRedis.connect()
      .then(() => {
        redis = testRedis;
        isRedisConnected = true;
      })
      .catch(() => {
        redis = null;
      });
  } catch {
    redis = null;
  }

  // Fallback redis client proxy if redis is unavailable
  const redisProxy = (redis || {
    get: async () => null,
    set: async () => 'OK',
    setex: async () => 'OK',
    del: async () => 1,
    ping: async () => 'PONG',
    disconnect: () => {},
    on: () => {},
  }) as unknown as Redis;

  // ─── Repositories ────────────────────────────────────────
  const userRepo = new UserRepository(prisma);
  const refreshTokenRepo = new RefreshTokenRepository(prisma);
  const portalCredentialRepo = new PortalCredentialRepository(prisma);

  // ─── Domain Services ─────────────────────────────────────
  const emailClient = new EmailClient();
  const authService = new AuthService(userRepo, refreshTokenRepo);
  const magicLinkService = new MagicLinkService(redisProxy, portalCredentialRepo, emailClient);
  const portalSessionService = new PortalSessionService(redisProxy);

  // ─── Fastify App ─────────────────────────────────────────
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            requestId: request.id,
          };
        },
      },
    },
    genReqId: () => crypto.randomUUID(),
  });

  // ─── Plugins ─────────────────────────────────────────────
  await app.register(fastifyCors, {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  if (process.env.NODE_ENV === 'test') {
    await app.register(fastifyRateLimit, {
      global: false,
      max: 10000,
      timeWindow: '1 minute',
    });
  } else if (isRedisConnected && redis) {
    await app.register(fastifyRateLimit, {
      global: true,
      max: 100,
      timeWindow: '1 minute',
      redis,
      keyGenerator: (req) => req.ip ?? 'unknown',
    });
  } else {
    await app.register(fastifyRateLimit, {
      global: true,
      max: 100,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip ?? 'unknown',
    });
  }

  await app.register(fastifyCookie);

  // ─── Health Check (CHECK-ARCH-002) ───────────────────────
  app.get('/health', async (_request, reply) => {
    return reply.code(200).send({
      status: 'healthy',
      service: 'auth-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Routes ──────────────────────────────────────────────
  await app.register(internalAuthRoutes(authService, userRepo), {
    prefix: '/auth',
  });

  await app.register(portalAuthRoutes(magicLinkService, portalSessionService, portalCredentialRepo), {
    prefix: '/portal/auth',
  });

  // ─── Global Error Handler (RFC 7807) ─────────────────────
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode ?? 500;

    // Never expose internal errors to clients
    if (status === 429) {
      return reply.code(429).send({
        type: 'https://dealflow360.com/errors/rate-limit-exceeded',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Rate limit exceeded. Please try again later.',
        instance: request.url,
      });
    }

    app.log.error({ err: error, requestId: request.id }, 'Unhandled error');

    return reply.code(status >= 500 ? 500 : status).send({
      type: `https://dealflow360.com/errors/${status >= 500 ? 'internal-error' : 'bad-request'}`,
      title: status >= 500 ? 'Internal Server Error' : error.message,
      status: status >= 500 ? 500 : status,
      detail: status >= 500 ? 'An unexpected error occurred' : error.message,
      instance: request.url,
    });
  });

  // ─── Graceful Shutdown ───────────────────────────────────
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    if (redis) {
      redis.disconnect();
    }
  });

  return app;
}
