import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

interface JwtPayload {
  sub: string;       // userId
  email: string;
  name: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT authentication middleware for internal /api/v1/* routes.
 *
 * Rules (from 18-coding-agent-instructions.md §4 and 01-overall-architecture.md §10):
 * - Must have Authorization: Bearer <JWT>
 * - JWT must be valid (HS256, not expired)
 * - Portal session cookies are REJECTED — portal tokens are opaque strings,
 *   NOT JWTs, so jwt.verify() will fail naturally; we add an explicit check
 *   to return a clear error code.
 * - On success: injects X-User-Id, X-User-Email, X-User-Role, X-User-Name
 *   headers so upstream services can trust them without re-validating the JWT.
 */
export async function jwtAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Explicit portal isolation: reject portal_session cookies on internal routes
  const portalCookie = (request.headers.cookie ?? '').includes('portal_session=');
  if (portalCookie) {
    return reply.code(401).send({
      type: 'https://dealflow360.com/errors/portal-session-on-internal-route',
      title: 'Unauthorized',
      status: 401,
      detail: 'Portal session tokens cannot be used on internal API routes. Use a JWT.',
      instance: request.url,
    });
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      type: 'https://dealflow360.com/errors/missing-token',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      instance: request.url,
    });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Inject user context headers for upstream services
    request.headers['x-user-id'] = payload.sub;
    request.headers['x-user-email'] = payload.email;
    request.headers['x-user-role'] = payload.role;
    request.headers['x-user-name'] = payload.name ?? '';

    // Remove the Authorization header so services don't re-verify
    // (they trust the X-User-* headers from the gateway)
    // NOTE: We keep it in case any upstream service still wants it
  } catch (err) {
    const isExpired = err instanceof jwt.TokenExpiredError;
    return reply.code(401).send({
      type: isExpired
        ? 'https://dealflow360.com/errors/token-expired'
        : 'https://dealflow360.com/errors/token-invalid',
      title: 'Unauthorized',
      status: 401,
      detail: isExpired ? 'JWT token has expired.' : 'JWT token is invalid.',
      instance: request.url,
    });
  }
}
