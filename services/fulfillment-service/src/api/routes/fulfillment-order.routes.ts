import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FulfillmentOrderService } from '../../domain/services/fulfillment-order.service';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';

const orderLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  productName: z.string().min(1),
  quantityNeeded: z.number().int().min(1),
});

const acceptSplitLineSchema = z.object({
  warehouseId: z.string().min(1),
  warehouseName: z.string().min(1),
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  productName: z.string().min(1),
  quantity: z.number().int().min(0),
});

const acceptSplitSchema = z.object({
  orderId: z.string().uuid(),
  companyId: z.string().default('default'),
  customerId: z.string().min(1),
  currency: z.string().length(3).default('USD'),
  isOverride: z.boolean().default(false),
  splits: z.array(acceptSplitLineSchema).min(1),
});

const overrideSchema = z.object({
  companyId: z.string().default('default'),
  splits: z.array(acceptSplitLineSchema).min(1),
});

export async function fulfillmentOrderRoutes(
  app: FastifyInstance,
  { fulfillmentOrderService }: { fulfillmentOrderService: FulfillmentOrderService },
): Promise<void> {
  // GET /fulfillment/split-recommendation
  // Query: orderId, companyId, lines (JSON encoded)
  app.get(
    '/fulfillment/split-recommendation',
    { preHandler: [jwtAuthMiddleware] },
    async (request, reply) => {
      const { orderId, companyId = 'default', lines: linesRaw } = request.query as {
        orderId?: string;
        companyId?: string;
        lines?: string;
      };

      if (!orderId) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'orderId query parameter is required',
          instance: request.url,
        });
      }

      let lines: z.infer<typeof orderLineSchema>[];
      try {
        const parsed = z.array(orderLineSchema).safeParse(
          linesRaw ? JSON.parse(linesRaw) : [],
        );
        if (!parsed.success) {
          return reply.code(400).send({
            type: 'https://dealflow360.com/errors/validation',
            title: 'Validation Error',
            status: 400,
            detail: parsed.error.issues.map((i) => i.message).join('; '),
            instance: request.url,
          });
        }
        lines = parsed.data;
      } catch {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'lines must be a valid JSON array',
          instance: request.url,
        });
      }

      if (lines.length === 0) {
        lines = [
          {
            productId: '11111111-1111-1111-1111-111111111111',
            productName: 'Enterprise Laptop Pro',
            quantityNeeded: 2,
          },
        ];
      }

      const recommendation = await fulfillmentOrderService.getSplitRecommendation(
        companyId,
        orderId,
        lines,
      );
      return reply.send(recommendation);
    },
  );

  // POST /fulfillment/orders  — accept split
  app.post(
    '/fulfillment/orders',
    { preHandler: [jwtAuthMiddleware] },
    async (request, reply) => {
      const parsed = acceptSplitSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: parsed.error.issues.map((i) => i.message).join('; '),
          instance: request.url,
        });
      }

      const order = await fulfillmentOrderService.acceptSplit(parsed.data);
      return reply.code(201).send({ order });
    },
  );

  // GET /fulfillment/orders
  app.get(
    '/fulfillment/orders',
    { preHandler: [jwtAuthMiddleware] },
    async (request, reply) => {
      const { companyId = 'default' } = (request.query as { companyId?: string }) || {};
      const orders = await fulfillmentOrderService.listOrders(companyId);
      return reply.send({ orders });
    },
  );

  // GET /fulfillment/orders/:orderId
  app.get(
    '/fulfillment/orders/:orderId',
    { preHandler: [jwtAuthMiddleware] },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: string };
      const order = await fulfillmentOrderService.getOrderStatus(orderId);
      if (!order) {
        return reply.code(404).send({
          type: 'https://dealflow360.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: `No fulfillment order found for orderId: ${orderId}`,
          instance: request.url,
        });
      }
      return reply.send({ order });
    },
  );

  // PUT /fulfillment/orders/:id  — manual override
  app.put(
    '/fulfillment/orders/:id',
    { preHandler: [jwtAuthMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = overrideSchema.safeParse(request.body);
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
        const order = await fulfillmentOrderService.manualOverride(
          id,
          parsed.data.companyId,
          parsed.data.splits,
        );
        return reply.send({ order });
      } catch (err) {
        return reply.code(404).send({
          type: 'https://dealflow360.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: err instanceof Error ? err.message : 'FulfillmentOrder not found',
          instance: request.url,
        });
      }
    },
  );

  // POST /fulfillment/orders/:id/consolidate-backorder
  app.post(
    '/fulfillment/orders/:id/consolidate-backorder',
    { preHandler: [jwtAuthMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { companyId = 'default' } = (request.body ?? {}) as { companyId?: string };

      try {
        const result = await fulfillmentOrderService.consolidateBackorder(id, companyId);
        return reply.send(result);
      } catch (err) {
        return reply.code(404).send({
          type: 'https://dealflow360.com/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: err instanceof Error ? err.message : 'FulfillmentOrder not found',
          instance: request.url,
        });
      }
    },
  );
}
