import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export type Role = 'ADMIN' | 'SALES_MANAGER' | 'SALES_REP' | 'FINANCE' | 'PORTAL_USER';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  companyId: string;
  iat: number;
  exp: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: Role;
      companyId: string;
    };
  }
}

/**
 * JWT auth middleware for Catalog Service.
 * Verifies the JWT issued by Auth Service (shared JWT_SECRET).
 * Also accepts x-service-token for service-to-service calls.
 */
export async function jwtAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Service-to-service token check
  const serviceToken = request.headers['x-service-token'];
  if (serviceToken === env.SERVICE_TOKEN) {
    // Internal service call — grant system-level access with default company
    const companyId = (request.headers['x-company-id'] as string) ?? 'default';
    request.user = {
      id: 'system',
      email: 'system@dealflow360.internal',
      role: 'ADMIN' as Role,
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

  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    request.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId,
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
