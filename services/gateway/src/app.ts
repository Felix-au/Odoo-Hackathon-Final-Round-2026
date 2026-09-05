import fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { registerProxyRoutes } from './routes/proxy.routes.js';

export async function buildApp() {
  const app = fastify({
    logger: {
      level: 'info',
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            hostname: request.hostname,
          };
        },
      },
    },
    trustProxy: true, // needed for accurate IP in rate limiting behind Docker network
    bodyLimit: 1048576, // 1 MB
  });

  // ─── Request Normalization ──────────────────────────────────────────────────
  app.addHook('onRequest', async (request) => {
    if (request.headers['expect']) {
      delete request.headers['expect'];
    }
    if (request.raw?.headers?.['expect']) {
      delete request.raw.headers['expect'];
    }
  });

  // ─── CORS ────────────────────────────────────────────────────────────────────
  // Allow frontend origin + portal clients. credentials:true needed for portal_session cookie.
  await app.register(cors, {
    origin: env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Request-ID'],
  });

  // ─── Rate Limiting ───────────────────────────────────────────────────────────
  // Global: 100 req/min per IP. Per-endpoint overrides in proxy.routes.ts if needed.
  // Auth endpoints (login, signup) have 10/min — enforced by auth-service too, but
  // we add a basic limit at gateway level as an extra guard.
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) => ({
      type: 'https://dealflow360.com/errors/rate-limit-exceeded',
      title: 'Too Many Requests',
      status: 429,
      detail: `Rate limit exceeded. Try again in ${context.after}.`,
    }),
  });

  // ─── Health Check ────────────────────────────────────────────────────────────
  // No DB/Redis required — gateway is stateless. Docker Compose uses this.
  app.get('/health', async () => ({
    status: 'healthy',
    service: 'gateway',
    version: process.env['npm_package_version'] ?? '1.0.0',
    check: 'pass',
    timestamp: new Date().toISOString(),
  }));

  // Service health checks routed through Gateway (Port 3000)
  app.get('/health/:service', async (request, reply) => {
    const { service } = request.params as { service: string };
    const upstreamMap: Record<string, string> = {
      gateway: 'self',
      auth: env.AUTH_SERVICE_URL,
      catalog: env.CATALOG_SERVICE_URL,
      quotation: env.QUOTATION_SERVICE_URL,
      fulfillment: env.FULFILLMENT_SERVICE_URL,
      billing: env.BILLING_SERVICE_URL,
      analytics: env.ANALYTICS_SERVICE_URL,
    };

    const targetUrl = upstreamMap[service];
    if (!targetUrl) {
      return reply.code(404).send({ error: `Service ${service} not recognized` });
    }

    if (targetUrl === 'self') {
      return reply.code(200).send({
        status: 'healthy',
        service: 'gateway',
        version: process.env['npm_package_version'] ?? '1.0.0',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const resp = await fetch(`${targetUrl}/health`);
      const data = await resp.json();
      return reply.code(resp.status).send(data);
    } catch (err: any) {
      return reply.code(503).send({
        status: 'offline',
        service,
        error: err?.message || 'Upstream service unreachable',
      });
    }
  });

  // ─── Proxy Routes ────────────────────────────────────────────────────────────
  await registerProxyRoutes(app);

  // ─── Global Error Handler (RFC 7807 Problem Details) ─────────────────────────
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode ?? 500;

    // Don't expose internals in production
    const detail =
      env.NODE_ENV === 'production' && status === 500
        ? 'An unexpected error occurred.'
        : error.message;

    app.log.error(
      { err: error, requestId: request.headers['x-request-id'], url: request.url },
      'Gateway error',
    );

    void reply.status(status).send({
      type: `https://dealflow360.com/errors/${error.code ?? 'internal-error'}`,
      title: error.name ?? 'Error',
      status,
      detail,
      instance: request.url,
    });
  });

  // ─── Not Found Handler ───────────────────────────────────────────────────────
  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({
      type: 'https://dealflow360.com/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: `Route ${request.method} ${request.url} not found.`,
      instance: request.url,
    });
  });

  return app;
}
