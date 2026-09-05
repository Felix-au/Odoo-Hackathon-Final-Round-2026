import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { QuotationStatus } from '@prisma/client';
import type { QuotationService } from '../../domain/services/quotation.service';
import { jwtAuthMiddleware, requireRole } from '../middleware/auth.middleware';
import { OptimisticLockError } from '../../db/repositories/quotation.repository';

const CreateQuotationSchema = z.object({
  customerId: z.string().min(1),
  currency: z.string().default('USD'),
  notes: z.string().optional(),
  validUntil: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

const UpdateQuotationMetadataSchema = z.object({
  version: z.number().int().optional(),
  notes: z.string().optional(),
  currency: z.string().optional(),
  validUntil: z.string().optional(),
});

const AddLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  productName: z.string().optional().default(''),
  categoryId: z.string().optional().default(''),
  categoryName: z.string().optional().default(''),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0).default(0),
  costPrice: z.number().min(0).optional().default(0),
  discountPct: z.number().min(0).max(100).default(0),
  taxAmount: z.number().min(0).optional().default(0),
  isRecurring: z.boolean().optional().default(false),
  planId: z.string().optional(),
  planInterval: z.string().optional(),
  sortOrder: z.number().int().optional().default(0),
});

const UpdateLineSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  unitPrice: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  discountPct: z.number().min(0).max(100).optional(),
  taxAmount: z.number().min(0).optional(),
});

const ApprovalActionSchema = z.object({
  reason: z.string().optional(),
});

const RejectReturnSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

