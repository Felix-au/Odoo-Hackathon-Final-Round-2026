import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AnalyticsService } from '../../domain/services/analytics.service';
import { jwtAuthMiddleware, requireRole } from '../middleware/auth.middleware';

const exportRequestSchema = z.object({
  reportType: z.string().default('quotations'),
  format: z.enum(['PDF', 'XLS']).default('PDF'),
  filters: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
      repId: z.string().nullable().optional(),
      status: z.string().nullable().optional(),
      customerId: z.string().nullable().optional(),
    })
    .optional(),
});

export function reportsRoutes(analyticsService: AnalyticsService): FastifyPluginAsync {
  return async function (fastify) {
    // Public or authenticated download for exports
    fastify.get('/exports/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const file = analyticsService.getExportFile(id);

      if (!file) {
        return reply.code(404).send({
          type: 'https://dealflow360.com/errors/file-not-found',
          title: 'Export File Not Found',
          status: 404,
          detail: `File with ID ${id} was not found or has expired`,
          instance: request.url,
        });
      }

      reply.header('Content-Type', file.mimeType);
      reply.header('Content-Disposition', `attachment; filename="${file.filename}"`);
      return reply.send(file.buffer);
    });

    // Authenticated reporting routes
    fastify.register(async (authScope) => {
      authScope.addHook('preHandler', jwtAuthMiddleware);

      // GET /analytics/reports/quotations (REQ-F-062–065, CHECK-ANA-007)
      authScope.get(
        '/quotations',
        { preHandler: [requireRole('ADMIN', 'SALES_MANAGER', 'FINANCE', 'SALES_REP')] },
        async (request, reply) => {
          const query = request.query as any;
          const companyId = query.companyId || request.user?.companyId || 'default';
          const from = query.from ? new Date(query.from) : undefined;
          const to = query.to ? new Date(query.to) : undefined;
          const repId = query.repId;
          const status = query.status;
          const customerId = query.customerId;
          const page = query.page ? parseInt(query.page, 10) : 1;
          const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : 20;

          const report = await analyticsService.getQuotationReport(companyId, {
            from,
            to,
            repId,
            status,
            customerId,
            page,
            pageSize,
          });

          return reply.code(200).send(report);
        },
      );

      // GET /analytics/reports/products
      authScope.get(
        '/products',
        { preHandler: [requireRole('ADMIN', 'SALES_MANAGER', 'FINANCE')] },
        async (request, reply) => {
          const query = request.query as any;
          const companyId = query.companyId || request.user?.companyId || 'default';
          const from = query.from ? new Date(query.from) : undefined;
          const to = query.to ? new Date(query.to) : undefined;

          const report = await analyticsService.getProductReport(companyId, { from, to });
          return reply.code(200).send(report);
        },
      );

      // POST /analytics/reports/export (REQ-F-061, REQ-RPT-007, CHECK-ANA-006)
      authScope.post(
        '/export',
        { preHandler: [requireRole('ADMIN', 'SALES_MANAGER', 'FINANCE')] },
        async (request, reply) => {
          const companyId = request.user?.companyId || 'default';
          const parsed = exportRequestSchema.safeParse(request.body || {});

          if (!parsed.success) {
            return reply.code(400).send({
              type: 'https://dealflow360.com/errors/validation-error',
              title: 'Validation Error',
              status: 400,
              detail: parsed.error.message,
              instance: request.url,
            });
          }

          const rawFilters = parsed.data.filters || {};
          const filters = {
            from: rawFilters.from ? new Date(rawFilters.from) : undefined,
            to: rawFilters.to ? new Date(rawFilters.to) : undefined,
            repId: rawFilters.repId || undefined,
            status: rawFilters.status || undefined,
            customerId: rawFilters.customerId || undefined,
          };

          const exportResult = await analyticsService.exportReport(
            parsed.data.reportType,
            parsed.data.format,
            filters,
            companyId,
          );

          return reply.code(200).send(exportResult);
        },
      );
    });
  };
}
