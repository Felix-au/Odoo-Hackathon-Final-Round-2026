import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { StockService } from '../../domain/services/stock.service';
import { jwtAuthMiddleware, requireRole } from '../middleware/jwt-auth.middleware';

const upsertStockSchema = z.object({
  companyId: z.string().default('default'),
  warehouseId: z.string().uuid('warehouseId must be a UUID'),
  warehouseName: z.string().min(1),
  productId: z.string().uuid('productId must be a UUID'),
  variantId: z.string().uuid().optional().nullable(),
  quantityOnHand: z.number().int().min(0),
  reorderPoint: z.number().int().min(0).optional(),
  reorderQty: z.number().int().min(1).optional(),
});

const adjustStockSchema = z.object({
  companyId: z.string().default('default'),
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  delta: z.number().int().refine((n) => n !== 0, 'delta must be non-zero'),
});

const arrivalSchema = z.object({
  companyId: z.string().default('default'),
  warehouseId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  quantityArrived: z.number().int().min(1),
});

export async function stockRoutes(
  app: FastifyInstance,
  { stockService }: { stockService: StockService },
): Promise<void> {
  // GET /fulfillment/stock
  app.get('/fulfillment/stock', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
    const { warehouseId, companyId = 'default' } = request.query as {
      warehouseId?: string;
      companyId?: string;
    };
    const stock = await stockService.listStock(companyId, warehouseId);
    return reply.send({ stock });
  });

  // GET /fulfillment/stock/:warehouseId
  app.get(
    '/fulfillment/stock/:warehouseId',
    { preHandler: [jwtAuthMiddleware] },
    async (request, reply) => {
      const { warehouseId } = request.params as { warehouseId: string };
      const { companyId = 'default' } = request.query as { companyId?: string };
      const stock = await stockService.listStock(companyId, warehouseId);
      return reply.send({ stock });
    },
  );

  // PUT /fulfillment/stock  (ADMIN, FINANCE only)
  app.put(
    '/fulfillment/stock',
    { preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'FINANCE')] },
    async (request, reply) => {
      const parsed = upsertStockSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: parsed.error.issues.map((i) => i.message).join('; '),
          instance: request.url,
        });
      }
      const stock = await stockService.setStock(parsed.data);
      return reply.code(200).send({ stock });
    },
  );

  // POST /fulfillment/stock/adjust  (ADMIN, FINANCE only)
  app.post(
    '/fulfillment/stock/adjust',
    { preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'FINANCE')] },
    async (request, reply) => {
      const parsed = adjustStockSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: parsed.error.issues.map((i) => i.message).join('; '),
          instance: request.url,
        });
      }
      try {
        const stock = await stockService.adjustStock(parsed.data);
        return reply.code(200).send({ stock });
      } catch (err) {
        return reply.code(404).send({
          type: 'https://dealflow360.com/errors/not-found',
          title: 'Stock Record Not Found',
          status: 404,
          detail: err instanceof Error ? err.message : 'Stock record not found',
          instance: request.url,
        });
      }
    },
  );

  // POST /fulfillment/stock/arrival  (ADMIN, FINANCE only)
  app.post(
    '/fulfillment/stock/arrival',
    { preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'FINANCE')] },
    async (request, reply) => {
      const parsed = arrivalSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: parsed.error.issues.map((i) => i.message).join('; '),
          instance: request.url,
        });
      }
      try {
        const result = await stockService.recordArrival(parsed.data);
        return reply.code(200).send(result);
      } catch (err) {
        return reply.code(404).send({
          type: 'https://dealflow360.com/errors/not-found',
          title: 'Stock Record Not Found',
          status: 404,
          detail: err instanceof Error ? err.message : 'Could not record arrival',
          instance: request.url,
        });
      }
    },
  );
}
