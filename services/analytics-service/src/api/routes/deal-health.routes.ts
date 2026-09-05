import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AnalyticsService } from '../../domain/services/analytics.service';
import { jwtAuthMiddleware, requireRole } from '../middleware/auth.middleware';

const configSchema = z.object({
  stallDaysThreshold: z.number().int().positive().optional(),
  anomalyStdDevFactor: z.number().positive().optional(),
  deliverySlippageDays: z.number().int().positive().optional(),
});

const nudgeSchema = z.object({
  type: z.enum(['EMAIL_NUDGE', 'ESCALATION']).default('EMAIL_NUDGE'),
  message: z.string().min(1, 'Message is required'),
});

export function dealHealthRoutes(analyticsService: AnalyticsService): FastifyPluginAsync {
  return async function (fastify) {
    fastify.addHook('preHandler', jwtAuthMiddleware);

    // GET /analytics/deal-health (REQ-F-150, REQ-F-151, CHECK-ANA-002, CHECK-ANA-003)
    fastify.get(
      '/',
      { preHandler: [requireRole('ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE')] },
      async (request, reply) => {
        const query = request.query as any;
        const companyId = query.companyId || request.user?.companyId || 'default';

        const health = await analyticsService.getDealHealth(companyId);
        return reply.code(200).send(health);
      },
    );

    // POST /analytics/deal-health/check - trigger health check calculation
    fastify.post(
      '/check',
      { preHandler: [requireRole('ADMIN', 'SALES_MANAGER')] },
      async (request, reply) => {
        const query = request.query as any;
        const companyId = query.companyId || request.user?.companyId || 'default';

        const alerts = await analyticsService.runDealHealthCheck(companyId);
        return reply.code(200).send({ generated: alerts.length, alerts });
      },
    );

    // GET /analytics/deal-health/config
    fastify.get(
      '/config',
      { preHandler: [requireRole('ADMIN', 'SALES_MANAGER')] },
      async (request, reply) => {
        const companyId = request.user?.companyId || 'default';
        const config = await analyticsService.getDealHealthConfig(companyId);
        return reply.code(200).send(config);
      },
    );

    // PUT /analytics/deal-health/config
    fastify.put(
      '/config',
      { preHandler: [requireRole('ADMIN')] },
      async (request, reply) => {
        const companyId = request.user?.companyId || 'default';
        const parsed = configSchema.safeParse(request.body);

        if (!parsed.success) {
          return reply.code(400).send({
            type: 'https://dealflow360.com/errors/validation-error',
            title: 'Validation Error',
            status: 400,
            detail: parsed.error.message,
            instance: request.url,
          });
        }

        const updated = await analyticsService.updateDealHealthConfig(companyId, parsed.data);
        return reply.code(200).send(updated);
      },
    );

    // POST /analytics/alerts/:id/nudge (REQ-F-154, REQ-BONUS-004, CHECK-ANA-005)
    fastify.post(
      '/alerts/:id/nudge',
      { preHandler: [requireRole('ADMIN', 'SALES_MANAGER', 'SALES_REP')] },
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

    // POST /analytics/alerts/:id/escalate
    fastify.post(
      '/alerts/:id/escalate',
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
          'ESCALATION',
          parsed.data.message,
          userId,
        );

        return reply.code(200).send(result);
      },
    );

    // POST /analytics/alerts/:id/resolve
    fastify.post(
      '/alerts/:id/resolve',
      { preHandler: [requireRole('ADMIN', 'SALES_MANAGER')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const resolved = await analyticsService.resolveAlert(id);
        return reply.code(200).send(resolved);
      },
    );
  };
}
