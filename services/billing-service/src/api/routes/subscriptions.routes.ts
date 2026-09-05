import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { BillingService } from '../../domain/services/billing.service';
import { SubscriptionRepository } from '../../db/repositories/subscription.repository';
import { jwtAuthMiddleware } from '../middleware/auth.middleware';

const updateQuantitySchema = z.object({
  newQuantity: z.number().int().positive('Quantity must be a positive integer'),
  changeDate: z.string().optional(),
});

const cancelSubscriptionSchema = z.object({
  cancelledAt: z.string().optional(),
  reason: z.string().optional(),
});

export function subscriptionsRoutes(
  billingService: BillingService,
  subscriptionRepo: SubscriptionRepository,
): FastifyPluginAsync {
  return async function (fastify) {
    fastify.addHook('preHandler', jwtAuthMiddleware);

    // GET /billing/subscriptions/upcoming - Upcoming renewals in next 30 days (REQ-RPT-006)
    fastify.get('/upcoming', async (request, reply) => {
      const companyId = request.user?.companyId || 'default';
      const days = (request.query as any)?.days ? parseInt((request.query as any).days, 10) : 30;

      const upcoming = await billingService.getUpcomingRenewals(companyId, days);
      return reply.code(200).send(upcoming);
    });

    // GET /billing/subscriptions - List subscriptions
    fastify.get('/', async (request, reply) => {
      const query = request.query as any;
      const companyId = query.companyId || request.user?.companyId || 'default';
      const orderId = query.orderId;
      const customerId = query.customerId;
      const status = query.status;
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;

      const result = await subscriptionRepo.list(
        {
          companyId,
          orderId,
          customerId,
          status,
        },
        page,
        limit,
      );

      return reply.code(200).send(result);
    });

    // GET /billing/subscriptions/:id - Get single subscription with billing history
    fastify.get('/:id', async (request, reply) => {
      const { id } = request.params as { id: string };

      const subscription = await subscriptionRepo.findById(id);
      if (!subscription) {
        return reply.code(404).send({
          type: 'https://dealflow360.com/errors/subscription-not-found',
          title: 'Subscription Not Found',
          status: 404,
          detail: `Subscription with ID ${id} was not found`,
          instance: request.url,
        });
      }

      return reply.code(200).send(subscription);
    });

    // PUT /billing/subscriptions/:id/quantity - Mid-cycle quantity change (REQ-F-132, CHECK-BILL-004)
    fastify.put('/:id/quantity', async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsedBody = updateQuantitySchema.safeParse(request.body);

      if (!parsedBody.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: parsedBody.error.message,
          instance: request.url,
        });
      }

      const result = await billingService.updateSubscriptionQuantity(
        id,
        parsedBody.data.newQuantity,
        parsedBody.data.changeDate,
      );

      return reply.code(200).send(result);
    });

    // POST /billing/subscriptions/:id/cancel - Cancel subscription (REQ-F-133, REQ-F-134, CHECK-BILL-005)
    fastify.post('/:id/cancel', async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsedBody = cancelSubscriptionSchema.safeParse(request.body || {});

      if (!parsedBody.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: parsedBody.error.message,
          instance: request.url,
        });
      }

      const result = await billingService.cancelSubscription(
        id,
        parsedBody.data.cancelledAt,
        parsedBody.data.reason,
      );

      return reply.code(200).send(result);
    });
  };
}
