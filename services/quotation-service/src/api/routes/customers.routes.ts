import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CustomerRepository } from '../../db/repositories/customer.repository';
import { jwtAuthMiddleware, requireRole } from '../middleware/auth.middleware';

const CreateCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  tier: z.enum(['BRONZE', 'SILVER', 'GOLD']).default('BRONZE'),
  currency: z.string().default('USD'),
  hasPortalAccess: z.boolean().default(false),
});

const UpdateCustomerSchema = CreateCustomerSchema.partial();

export function customersRoutes(customerRepo: CustomerRepository) {
  return async function (fastify: FastifyInstance) {
    // GET /quotations/customers
    fastify.get('/', { preHandler: [jwtAuthMiddleware] }, async (request, reply) => {
      const query = request.query as {
        search?: string;
        tier?: string;
        page?: string;
        pageSize?: string;
      };

      const page = query.page ? parseInt(query.page, 10) : 1;
      const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 20;

      const result = await customerRepo.list(
        {
          companyId: request.user!.companyId,
          search: query.search,
          tier: query.tier,
        },
        page,
        pageSize,
      );

      return reply.code(200).send(result);
    });

    // POST /quotations/customers
    fastify.post(
      '/',
      { preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'SALES_REP', 'SALES_MANAGER')] },
      async (request, reply) => {
        const parsed = CreateCustomerSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            type: 'https://dealflow360.com/errors/validation-error',
            title: 'Validation Error',
            status: 400,
            detail: parsed.error.message,
            instance: request.url,
          });
        }

        const existing = await customerRepo.findByEmail(request.user!.companyId, parsed.data.email);
        if (existing) {
          return reply.code(409).send({
            type: 'https://dealflow360.com/errors/conflict',
            title: 'Conflict',
            status: 409,
            detail: `Customer with email ${parsed.data.email} already exists`,
            instance: request.url,
          });
        }

        const customer = await customerRepo.create({
          ...parsed.data,
          companyId: request.user!.companyId,
        });

        return reply.code(201).send(customer);
      },
    );

    // PUT /quotations/customers/:id
    fastify.put(
      '/:id',
      { preHandler: [jwtAuthMiddleware] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const parsed = UpdateCustomerSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({
            type: 'https://dealflow360.com/errors/validation-error',
            title: 'Validation Error',
            status: 400,
            detail: parsed.error.message,
            instance: request.url,
          });
        }

        const customer = await customerRepo.findById(id);
        if (!customer) {
          return reply.code(404).send({
            type: 'https://dealflow360.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Customer with ID ${id} not found`,
            instance: request.url,
          });
        }

        const updated = await customerRepo.update(id, parsed.data);
        return reply.code(200).send(updated);
      },
    );

    // POST /quotations/customers/:id/portal-access
    fastify.post(
      '/:id/portal-access',
      { preHandler: [jwtAuthMiddleware, requireRole('ADMIN', 'SALES_MANAGER')] },
      async (request, reply) => {
        const { id } = request.params as { id: string };
        const customer = await customerRepo.findById(id);
        if (!customer) {
          return reply.code(404).send({
            type: 'https://dealflow360.com/errors/not-found',
            title: 'Not Found',
            status: 404,
            detail: `Customer with ID ${id} not found`,
            instance: request.url,
          });
        }

        const updated = await customerRepo.setPortalAccess(id, true);
        return reply.code(200).send(updated);
      },
    );
  };
}
