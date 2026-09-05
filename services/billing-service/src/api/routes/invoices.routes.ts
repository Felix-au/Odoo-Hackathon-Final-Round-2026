import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { BillingService } from '../../domain/services/billing.service';
import { InvoiceRepository } from '../../db/repositories/invoice.repository';
import { jwtAuthMiddleware, requireRole } from '../middleware/auth.middleware';

const recordPaymentSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform((val) => Number(val)),
  currency: z.string().default('USD'),
  method: z.string().min(1),
  reference: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const voidInvoiceSchema = z.object({
  reason: z.string().optional(),
});

export function invoicesRoutes(
  billingService: BillingService,
  invoiceRepo: InvoiceRepository,
): FastifyPluginAsync {
  return async function (fastify) {
    fastify.addHook('preHandler', jwtAuthMiddleware);

    // GET /billing/invoices - List invoices
    fastify.get('/', async (request, reply) => {
      const query = request.query as any;
      const companyId = query.companyId || request.user?.companyId || 'default';
      const orderId = query.orderId;
      const customerId = query.customerId;
      const status = query.status;
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 20;

      const result = await invoiceRepo.list(
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

    // GET /billing/invoices/:id - Get single invoice with lines & payments
    fastify.get('/:id', async (request, reply) => {
      const { id } = request.params as { id: string };

      const invoice = await invoiceRepo.findById(id);
      if (!invoice) {
        return reply.code(404).send({
          type: 'https://dealflow360.com/errors/invoice-not-found',
          title: 'Invoice Not Found',
          status: 404,
          detail: `Invoice with ID ${id} was not found`,
          instance: request.url,
        });
      }

      return reply.code(200).send(invoice);
    });

    // POST /billing/invoices/:id/send - Mark invoice as SENT
    fastify.post(
      '/:id/send',
      { preHandler: [requireRole('ADMIN', 'SALES_MANAGER', 'SALES_REP', 'FINANCE')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };

        const updated = await billingService.sendInvoice(id);
        return reply.code(200).send(updated);
      },
    );

    // POST /billing/invoices/:id/payments - Record payment (FINANCE, ADMIN)
    fastify.post(
      '/:id/payments',
      { preHandler: [requireRole('ADMIN', 'FINANCE')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const companyId = request.user?.companyId || 'default';
        const parsedBody = recordPaymentSchema.safeParse(request.body);

        if (!parsedBody.success) {
          return reply.code(400).send({
            type: 'https://dealflow360.com/errors/validation-error',
            title: 'Validation Error',
            status: 400,
            detail: parsedBody.error.message,
            instance: request.url,
          });
        }

        const recordedBy = request.user?.id || 'system';
        const result = await billingService.recordPayment(id, {
          companyId,
          amount: parsedBody.data.amount,
          currency: parsedBody.data.currency,
          method: parsedBody.data.method,
          reference: parsedBody.data.reference,
          recordedBy,
          idempotencyKey: parsedBody.data.idempotencyKey,
        });

        return reply.code(200).send(result);
      },
    );

    // POST /billing/invoices/:id/void - Void invoice (FINANCE, ADMIN)
    fastify.post(
      '/:id/void',
      { preHandler: [requireRole('ADMIN', 'FINANCE')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await billingService.voidInvoice(id);
        return reply.code(200).send(result);
      },
    );
  };
}
