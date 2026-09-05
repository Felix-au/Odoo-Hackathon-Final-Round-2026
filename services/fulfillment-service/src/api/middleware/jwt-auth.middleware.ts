import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string; role: string };
  }
}

export async function jwtAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Allow internal service-to-service calls
  const serviceToken = request.headers['x-service-token'];
  if (serviceToken && serviceToken === env.SERVICE_TOKEN) {
    request.user = { id: 'service', email: 'service@internal', role: 'SERVICE' };
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({
      type: 'https://dealflow360.com/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or invalid Authorization header',
      instance: request.url,
    });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    request.user = { id: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return reply.code(401).send({
      type: 'https://dealflow360.com/errors/token-invalid',
      title: 'Token Invalid',
      status: 401,
      detail: 'JWT token is invalid or expired',
      instance: request.url,
    });
  }
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user || (!roles.includes(request.user.role) && request.user.role !== 'SERVICE')) {
      return reply.code(403).send({
        type: 'https://dealflow360.com/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: `Required role: ${roles.join(' or ')}`,
        instance: request.url,
      });
    }
  };
}
