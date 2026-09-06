import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ProductService } from '../../domain/services/product.service';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';
import { requireRole } from '../middleware/role-guard.middleware';

const CreateProductSchema = z.object({
  name: z.string().min(1).max(255),
  categoryId: z.string().uuid(),
  basePrice: z.number().positive(),
  unit: z.string().default('unit'),
  taxRate: z.number().min(0).max(100).default(0),
  description: z.string().optional(),
  costPrice: z.number().min(0).default(0),
});

const UpdateProductSchema = CreateProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const VariantSchema = z.object({
  attribute: z.string().min(1),
  value: z.string().min(1),
  extraPrice: z.number().default(0),
});

export function productsRoutes(productService: ProductService) {
  return async function (fastify: FastifyInstance) {

    // GET /catalog/products
    fastify.get('/', {
      preHandler: [jwtAuthMiddleware],
    }, async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const companyId = request.user!.companyId;
      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)));
      const isActive = query.isActive !== 'false';

      const result = await productService.list(
        companyId,
        {
          categoryId: query.categoryId,
          search: query.search,
          isActive,
        },
        page,
        pageSize,
      );

      return reply.code(200).send({
        data: result.products,
        total: result.total,
        page,
        pageSize,
      });
    });

    // GET /catalog/products/:id (CHECK-CAT-001)
    fastify.get('/:id', {
      preHandler: [jwtAuthMiddleware],
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const companyId = request.user!.companyId;

      const product = await productService.getById(companyId, id);
      if (!product) {
        return reply.code(404).send({
          type: 'https://dealflow360.com/errors/not-found',
          title: 'Product Not Found',
          status: 404,
          detail: `Product ${id} not found`,
          instance: request.url,
        });
      }
      return reply.code(200).send(product);
    });

    // POST /catalog/products — ADMIN or SALES_MANAGER
    fastify.post('/', {
      preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'SALES_MANAGER')],
    }, async (request, reply) => {
      const body = CreateProductSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: body.error.message,
          instance: request.url,
        });
      }

      const product = await productService.create(request.user!.companyId, body.data);
      return reply.code(201).send(product);
    });

    // PUT /catalog/products/:id — ADMIN or SALES_MANAGER
    fastify.put('/:id', {
      preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'SALES_MANAGER')],
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdateProductSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      }

      const product = await productService.update(request.user!.companyId, id, body.data);
      return reply.code(200).send(product);
    });

    // DELETE /catalog/products/:id — ADMIN or SALES_MANAGER (soft delete)
    fastify.delete('/:id', {
      preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'SALES_MANAGER')],
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      await productService.softDelete(request.user!.companyId, id);
      return reply.code(204).send();
    });

    // POST /catalog/products/:id/variants — ADMIN only
    fastify.post('/:id/variants', {
      preHandler: [jwtAuthMiddleware, requireRole('ADMIN')],
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = VariantSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      }

      const variant = await productService.addVariant(request.user!.companyId, id, body.data);
      return reply.code(201).send(variant);
    });

    // PUT /catalog/products/:id/variants/:vid — ADMIN only
    fastify.put('/:id/variants/:vid', {
      preHandler: [jwtAuthMiddleware, requireRole('ADMIN')],
    }, async (request, reply) => {
      const { id, vid } = request.params as { id: string; vid: string };
      const body = VariantSchema.partial().safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR' });
      }

      const variant = await productService.updateVariant(request.user!.companyId, id, vid, body.data);
      return reply.code(200).send(variant);
    });

    // DELETE /catalog/products/:id/variants/:vid — ADMIN only
    fastify.delete('/:id/variants/:vid', {
      preHandler: [jwtAuthMiddleware, requireRole('ADMIN')],
    }, async (request, reply) => {
      const { id, vid } = request.params as { id: string; vid: string };
      await productService.deleteVariant(request.user!.companyId, id, vid);
      return reply.code(204).send();
    });
  };
}
