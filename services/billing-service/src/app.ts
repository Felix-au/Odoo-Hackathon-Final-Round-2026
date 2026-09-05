import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import crypto from 'crypto';
import { env } from './config/env';

// Repositories
import { InvoiceRepository } from './db/repositories/invoice.repository';
import { SubscriptionRepository } from './db/repositories/subscription.repository';
import { PaymentRepository } from './db/repositories/payment.repository';

// Events
import { BillingEventPublisher } from './events/publisher';
import { QuotationConfirmedConsumer } from './events/consumer';

// Domain Services & Jobs
import { BillingService, BillingDomainError } from './domain/services/billing.service';
import { BillingCronJob } from './jobs/billing-cron.job';

// Routes
import { invoicesRoutes } from './api/routes/invoices.routes';
import { subscriptionsRoutes } from './api/routes/subscriptions.routes';
import { schedulesRoutes } from './api/routes/schedules.routes';

export interface BuildAppOptions {
  prisma?: PrismaClient;
  redis?: Redis;
  billingService?: BillingService;
  eventPublisher?: BillingEventPublisher;
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
  const invoiceRepo = new InvoiceRepository(prisma);
  const subscriptionRepo = new SubscriptionRepository(prisma);
  const paymentRepo = new PaymentRepository(prisma);

  // Event Publisher
  const eventPublisher = options.eventPublisher ?? new BillingEventPublisher(redisProxy);

  // Domain Service & Cron Job
  const billingService = options.billingService ?? new BillingService(
    invoiceRepo,
    subscriptionRepo,
    paymentRepo,
    eventPublisher,
  );
  const cronJob = new BillingCronJob(subscriptionRepo, invoiceRepo, eventPublisher);

  // Consumer
  const quotationConsumer = new QuotationConfirmedConsumer(redisProxy, billingService);

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
      service: 'billing-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Register Routes
  await app.register(invoicesRoutes(billingService, invoiceRepo), { prefix: '/billing/invoices' });
  await app.register(subscriptionsRoutes(billingService, subscriptionRepo), { prefix: '/billing/subscriptions' });
  await app.register(schedulesRoutes(billingService), { prefix: '/billing/schedules' });

  // Error Handler (RFC 7807)
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof BillingDomainError) {
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
      await quotationConsumer.start();
    }
  });

  app.addHook('onClose', async () => {
    quotationConsumer.stop();
    await prisma.$disconnect();
    if (redis) {
      redis.disconnect();
    }
  });

  return app;
}
