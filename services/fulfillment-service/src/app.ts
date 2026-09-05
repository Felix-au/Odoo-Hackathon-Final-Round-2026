import fastify from 'fastify';
import Redis from 'ioredis';
import { env } from './config/env';
import { prisma } from './db/prisma-client';
import { WarehouseStockRepository } from './db/repositories/warehouse-stock.repository';
import { FulfillmentOrderRepository } from './db/repositories/fulfillment-order.repository';
import { BackorderRepository } from './db/repositories/backorder.repository';
import { StockService } from './domain/services/stock.service';
import { FulfillmentOrderService } from './domain/services/fulfillment-order.service';
import { EventPublisher } from './events/publisher';
import { stockRoutes } from './api/routes/stock.routes';
import { fulfillmentOrderRoutes } from './api/routes/fulfillment-order.routes';

export async function buildApp() {
  const app = fastify({ logger: { level: env.LOG_LEVEL }, bodyLimit: 1048576 });

  // ─── Redis ────────────────────────────────────────────────────
  let redis: Redis | null = null;
  let isRedisConnected = false;
  if (env.NODE_ENV !== 'test') {
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
    xadd: async () => '1-0',
    disconnect: () => {},
    on: () => {},
  }) as unknown as Redis;

  // ─── Dependencies ─────────────────────────────────────────────
  const eventPublisher = new EventPublisher(redisProxy);
  const stockRepo = new WarehouseStockRepository(prisma);
  const orderRepo = new FulfillmentOrderRepository(prisma);
  const backorderRepo = new BackorderRepository(prisma);

  const stockService = new StockService(stockRepo, backorderRepo, eventPublisher);
  const fulfillmentOrderService = new FulfillmentOrderService(
    orderRepo,
    stockRepo,
    backorderRepo,
    eventPublisher,
  );

  // ─── Plugins ──────────────────────────────────────────────────
  await app.register(import('@fastify/cors'), {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  if (isRedisConnected && redis && env.NODE_ENV !== 'test') {
    await app.register(import('@fastify/rate-limit'), {
      max: 200,
      timeWindow: '1 minute',
      redis,
    });
  } else {
    await app.register(import('@fastify/rate-limit'), {
      max: 200,
      timeWindow: '1 minute',
    });
  }

  await app.register(import('@fastify/swagger'), {
    openapi: {
      info: { title: 'Fulfillment Service API', version: '1.0.0' },
    },
  });

  await app.register(import('@fastify/swagger-ui'), {
    routePrefix: '/docs',
  });

  // ─── Health check ─────────────────────────────────────────────
  app.get('/health', async (_req, reply) => {
    return reply.code(200).send({
      status: 'healthy',
      service: 'fulfillment-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Routes ───────────────────────────────────────────────────
  await app.register(stockRoutes, { stockService });
  await app.register(fulfillmentOrderRoutes, { fulfillmentOrderService });

  // ─── Error handler (RFC 7807) ─────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode ?? 500;
    app.log.error({ err: error, url: request.url }, error.message);
    return reply.status(status).send({
      type: `https://dealflow360.com/errors/${error.code ?? 'internal-error'}`,
      title: error.message,
      status,
      detail: error.message,
      instance: request.url,
    });
  });

  return app;
}
