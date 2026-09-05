import type { FastifyPluginAsync } from 'fastify';
import { BillingService } from '../../domain/services/billing.service';
import { jwtAuthMiddleware } from '../middleware/auth.middleware';

export function schedulesRoutes(billingService: BillingService): FastifyPluginAsync {
  return async function (fastify) {
    fastify.addHook('preHandler', jwtAuthMiddleware);

    // GET /billing/schedules?orderId=:id (REQ-F-131, CHECK-BILL-006)
    fastify.get('/', async (request, reply) => {
      const { orderId } = request.query as { orderId?: string };

      if (!orderId) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/missing-parameter',
          title: 'Missing Parameter',
          status: 400,
          detail: 'Query parameter orderId is required',
          instance: request.url,
        });
      }

      const schedule = await billingService.getBillingSchedule(orderId);
      return reply.code(200).send(schedule);
    });
  };
}
