import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ApprovalChainService } from '../../domain/services/approval-chain.service';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';
import { requireRole } from '../middleware/role-guard.middleware';

const CreateApprovalChainSchema = z.object({
  name: z.string().min(1),
  minRiskScore: z.number().min(0),
  maxRiskScore: z.number().min(0),
  requiredRoles: z.array(z.enum(['SALES_MANAGER', 'FINANCE'])).min(0),
});

export function approvalChainsRoutes(approvalChainService: ApprovalChainService) {
  return async function (fastify: FastifyInstance) {

    fastify.get('/', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const chains = await approvalChainService.getAll(request.user!.companyId);
      return reply.code(200).send({ data: chains });
    });

    // GET /catalog/approval-chains/resolve?riskScore=75 (CHECK-CAT-003)
    fastify.get('/resolve', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const query = request.query as { riskScore?: string };
      const riskScore = parseFloat(query.riskScore ?? '');

      if (isNaN(riskScore)) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: 'riskScore query parameter must be a valid number',
          instance: request.url,
        });
      }

      const chain = await approvalChainService.resolveForScore(request.user!.companyId, riskScore);
      return reply.code(200).send({
        riskScore,
        requiredRoles: chain?.requiredRoles ?? [],
        chain: chain ?? null,
      });
    });

    fastify.post('/', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const body = CreateApprovalChainSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      }
      const chain = await approvalChainService.create(request.user!.companyId, body.data);
      return reply.code(201).send(chain);
    });

    fastify.put('/:id', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = CreateApprovalChainSchema.partial().safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'VALIDATION_ERROR' });
      const chain = await approvalChainService.update(request.user!.companyId, id, body.data);
      return reply.code(200).send(chain);
    });

    fastify.delete('/:id', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      await approvalChainService.delete(request.user!.companyId, id);
      return reply.code(204).send();
    });
  };
}
