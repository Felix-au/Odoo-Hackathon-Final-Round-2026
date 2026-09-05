import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { env } from './config/env';

// Repositories
import { ProductRepository } from './db/repositories/product.repository';
import { CategoryRepository } from './db/repositories/category.repository';
import { PriceListRepository } from './db/repositories/price-list.repository';
import { DiscountTierRepository } from './db/repositories/discount-tier.repository';
import { ApprovalChainRepository } from './db/repositories/approval-chain.repository';
import { WarehouseRepository } from './db/repositories/warehouse.repository';
import { SubscriptionPlanRepository } from './db/repositories/subscription-plan.repository';
import { UpsellRuleRepository } from './db/repositories/upsell-rule.repository';

// Cache
import { CatalogCache } from './cache/catalog-cache';

// Domain Services
import { ProductService } from './domain/services/product.service';
import { PriceListService } from './domain/services/price-list.service';
import { DiscountTierService } from './domain/services/discount-tier.service';
import { ApprovalChainService } from './domain/services/approval-chain.service';
import { UpsellRuleService } from './domain/services/upsell-rule.service';

// Routes
import { productsRoutes } from './api/routes/products.routes';
import { categoriesRoutes } from './api/routes/categories.routes';
import { priceListsRoutes } from './api/routes/price-lists.routes';
import { discountTiersRoutes } from './api/routes/discount-tiers.routes';
import { approvalChainsRoutes } from './api/routes/approval-chains.routes';
import { warehousesRoutes } from './api/routes/warehouses.routes';
import { subscriptionPlansRoutes } from './api/routes/subscription-plans.routes';
import { upsellRulesRoutes } from './api/routes/upsell-rules.routes';

export async function buildApp() {
  // ─── Infrastructure ──────────────────────────────────────
  const prisma = new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

  const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
  redis.on('error', (err) => console.error('[Redis] Error:', err.message));

  // ─── Repositories ────────────────────────────────────────
  const productRepo = new ProductRepository(prisma);
  const categoryRepo = new CategoryRepository(prisma);
  const priceListRepo = new PriceListRepository(prisma);
  const discountTierRepo = new DiscountTierRepository(prisma);
  const approvalChainRepo = new ApprovalChainRepository(prisma);
  const warehouseRepo = new WarehouseRepository(prisma);
  const subscriptionPlanRepo = new SubscriptionPlanRepository(prisma);
  const upsellRuleRepo = new UpsellRuleRepository(prisma);

  // ─── Cache ───────────────────────────────────────────────
  const cache = new CatalogCache(redis);

  // ─── Domain Services ─────────────────────────────────────
  const productService = new ProductService(productRepo, cache);
  const priceListService = new PriceListService(priceListRepo, productRepo, cache);
  const discountTierService = new DiscountTierService(discountTierRepo, cache);
  const approvalChainService = new ApprovalChainService(approvalChainRepo, cache);
  const upsellRuleService = new UpsellRuleService(upsellRuleRepo, cache);

  // ─── Fastify App ─────────────────────────────────────────
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(fastifyCors, {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: 200,
    timeWindow: '1 minute',
    // Only use Redis store in non-test environments; mocked Redis lacks defineCommand
    ...(env.NODE_ENV !== 'test' && { redis }),
    keyGenerator: (req) => req.ip ?? 'unknown',
  });

  // ─── Health Check ────────────────────────────────────────
  app.get('/health', async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      await redis.ping();
      return reply.code(200).send({
        status: 'healthy',
        service: 'catalog-service',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return reply.code(503).send({
        status: 'unhealthy',
        service: 'catalog-service',
        error: err instanceof Error ? err.message : 'Unknown',
      });
    }
  });

  // ─── Routes ──────────────────────────────────────────────
  await app.register(productsRoutes(productService), { prefix: '/catalog/products' });
  await app.register(categoriesRoutes(categoryRepo), { prefix: '/catalog/categories' });
  await app.register(priceListsRoutes(priceListService), { prefix: '/catalog/price-lists' });
  await app.register(discountTiersRoutes(discountTierService), { prefix: '/catalog/discount-tiers' });
  await app.register(approvalChainsRoutes(approvalChainService), { prefix: '/catalog/approval-chains' });
  await app.register(warehousesRoutes(warehouseRepo, cache), { prefix: '/catalog/warehouses' });
  await app.register(subscriptionPlansRoutes(subscriptionPlanRepo), { prefix: '/catalog/subscription-plans' });
  await app.register(upsellRulesRoutes(upsellRuleService), { prefix: '/catalog/upsell-rules' });

  // ─── Error Handler ───────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
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

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });

  return app;
}
