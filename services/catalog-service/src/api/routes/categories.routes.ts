import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CategoryRepository } from '../../db/repositories/category.repository';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';
import { requireRole } from '../middleware/role-guard.middleware';

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  discountCeilingPct: z.number().min(0).max(100).default(0),
});

export function categoriesRoutes(categoryRepo: CategoryRepository) {
  return async function (fastify: FastifyInstance) {

    fastify.get('/', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const categories = await categoryRepo.findAll(request.user!.companyId);
      return reply.code(200).send({ data: categories, total: categories.length });
    });

    fastify.post('/', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const body = CreateCategorySchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      }
      const category = await categoryRepo.create({ ...body.data, companyId: request.user!.companyId });
      return reply.code(201).send(category);
    });

    fastify.put('/:id', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = CreateCategorySchema.partial().safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR' });
      }
      const category = await categoryRepo.update(id, body.data);
      return reply.code(200).send(category);
    });

    fastify.delete('/:id', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      await categoryRepo.delete(id);
      return reply.code(204).send();
    });
  };
}
