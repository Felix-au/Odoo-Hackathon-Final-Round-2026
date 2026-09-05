import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DiscountTierService } from '../../domain/services/discount-tier.service';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';
import { requireRole } from '../middleware/role-guard.middleware';

const CreateDiscountTierSchema = z.object({
  customerTier: z.enum(['BRONZE', 'SILVER', 'GOLD']),
  categoryId: z.string().uuid().optional(),
  ceilingPct: z.number().min(0).max(100),
});

export function discountTiersRoutes(discountTierService: DiscountTierService) {
  return async function (fastify: FastifyInstance) {

    fastify.get('/', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const tiers = await discountTierService.getAll(request.user!.companyId);
      return reply.code(200).send({ data: tiers });
    });

    // GET /catalog/discount-tiers/ceilings — Redis cached (CHECK-CAT-002)
    fastify.get('/ceilings', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const ceilings = await discountTierService.getCeilings(request.user!.companyId);
      return reply.code(200).send(ceilings);
    });

    fastify.post('/', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const body = CreateDiscountTierSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      }
      const tier = await discountTierService.create(request.user!.companyId, body.data);
      return reply.code(201).send(tier);
    });

    fastify.delete('/:id', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      await discountTierService.delete(request.user!.companyId, id);
      return reply.code(204).send();
    });
  };
}
