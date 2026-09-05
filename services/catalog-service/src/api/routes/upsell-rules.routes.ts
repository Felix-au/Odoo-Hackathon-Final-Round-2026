import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UpsellRuleService } from '../../domain/services/upsell-rule.service';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';
import { requireRole } from '../middleware/role-guard.middleware';

const CreateUpsellRuleSchema = z.object({
  triggerProductId: z.string().uuid(),
  suggestedProductId: z.string().uuid(),
  minMarginPct: z.number().min(0).max(100).default(0),
  isPromoted: z.boolean().default(false),
  priority: z.number().int().default(0),
});

export function upsellRulesRoutes(upsellRuleService: UpsellRuleService) {
  return async function (fastify: FastifyInstance) {

    fastify.get('/', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const rules = await upsellRuleService.getAll(request.user!.companyId);
      return reply.code(200).send({ data: rules });
    });

    // GET /catalog/upsell-rules/suggestions?productIds=id1,id2&marginPct=25 (CHECK-CAT-004)
    fastify.get('/suggestions', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const query = request.query as { productIds?: string; marginPct?: string };

      if (!query.productIds) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: 'productIds query parameter is required (comma-separated UUIDs)',
          instance: request.url,
        });
      }

      const productIds = query.productIds.split(',').map((id) => id.trim()).filter(Boolean);
      const marginPct = query.marginPct ? parseFloat(query.marginPct) : undefined;

      const suggestions = await upsellRuleService.getSuggestions(
        request.user!.companyId,
        productIds,
        marginPct,
      );

      return reply.code(200).send({ data: suggestions, total: suggestions.length });
    });

    fastify.post('/', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const body = CreateUpsellRuleSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      }
      const rule = await upsellRuleService.create(request.user!.companyId, body.data);
      return reply.code(201).send(rule);
    });

    fastify.put('/:id', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = CreateUpsellRuleSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });
      const rule = await upsellRuleService.update(request.user!.companyId, id, body.data);
      return reply.code(200).send(rule);
    });

    fastify.delete('/:id', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      await upsellRuleService.delete(request.user!.companyId, id);
      return reply.code(204).send();
    });
  };
}