export function quotationsRoutes(quotationService: QuotationService) {
  return async function (fastify: FastifyInstance) {
    // GET /quotations/pipeline (Kanban board)
    fastify.get('/pipeline', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const user = request.user!;
      const repId = user.role === 'SALES_REP' ? user.id : undefined;
      const pipeline = await quotationService.getPipeline(user.companyId, repId);
      return reply.code(200).send({ data: pipeline });
    });

    // GET /quotations (list quotations)
    fastify.get('/', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const user = request.user!;
      const query = request.query as {
        repId?: string;
        customerId?: string;
        status?: QuotationStatus;
        search?: string;
        page?: string;
        pageSize?: string;
      };

      // Role check: SALES_REP can only access their own quotes
      let repIdFilter = query.repId;
      if (user.role === 'SALES_REP') {
        repIdFilter = user.id;
      }

      const page = query.page ? parseInt(query.page, 10) : 1;
      const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 20;

      const result = await quotationService.listQuotations({
        companyId: user.companyId,
        repId: repIdFilter,
        customerId: query.customerId,
        status: query.status,
        search: query.search,
        page,
        pageSize,
      });

      return reply.code(200).send(result);
    });

    // POST /quotations (create draft quotation)
    fastify.post(
      '/',
      { preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER')] },
      async (request, reply) => {
        const user = request.user!;
        const parsed = CreateQuotationSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            type: 'https://dealflow360.com/errors/validation-error',
            title: 'Validation Error',
            status: 400,
            detail: parsed.error.message,
            instance: request.url,
          });
        }

        const validUntil = parsed.data.validUntil ? new Date(parsed.data.validUntil) : null;

        const quotation = await quotationService.createQuotation({
          companyId: user.companyId,
          customerId: parsed.data.customerId,
          repId: user.id,
          currency: parsed.data.currency,
          notes: parsed.data.notes,
          validUntil,
        });

        return reply.code(201).send(quotation);
      },
    );

    // GET /quotations/:id
    fastify.get('/:id', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const quotation = await quotationService.getQuotation(id);

      // SALES_REP check: cannot view other rep's quote
      const user = request.user!;
      if (user.role === 'SALES_REP' && quotation.repId !== user.id) {
        return reply.code(403).send({
          type: 'https://dealflow360.com/errors/insufficient-role',
          title: 'Forbidden',
          status: 403,
          detail: 'Sales reps can only access their own quotations',
          instance: request.url,
        });
      }

      return reply.code(200).send(quotation);
    });

    // PUT /quotations/:id (update metadata with optimistic lock)
    fastify.put('/:id', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const quotation = await quotationService.getQuotation(id);

      if (user.role === 'SALES_REP' && quotation.repId !== user.id) {
        return reply.code(403).send({
          type: 'https://dealflow360.com/errors/insufficient-role',
          title: 'Forbidden',
          status: 403,
          detail: 'Sales reps can only edit their own quotations',
          instance: request.url,
        });
      }

      const parsed = UpdateQuotationMetadataSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: parsed.error.message,
          instance: request.url,
        });
      }

      try {
        const updated = await quotationService.updateQuotationMetadata(
          id,
          parsed.data.version,
          {
            notes: parsed.data.notes,
            currency: parsed.data.currency,
            validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : undefined,
          },
        );
        return reply.code(200).send(updated);
      } catch (err: any) {
        if (err instanceof OptimisticLockError) {
          return reply.code(409).send({
            type: 'https://dealflow360.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: err.message,
            instance: request.url,
          });
        }
        throw err;
      }
    });

    // DELETE /quotations/:id (delete draft)
    fastify.delete('/:id', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const quotation = await quotationService.getQuotation(id);

      if (user.role === 'SALES_REP' && quotation.repId !== user.id) {
        return reply.code(403).send({
          type: 'https://dealflow360.com/errors/insufficient-role',
          title: 'Forbidden',
          status: 403,
          detail: 'Sales reps can only delete their own quotations',
          instance: request.url,
        });
      }

      await quotationService.deleteQuotation(id);
      return reply.code(204).send();
    });

    // POST /quotations/:id/lines (add line)
    fastify.post('/:id/lines', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = AddLineSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: parsed.error.message,
          instance: request.url,
        });
      }

      const updated = await quotationService.addLine(id, parsed.data);
      const risk = await quotationService.computeRiskScore(id);

      return reply.code(200).send({
        ...updated,
        lineViolations: risk.lineViolations,
      });
    });

    // PUT /quotations/:id/lines/:lineId (update line)
    fastify.put('/:id/lines/:lineId', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const { id, lineId } = request.params as { id: string; lineId: string };
      const parsed = UpdateLineSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: parsed.error.message,
          instance: request.url,
        });
      }

      const updated = await quotationService.updateLine(id, lineId, parsed.data);
      const risk = await quotationService.computeRiskScore(id);

      return reply.code(200).send({
        ...updated,
        lineViolations: risk.lineViolations,
      });
    });

    // DELETE /quotations/:id/lines/:lineId (remove line)
    fastify.delete('/:id/lines/:lineId', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const { id, lineId } = request.params as { id: string; lineId: string };
      const updated = await quotationService.removeLine(id, lineId);
      return reply.code(200).send(updated);
    });

    // GET /quotations/:id/risk-score
    fastify.get('/:id/risk-score', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await quotationService.computeRiskScore(id);
      return reply.code(200).send(result);
    });

    // GET /quotations/:id/upsell-suggestions
    fastify.get('/:id/upsell-suggestions', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const suggestions = await quotationService.getUpsellSuggestions(id);
      return reply.code(200).send({ suggestions });
    });

    // POST /quotations/:id/submit
    fastify.post(
      '/:id/submit',
      { preHandler: [jwtAuthMiddleware, requireRole('SALES_REP', 'ADMIN', 'SALES_MANAGER')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await quotationService.submitForApproval(id, request.user!.id);
        return reply.code(200).send(result);
      },
    );

    // POST /quotations/:id/approve
    fastify.post(
      '/:id/approve',
      { preHandler: [jwtAuthMiddleware, requireRole('SALES_MANAGER', 'FINANCE', 'ADMIN')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const parsed = ApprovalActionSchema.safeParse(request.body || {});
        const user = request.user!;

        const result = await quotationService.approve(
          id,
          { id: user.id, name: user.email, role: user.role },
          parsed.success ? parsed.data.reason : undefined,
        );

        return reply.code(200).send(result);
      },
    );

    // POST /quotations/:id/reject
    fastify.post(
      '/:id/reject',
      { preHandler: [jwtAuthMiddleware, requireRole('SALES_MANAGER', 'FINANCE', 'ADMIN')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const parsed = RejectReturnSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            type: 'https://dealflow360.com/errors/validation-error',
            title: 'Validation Error',
            status: 400,
            detail: 'Rejection reason is required',
            instance: request.url,
          });
        }

        const user = request.user!;
        const result = await quotationService.reject(
          id,
          { id: user.id, name: user.email, role: user.role },
          parsed.data.reason,
        );

        return reply.code(200).send(result);
      },
    );

    // POST /quotations/:id/return
    fastify.post(
      '/:id/return',
      { preHandler: [jwtAuthMiddleware, requireRole('SALES_MANAGER', 'FINANCE', 'ADMIN')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const parsed = RejectReturnSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            type: 'https://dealflow360.com/errors/validation-error',
            title: 'Validation Error',
            status: 400,
            detail: 'Return reason is required',
            instance: request.url,
          });
        }

        const user = request.user!;
        const result = await quotationService.returnForRevision(
          id,
          { id: user.id, name: user.email, role: user.role },
          parsed.data.reason,
        );

        return reply.code(200).send(result);
      },
    );

    // POST /quotations/:id/send
    fastify.post(
      '/:id/send',
      { preHandler: [jwtAuthMiddleware, requireRole('SALES_REP', 'SALES_MANAGER', 'ADMIN')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await quotationService.send(id, request.user!.id);
        return reply.code(200).send(result);
      },
    );

    // POST /quotations/:id/confirm (with Idempotency-Key support)
    fastify.post(
      '/:id/confirm',
      { preHandler: [jwtAuthMiddleware, requireRole('SALES_REP', 'ADMIN', 'SALES_MANAGER')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const idempotencyKey = (request.headers['idempotency-key'] as string) || null;

        const result = await quotationService.confirm(id, request.user!.id, idempotencyKey);
        return reply.code(200).send(result);
      },
    );

    // POST /quotations/:id/mark-lost
    fastify.post(
      '/:id/mark-lost',
      { preHandler: [jwtAuthMiddleware, requireRole('SALES_REP', 'ADMIN', 'SALES_MANAGER')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const result = await quotationService.markLost(id, request.user!.id);
        return reply.code(200).send(result);
      },
    );

    // GET /quotations/:id/approval-log
    fastify.get('/:id/approval-log', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const quotation = await quotationService.getQuotation(id);
      return reply.code(200).send({ data: quotation.approvalLogs });
    });
  };
}
