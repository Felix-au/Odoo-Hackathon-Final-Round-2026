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
  const app = fastify({ logger: { level: env.LOG_LEVEL } });

  // ─── Redis ────────────────────────────────────────────────────
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  redis.on('error', (err: Error) => app.log.warn(`[Redis] Error: ${err.message}`));

  if (env.NODE_ENV !== 'test') {
    await redis.connect().catch(() => {
      app.log.warn('[Redis] Could not connect — continuing without Redis');
    });
  }

  // ─── Dependencies ─────────────────────────────────────────────
  const eventPublisher = new EventPublisher(redis);
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

  await app.register(import('@fastify/rate-limit'), {
    max: 200,
    timeWindow: '1 minute',
    ...(env.NODE_ENV !== 'test' ? { redis } : {}),
  });

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
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      return reply.code(503).send({ status: 'unhealthy', service: 'fulfillment-service', reason: 'db' });
    }
    return reply.send({ status: 'healthy', service: 'fulfillment-service' });
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
