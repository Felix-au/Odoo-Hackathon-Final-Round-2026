import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AnalyticsService } from '../../domain/services/analytics.service';
import { jwtAuthMiddleware, requireRole } from '../middleware/auth.middleware';

const nudgeSchema = z.object({
  type: z.enum(['EMAIL_NUDGE', 'ESCALATION']).default('EMAIL_NUDGE'),
  message: z.string().min(1, 'Message is required'),
});

export function alertsRoutes(analyticsService: AnalyticsService): FastifyPluginAsync {
  return async function (fastify) {
    fastify.addHook('preHandler', jwtAuthMiddleware);

    // POST /analytics/alerts/:id/nudge (REQ-F-154, REQ-BONUS-004, CHECK-ANA-005)
    fastify.post(
      '/:id/nudge',
      { preHandler: [requireRole('ADMIN', 'SALES_MANAGER')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const parsed = nudgeSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.code(400).send({
            type: 'https://dealflow360.com/errors/validation-error',
            title: 'Validation Error',
            status: 400,
            detail: parsed.error.message,
            instance: request.url,
          });
        }

        const userId = request.user?.id || 'system';
        const result = await analyticsService.triggerNudge(
          id,
          parsed.data.type,
          parsed.data.message,
          userId,
        );

        return reply.code(200).send(result);
      },
    );

    // POST /analytics/alerts/:id/escalate (CFO / Finance escalates to Manager, or Admin)
    fastify.post(
      '/:id/escalate',
      { preHandler: [requireRole('ADMIN', 'FINANCE')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const parsed = nudgeSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.code(400).send({
            type: 'https://dealflow360.com/errors/validation-error',
            title: 'Validation Error',
            status: 400,
            detail: parsed.error.message,
            instance: request.url,
          });
        }

        const userId = request.user?.id || 'system';
        const result = await analyticsService.triggerNudge(
          id,
          'ESCALATION',
          parsed.data.message,
          userId,
        );

        return reply.code(200).send(result);
      },
    );

    // POST /analytics/alerts/:id/resolve
    fastify.post(
      '/:id/resolve',
      { preHandler: [requireRole('ADMIN', 'SALES_MANAGER')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const resolved = await analyticsService.resolveAlert(id);
        return reply.code(200).send(resolved);
      },
    );
  };
}
