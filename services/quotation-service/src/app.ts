import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { env } from './config/env';

// Repositories
import { CustomerRepository } from './db/repositories/customer.repository';
import { QuotationRepository } from './db/repositories/quotation.repository';
import { ApprovalLogRepository } from './db/repositories/approval-log.repository';
import { NegotiationRepository } from './db/repositories/negotiation.repository';

// Integrations & Events
import { CatalogClient } from './integrations/catalog.client';
import { QuotationEventPublisher } from './events/publisher';
import { FulfillmentEventConsumer } from './events/consumer';

// Domain Services
import { QuotationService, QuotationDomainError } from './domain/services/quotation.service';

// Routes
import { customersRoutes } from './api/routes/customers.routes';
import { quotationsRoutes } from './api/routes/quotations.routes';
import { portalRoutes } from './api/routes/portal.routes';

export interface BuildAppOptions {
  prisma?: PrismaClient;
  redis?: Redis;
  catalogClient?: CatalogClient;
  eventPublisher?: QuotationEventPublisher;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const prisma = options.prisma ?? new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  let redis: Redis | null = options.redis ?? null;
  let isRedisConnected = false;
  if (!redis && env.NODE_ENV !== 'test') {
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
  }

  // Fallback redis client proxy if redis is unavailable
  const redisProxy = (redis || {
    get: async () => null,
    set: async () => 'OK',
    setex: async () => 'OK',
    del: async () => 1,
    keys: async () => [],
    ping: async () => 'PONG',
    disconnect: () => {},
    on: () => {},
  }) as unknown as Redis;

  // Repositories
  const customerRepo = new CustomerRepository(prisma);
  const quotationRepo = new QuotationRepository(prisma);
  const approvalLogRepo = new ApprovalLogRepository(prisma);
  const negotiationRepo = new NegotiationRepository(prisma);

  // Integrations & Events
  const catalogClient = options.catalogClient ?? new CatalogClient(
    env.CATALOG_SERVICE_URL,
    env.SERVICE_TOKEN,
  );
  const eventPublisher = options.eventPublisher ?? new QuotationEventPublisher(redisProxy);
  const fulfillmentConsumer = new FulfillmentEventConsumer(redisProxy, prisma);

  // Domain Service
  const quotationService = new QuotationService(
    quotationRepo,
    customerRepo,
    approvalLogRepo,
    negotiationRepo,
    catalogClient,
    eventPublisher,
  );

  // Fastify App
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(fastifyCors, {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  if (isRedisConnected && redis) {
    await app.register(fastifyRateLimit, {
      global: true,
      max: 200,
      timeWindow: '1 minute',
      redis,
      keyGenerator: (req) => req.ip ?? 'unknown',
    });
  } else {
    await app.register(fastifyRateLimit, {
      global: true,
      max: 200,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.ip ?? 'unknown',
    });
  }

  // Health Check
  app.get('/health', async (_request, reply) => {
    return reply.code(200).send({
      status: 'healthy',
      service: 'quotation-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Routes
  await app.register(customersRoutes(customerRepo), { prefix: '/quotations/customers' });
  await app.register(quotationsRoutes(quotationService), { prefix: '/quotations' });
  await app.register(portalRoutes(quotationService, redis), { prefix: '/portal' });

  // Error Handler (RFC 7807)
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof QuotationDomainError) {
      return reply.code(error.statusCode).send({
        type: `https://dealflow360.com/errors/${error.errorCode.toLowerCase().replace(/_/g, '-')}`,
        title: error.errorCode,
        status: error.statusCode,
        detail: error.message,
        instance: request.url,
      });
    }

    const status = error.statusCode ?? 500;
    if (status === 429) {
      return reply.code(429).send({
        type: 'https://dealflow360.com/errors/rate-limit-exceeded',
        title: 'Too Many Requests',
        status: 429,
        detail: 'Rate limit exceeded. Please try again later.',
        instance: request.url,
      });
    }

    app.log.error({ err: error, requestId: request.id });
    return reply.code(status >= 500 ? 500 : status).send({
      type: 'https://dealflow360.com/errors/error',
      title: status >= 500 ? 'Internal Server Error' : error.message,
      status: status >= 500 ? 500 : status,
      detail: status >= 500 ? 'An unexpected error occurred' : error.message,
      instance: request.url,
    });
  });

  // Lifecycle
  app.addHook('onReady', async () => {
    if (isRedisConnected && redis && env.NODE_ENV !== 'test') {
      await fulfillmentConsumer.start();
    }
  });

  app.addHook('onClose', async () => {
    fulfillmentConsumer.stop();
    await prisma.$disconnect();
    if (redis) {
      redis.disconnect();
    }
  });

  return app;
}
