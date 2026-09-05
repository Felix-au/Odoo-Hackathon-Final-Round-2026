import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SubscriptionPlanRepository } from '../../db/repositories/subscription-plan.repository';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';
import { requireRole } from '../middleware/role-guard.middleware';

const CreatePlanSchema = z.object({
  name: z.string().min(1),
  interval: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  basePrice: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  prorationMode: z.enum(['DAILY', 'NONE']).default('DAILY'),
  cancellationPolicy: z.enum(['end_of_period', 'immediate']).default('end_of_period'),
  partialRefundPct: z.number().min(0).max(100).default(0),
});

export function subscriptionPlansRoutes(planRepo: SubscriptionPlanRepository) {
  return async function (fastify: FastifyInstance) {

    fastify.get('/', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const plans = await planRepo.findAll(request.user!.companyId);
      return reply.code(200).send({ data: plans });
    });

    fastify.get('/:id', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const plan = await planRepo.findById(id);
      if (!plan) return reply.code(404).send({ error: 'NOT_FOUND' });
      return reply.code(200).send(plan);
    });

    fastify.post('/', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const body = CreatePlanSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      }
      const plan = await planRepo.create({ ...body.data, companyId: request.user!.companyId });
      return reply.code(201).send(plan);
    });

    fastify.put('/:id', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = CreatePlanSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });
      const plan = await planRepo.update(id, body.data);
      return reply.code(200).send(plan);
    });

    // POST /catalog/subscription-plans/:id/products — link plan to product
    fastify.post('/:id/products', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z.object({ productId: z.string().uuid() }).safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });
      await planRepo.linkToProduct(id, body.data.productId);
      return reply.code(200).send({ message: 'Plan linked to product' });
    });

    fastify.delete('/:id/products/:productId', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const { id, productId } = request.params as { id: string; productId: string };
      await planRepo.unlinkFromProduct(id, productId);
      return reply.code(204).send();
    });
  };
}
