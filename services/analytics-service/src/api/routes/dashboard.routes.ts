import type { FastifyPluginAsync } from 'fastify';
import { AnalyticsService } from '../../domain/services/analytics.service';
import { jwtAuthMiddleware, requireRole } from '../middleware/auth.middleware';

export function dashboardRoutes(analyticsService: AnalyticsService): FastifyPluginAsync {
  return async function (fastify) {
    fastify.addHook('preHandler', jwtAuthMiddleware);

    // GET /analytics/dashboard (REQ-F-060, REQ-RPT-001, CHECK-ANA-001)
    fastify.get(
      '/',
      { preHandler: [requireRole('ADMIN', 'SALES_MANAGER', 'FINANCE', 'SALES_REP')] },
      async (request, reply) => {
        const query = request.query as any;
        const companyId = query.companyId || request.user?.companyId || 'default';
        const fromDateStr = query.from;
        const toDateStr = query.to;

        const dashboard = await analyticsService.getDashboard(companyId, fromDateStr, toDateStr);
        return reply.code(200).send(dashboard);
      },
    );
  };
}
