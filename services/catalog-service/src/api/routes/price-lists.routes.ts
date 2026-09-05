import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { PriceListService } from '../../domain/services/price-list.service';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';
import { requireRole } from '../middleware/role-guard.middleware';

const CreatePriceListSchema = z.object({
  name: z.string().min(1),
  customerTier: z.enum(['BRONZE', 'SILVER', 'GOLD']),
  currency: z.string().length(3).default('USD'),
});

export function priceListsRoutes(priceListService: PriceListService) {
  return async function (fastify: FastifyInstance) {

    fastify.get('/', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const lists = await priceListService.getAll(request.user!.companyId);
      return reply.code(200).send({ data: lists });
    });

    // GET /catalog/price-lists/resolve — must be registered BEFORE /:id
    fastify.get('/resolve', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const { productId, customerTier, currency, quantity } = query;

      if (!productId || !customerTier || !currency) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: 'productId, customerTier, and currency are required',
          instance: request.url,
        });
      }

      const result = await priceListService.resolvePrice(
        request.user!.companyId,
        productId,
        customerTier as 'BRONZE' | 'SILVER' | 'GOLD',
        currency,
        quantity ? parseInt(quantity, 10) : 1,
      );

      if (!result) {
        return reply.code(404).send({ error: 'PRODUCT_NOT_FOUND' });
      }

      return reply.code(200).send(result);
    });

    fastify.post('/', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const body = CreatePriceListSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      }
      const list = await priceListService.create(request.user!.companyId, body.data);
      return reply.code(201).send(list);
    });

    fastify.put('/:id', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({ name: z.string().optional(), isActive: z.boolean().optional() }).safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });
      const list = await priceListService.update(id, body.data);
      return reply.code(200).send(list);
    });
  };
}
