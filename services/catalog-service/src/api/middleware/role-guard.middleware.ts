import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Role } from '@prisma/client';

export function requireRole(...allowedRoles: Role[]) {
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
        detail: `Required roles: ${allowedRoles.join(', ')}`,
        instance: request.url,
      });
    }
  };
}
