import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { WarehouseRepository } from '../../db/repositories/warehouse.repository';
import type { CatalogCache } from '../../cache/catalog-cache';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';
import { requireRole } from '../middleware/role-guard.middleware';

const CreateWarehouseSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().optional().nullable(),
  shippingCostWeight: z.number().positive().default(1.0),
  isActive: z.boolean().optional(),
});

export function warehousesRoutes(warehouseRepo: WarehouseRepository, cache: CatalogCache) {
  return async function (fastify: FastifyInstance) {

    fastify.get('/', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const companyId = request.user!.companyId;
      const cacheKey = cache.warehousesKey(companyId);
      const cached = await cache.get<object[]>(cacheKey);
      if (cached) return reply.code(200).send({ data: cached });

      const warehouses = await warehouseRepo.findAll(companyId);
      await cache.set(cacheKey, warehouses, cache.warehousesTtl);
      return reply.code(200).send({ data: warehouses });
    });

    fastify.post('/', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'SALES_MANAGER')] }, async (request, reply) => {
      const body = CreateWarehouseSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      }
      const wh = await warehouseRepo.create({ ...body.data, companyId: request.user!.companyId });
      await cache.invalidateWarehouses(request.user!.companyId);
      return reply.code(201).send({ data: wh });
    });

    fastify.put('/:id', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'SALES_MANAGER')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = CreateWarehouseSchema.partial().extend({ isActive: z.boolean().optional() }).safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      const wh = await warehouseRepo.update(id, body.data);
      await cache.invalidateWarehouses(request.user!.companyId);
      return reply.code(200).send({ data: wh });
    });

    fastify.delete('/:id', { preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'SALES_MANAGER')] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      await warehouseRepo.delete(id);
      await cache.invalidateWarehouses(request.user!.companyId);
      return reply.code(204).send();
    });
  };
}
