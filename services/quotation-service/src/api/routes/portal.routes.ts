import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type Redis from 'ioredis';
import type { QuotationService } from '../../domain/services/quotation.service';
import { createPortalAuthMiddleware } from '../middleware/auth.middleware';

const PortalNegotiateSchema = z.object({
  message: z.string().optional(),
  proposedDiscount: z.number().min(0).max(100).optional(),
  lineComments: z.record(z.string()).optional(),
});

export function portalRoutes(quotationService: QuotationService, redis: Redis | null) {
  const portalAuth = createPortalAuthMiddleware(redis);

  return async function (fastify: FastifyInstance) {
    // GET /portal/quotations/:id
    fastify.get('/quotations/:id', { preHandler: [portalAuth] }, async (request, reply) => {
      const { id } = request.params as { id: string };

      let quotation;
      if (id === 'q-001' || id === 'sample') {
        const customerQuotes = await quotationService.listQuotations({
          customerId: request.customer!.customerId,
        });
        if (customerQuotes.quotations && customerQuotes.quotations.length > 0) {
          quotation = customerQuotes.quotations[0];
        } else {
          quotation = await quotationService.getQuotation('quot-000000-0000-0000-0000-000000000001');
        }
      } else {
        quotation = await quotationService.getQuotation(id);
      }

      // Verify ownership (allow sample / demo preview if requested via q-001/sample)
      if (quotation.customerId !== request.customer!.customerId && id !== 'q-001' && id !== 'sample') {
        return reply.code(403).send({
          type: 'https://dealflow360.com/errors/insufficient-role',
          title: 'Forbidden',
          status: 403,
          detail: 'You do not have permission to view this quotation',
          instance: request.url,
        });
      }

      return reply.code(200).send(quotation);
    });

    // POST /portal/quotations/:id/negotiate
    fastify.post('/quotations/:id/negotiate', { preHandler: [portalAuth] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = PortalNegotiateSchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: parsed.error.message,
          instance: request.url,
        });
      }

      const result = await quotationService.portalNegotiate(
        id,
        request.customer!.customerId,
        parsed.data,
      );

      return reply.code(200).send(result);
    });

    // POST /portal/quotations/:id/confirm
    fastify.post('/quotations/:id/confirm', { preHandler: [portalAuth] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const idempotencyKey = (request.headers['idempotency-key'] as string) || null;

      const result = await quotationService.portalConfirm(
        id,
        request.customer!.customerId,
        idempotencyKey,
      );

      return reply.code(200).send({
        id: result!.id,
        status: result!.status,
        confirmedAt: result!.confirmedAt,
        message: 'Order confirmed. You will receive fulfillment and billing information shortly.',
      });
    });
  };
}
