import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export interface JwtUserPayload {
  id: string;
  email: string;
  role: 'ADMIN' | 'SALES_MANAGER' | 'FINANCE' | 'SALES_REP' | 'PORTAL_USER';
  companyId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtUserPayload;
  }
}

/**
 * Verifies standard JWT tokens for internal reps/managers/admin/finance.
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
