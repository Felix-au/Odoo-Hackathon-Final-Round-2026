import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyHttpProxy from '@fastify/http-proxy';
import { env } from '../config/env.js';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware.js';
import { portalAuthMiddleware } from '../middleware/portal-auth.middleware.js';
import { requestIdMiddleware } from '../middleware/request-id.middleware.js';

function combinePreHandlers(
  ...handlers: Array<(request: FastifyRequest, reply: FastifyReply) => Promise<void>>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    for (const handler of handlers) {
      if (reply.sent) return;
      await handler(request, reply);
    }
  };
}

/**
 * Registers all proxy routes.
 *
 * Routing table (from docs/16-deployment-and-devops.md §4):
 *
 * Internal API (JWT required):
 *   /api/v1/auth/*           → AUTH_SERVICE_URL     (NO jwt check — auth service handles it)
 *   /api/v1/catalog/*        → CATALOG_SERVICE_URL  (jwt)
 *   /api/v1/quotations/*     → QUOTATION_SERVICE_URL (jwt)
 *   /api/v1/fulfillment/*    → FULFILLMENT_SERVICE_URL (jwt)
 *   /api/v1/billing/*        → BILLING_SERVICE_URL  (jwt)
 *   /api/v1/analytics/*      → ANALYTICS_SERVICE_URL (jwt)
 *
 * Portal API (portal session required):
 *   /portal/v1/auth/*        → AUTH_SERVICE_URL     (NO auth — auth service handles it)
 *   /portal/v1/quotations/*  → QUOTATION_SERVICE_URL (portal session)
 *   /portal/v1/fulfillment/* → FULFILLMENT_SERVICE_URL (portal session)
 */
export async function registerProxyRoutes(app: FastifyInstance): Promise<void> {
  const jwtPipeline = combinePreHandlers(requestIdMiddleware, jwtAuthMiddleware);
  const portalPipeline = combinePreHandlers(requestIdMiddleware, portalAuthMiddleware);

  // ─── Auth routes (no gateway auth — auth service owns login/signup/verify) ───

  await app.register(fastifyHttpProxy, {
    upstream: env.AUTH_SERVICE_URL,
    prefix: '/api/v1/auth',
    rewritePrefix: '/auth',
    preHandler: requestIdMiddleware,
    http2: false,
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.AUTH_SERVICE_URL,
    prefix: '/portal/v1/auth',
    rewritePrefix: '/portal/auth',
    preHandler: requestIdMiddleware,
    http2: false,
  });

  // ─── Internal API routes (JWT required) ────────────────────────────────────

  await app.register(fastifyHttpProxy, {
    upstream: env.CATALOG_SERVICE_URL,
    prefix: '/api/v1/catalog',
    rewritePrefix: '/catalog',
    preHandler: jwtPipeline,
    http2: false,
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.QUOTATION_SERVICE_URL,
    prefix: '/api/v1/quotations',
    rewritePrefix: '/quotations',
    preHandler: jwtPipeline,
    http2: false,
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.FULFILLMENT_SERVICE_URL,
    prefix: '/api/v1/fulfillment',
    rewritePrefix: '/fulfillment',
    preHandler: jwtPipeline,
    http2: false,
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.BILLING_SERVICE_URL,
    prefix: '/api/v1/billing',
    rewritePrefix: '/billing',
    preHandler: jwtPipeline,
    http2: false,
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.ANALYTICS_SERVICE_URL,
    prefix: '/api/v1/analytics',
    rewritePrefix: '/analytics',
    preHandler: jwtPipeline,
    http2: false,
  });

  // ─── Portal routes (portal session required) ────────────────────────────────

  await app.register(fastifyHttpProxy, {
    upstream: env.QUOTATION_SERVICE_URL,
    prefix: '/portal/v1/quotations',
    rewritePrefix: '/portal/quotations',
    preHandler: portalPipeline,
    http2: false,
  });

  await app.register(fastifyHttpProxy, {
    upstream: env.FULFILLMENT_SERVICE_URL,
    prefix: '/portal/v1/fulfillment',
    rewritePrefix: '/portal/fulfillment',
    preHandler: portalPipeline,
    http2: false,
  });
}
