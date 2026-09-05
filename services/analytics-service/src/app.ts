import Fastify, { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import crypto from 'crypto';
import { env } from './config/env';

// Repositories
import { AnalyticsRepository } from './db/repositories/analytics.repository';
import { DealHealthRepository } from './db/repositories/deal-health.repository';

// Integrations & Domain Services
import { EmailSender } from './integrations/email.sender';
import { ReportExportService } from './domain/services/report-export.service';
import { AnalyticsService, AnalyticsDomainError } from './domain/services/analytics.service';
import { AnalyticsEventConsumer } from './events/consumer';
import { DealHealthCronJob } from './jobs/deal-health-cron.job';

// Routes
import { dashboardRoutes } from './api/routes/dashboard.routes';
import { dealHealthRoutes } from './api/routes/deal-health.routes';
import { alertsRoutes } from './api/routes/alerts.routes';
import { reportsRoutes } from './api/routes/reports.routes';

export interface BuildAppOptions {
  prisma?: PrismaClient;
  redis?: Redis;
  analyticsService?: AnalyticsService;
  emailSender?: EmailSender;
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

  // Repositories & Integrations
  const analyticsRepo = new AnalyticsRepository(prisma);
  const dealHealthRepo = new DealHealthRepository(prisma);
  const emailSender = options.emailSender ?? new EmailSender();
  const exportService = new ReportExportService();

  // Domain Service & Background Jobs
  const analyticsService = options.analyticsService ?? new AnalyticsService(
    analyticsRepo,
    dealHealthRepo,
    emailSender,
    exportService,
    prisma,
  );
  const eventConsumer = new AnalyticsEventConsumer(redisProxy, analyticsRepo, dealHealthRepo);
  const cronJob = new DealHealthCronJob(analyticsService, prisma);

  // Fastify Instance
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
      service: 'analytics-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Register API Routes
  await app.register(dashboardRoutes(analyticsService), { prefix: '/analytics/dashboard' });
  await app.register(dealHealthRoutes(analyticsService), { prefix: '/analytics/deal-health' });
  await app.register(alertsRoutes(analyticsService), { prefix: '/analytics/alerts' });
  await app.register(reportsRoutes(analyticsService), { prefix: '/analytics/reports' });

  // Error Handler (RFC 7807)
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AnalyticsDomainError) {
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
      await eventConsumer.start();
    }
    if (env.NODE_ENV !== 'test') {
      cronJob.start();
    }
  });

  app.addHook('onClose', async () => {
    eventConsumer.stop();
    cronJob.stop();
    await prisma.$disconnect();
    if (redis) {
      redis.disconnect();
    }
  });

  return app;
}
