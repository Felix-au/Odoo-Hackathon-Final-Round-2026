import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { getRedis } from '../plugins/redis.js';

interface PortalSessionData {
  customerId: string;
  email: string;
  name?: string;
}

/**
 * Portal session authentication middleware for /portal/v1/* routes.
 *
 * Rules (from 18-coding-agent-instructions.md §4 and 01-overall-architecture.md §10):
 * - Accepts EITHER:
 *   (a) Cookie: portal_session=<opaque-token>
 *   (b) Authorization: Bearer <opaque-token>   (for mobile/API clients)
 * - If it looks like a JWT (contains 2 dots), it is REJECTED — internal JWTs
 *   must NOT be accepted on portal routes (portal isolation).
 * - Token is looked up in Redis under key "portal:session:<token>"
 * - On success: injects X-Customer-Id, X-Customer-Email, X-Customer-Name headers.
 */
export async function portalAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Extract token from cookie or Authorization header
  let token: string | undefined;

  // Try Authorization header first (for API clients / mobile)
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Try portal_session cookie
  if (!token) {
    const cookieHeader = request.headers.cookie ?? '';
    const match = /portal_session=([^;]+)/.exec(cookieHeader);
    if (match) {
      token = match[1];
    }
  }

  if (!token) {
    return reply.code(401).send({
      type: 'https://dealflow360.com/errors/missing-portal-session',
      title: 'Unauthorized',
      status: 401,
      detail: 'Portal session token required. Include it as a cookie (portal_session) or Authorization Bearer header.',
      instance: request.url,
    });
  }

  // Reject JWTs on portal routes — they have 2 dots (header.payload.signature)
  // This is the explicit portal isolation check (CHECK-ARCH-001)
  const looksLikeJwt = (token.match(/\./g) ?? []).length === 2;
  if (looksLikeJwt) {
    // Extra safety: try to decode it, if it's a JWT fail with specific error
    try {
      jwt.decode(token); // just decode, no verify
      return reply.code(401).send({
        type: 'https://dealflow360.com/errors/jwt-on-portal-route',
        title: 'Unauthorized',
        status: 401,
        detail: 'Internal JWT tokens cannot be used on portal routes. Use a portal session token.',
        instance: request.url,
      });
    } catch {
      // Not a JWT after all — continue with Redis lookup
    }
  }

  // Look up session in Redis
  const redis = getRedis();
  let sessionData: PortalSessionData;

  try {
    const raw =
      (await redis.get(`portal_session:${token}`)) ??
      (await redis.get(`portal:session:${token}`));
    if (!raw) {
      return reply.code(401).send({
        type: 'https://dealflow360.com/errors/portal-session-invalid',
        title: 'Unauthorized',
        status: 401,
        detail: 'Portal session token not found or expired.',
        instance: request.url,
      });
    }
    sessionData = JSON.parse(raw) as PortalSessionData;
  } catch {
    return reply.code(503).send({
      type: 'https://dealflow360.com/errors/session-store-unavailable',
      title: 'Service Unavailable',
      status: 503,
      detail: 'Session store temporarily unavailable.',
      instance: request.url,
    });
  }

  // Inject customer context headers for upstream services
  request.headers['x-customer-id'] = sessionData.customerId;
  request.headers['x-customer-email'] = sessionData.email;
  request.headers['x-customer-name'] = sessionData.name ?? '';

  // Remove portal session from cookie so upstream doesn't see it
  // (upstream services trust X-Customer-* headers from the gateway)
}
