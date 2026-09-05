import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  companyId: string;
  iat: number;
  exp: number;
}

// Extend FastifyRequest with our user type
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
 * JWT auth middleware — validates Bearer token from Authorization header.
 * CRITICAL: This middleware MUST NOT accept portal session cookies.
 * Portal sessions are handled by portal-session.middleware.ts.
 */
export async function jwtAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({
      type: 'https://dealflow360.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Authorization Bearer token required',
      instance: request.url,
    });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const secret = env.JWT_SECRET || process.env.JWT_SECRET || '';
    const payload = jwt.verify(token, secret) as JwtPayload;
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
