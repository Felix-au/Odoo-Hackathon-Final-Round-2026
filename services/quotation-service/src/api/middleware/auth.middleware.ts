import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import type Redis from 'ioredis';
import { env } from '../../config/env';

export interface JwtUserPayload {
  id: string;
  email: string;
  role: 'ADMIN' | 'SALES_MANAGER' | 'FINANCE' | 'SALES_REP' | 'PORTAL_USER';
  companyId: string;
}

export interface PortalCustomerPayload {
  customerId: string;
  email?: string;
  companyId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtUserPayload;
    customer?: PortalCustomerPayload;
  }
}

/**
 * Verifies standard JWT tokens for internal reps/managers/admin.
 */
export async function jwtAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Service-to-service token check
  const serviceToken = request.headers['x-service-token'];
  if (serviceToken === env.SERVICE_TOKEN) {
    const companyId = (request.headers['x-company-id'] as string) ?? 'default';
    request.user = {
      id: 'system',
      email: 'system@dealflow360.internal',
      role: 'ADMIN',
      companyId,
    };
    return;
  }

  const authHeader = request.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      type: 'https://dealflow360.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authorization Bearer token or x-service-token required',
      instance: request.url,
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as any;
    request.user = {
      id: payload.sub || payload.id,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId ?? 'default',
    };
  } catch {
    return reply.code(401).send({
      type: 'https://dealflow360.com/errors/token-invalid',
      title: 'Token Invalid',
      status: 401,
      detail: 'Access token is invalid or expired',
      instance: request.url,
    });
  }
}

/**
 * Role guard middleware.
 */
export function requireRole(...allowedRoles: string[]) {
  return async function roleGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      return reply.code(401).send({
        type: 'https://dealflow360.com/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required',
        instance: request.url,
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.code(403).send({
        type: 'https://dealflow360.com/errors/insufficient-role',
        title: 'Forbidden',
        status: 403,
        detail: `Required roles: ${allowedRoles.join(', ')}. Current role: ${request.user.role}`,
        instance: request.url,
      });
    }
  };
}

/**
 * Portal session middleware for customer portal routes.
 */
export function createPortalAuthMiddleware(redis: Redis | null) {
  return async function portalAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    // 1. Direct header for testing / service proxy
    const directCustomerId = request.headers['x-portal-customer-id'] as string;
    if (directCustomerId) {
      request.customer = {
        customerId: directCustomerId,
        companyId: (request.headers['x-company-id'] as string) || 'default',
      };
      return;
    }

    // 2. Bearer token (JWT or Redis opaque session)
    const authHeader = request.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();

      // Check redis session
      if (redis) {
        try {
          const sessionData = await redis.get(`portal_session:${token}`);
          if (sessionData) {
            const parsed = JSON.parse(sessionData);
            request.customer = {
              customerId: parsed.customerId,
              email: parsed.email,
              companyId: parsed.companyId || 'default',
            };
            return;
          }
        } catch {
          // fallback to jwt
        }
      }

      // Check JWT
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        if (decoded.customerId) {
          request.customer = {
            customerId: decoded.customerId,
            email: decoded.email,
            companyId: decoded.companyId || 'default',
          };
          return;
        }
      } catch {
        // invalid
      }
    }

    return reply.code(401).send({
      type: 'https://dealflow360.com/errors/unauthorized',
      title: 'Portal Unauthorized',
      status: 401,
      detail: 'Valid portal session or authorization required',
      instance: request.url,
    });
  };
}
