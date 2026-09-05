import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthService } from '../../domain/services/auth.service';
import { AuthError } from '../../domain/services/auth.service';
import { jwtAuthMiddleware } from '../middleware/jwt-auth.middleware';
import { requireRole } from '../middleware/role-guard.middleware';
import type { UserRepository } from '../../db/repositories/user.repository';
import type { Role } from '@prisma/client';

const SignupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  role: z.enum(['ADMIN', 'SALES_MANAGER', 'FINANCE', 'SALES_REP']).optional(),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const LogoutSchema = z.object({
  refreshToken: z.string().min(1),
});

const UpdateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'SALES_MANAGER', 'FINANCE', 'SALES_REP']),
});

export function internalAuthRoutes(
  authService: AuthService,
  userRepo: UserRepository,
) {
  return async function (fastify: FastifyInstance) {

    // POST /auth/signup — REQ-F-001
    fastify.post('/signup', {
      config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 5, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const body = SignupSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: body.error.message,
          instance: request.url,
        });
      }

      try {
        const user = await authService.signup(body.data);
        return reply.code(201).send({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt,
        });
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({
            type: `https://dealflow360.com/errors/${err.code.toLowerCase().replace(/_/g, '-')}`,
            title: err.code,
            status: err.statusCode,
            detail: err.message,
            instance: request.url,
          });
        }
        throw err;
      }
    });

    // POST /auth/login — REQ-F-002
    fastify.post('/login', {
      config: { rateLimit: process.env.NODE_ENV === 'test' ? false : { max: 10, timeWindow: '1 minute' } },
    }, async (request, reply) => {
      const body = LoginSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: body.error.message,
          instance: request.url,
        });
      }

      try {
        const result = await authService.login(body.data.email, body.data.password);
        return reply.code(200).send(result);
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({
            type: `https://dealflow360.com/errors/${err.code.toLowerCase().replace(/_/g, '-')}`,
            title: err.code,
            status: err.statusCode,
            detail: err.message,
            instance: request.url,
          });
        }
        throw err;
      }
    });

    // POST /auth/refresh
    fastify.post('/refresh', async (request, reply) => {
      const body = RefreshSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      }

      try {
        const result = await authService.refreshAccessToken(body.data.refreshToken);
        return reply.code(200).send(result);
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({
            type: `https://dealflow360.com/errors/${err.code.toLowerCase().replace(/_/g, '-')}`,
            title: err.code,
            status: err.statusCode,
            detail: err.message,
            instance: request.url,
          });
        }
        throw err;
      }
    });

    // POST /auth/logout
    fastify.post('/logout', {
      preHandler: [jwtAuthMiddleware],
    }, async (request, reply) => {
      const body = LogoutSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR' });
      }
      await authService.logout(body.data.refreshToken);
      return reply.code(204).send();
    });

    // GET /auth/me
    fastify.get('/me', {
      preHandler: [jwtAuthMiddleware],
    }, async (request, reply) => {
      const user = await userRepo.findById(request.user!.id);
      if (!user) {
        return reply.code(404).send({ error: 'USER_NOT_FOUND' });
      }
      return reply.code(200).send({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        createdAt: user.createdAt,
      });
    });

    // GET /auth/users — Admin only
    fastify.get('/users', {
      preHandler: [jwtAuthMiddleware, requireRole('ADMIN')],
    }, async (request, reply) => {
      const query = request.query as { page?: string; pageSize?: string };
      const page = Math.max(1, parseInt(query.page ?? '1', 10));
      const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize ?? '20', 10)));

      const { users, total } = await userRepo.listAll(page, pageSize);
      return reply.code(200).send({
        data: users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          isActive: u.isActive,
          createdAt: u.createdAt,
        })),
        total,
        page,
        pageSize,
      });
    });

    // PUT /auth/users/:id/role — Admin only
    fastify.put('/users/:id/role', {
      preHandler: [jwtAuthMiddleware, requireRole('ADMIN')],
    }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdateRoleSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: 'VALIDATION_ERROR', detail: body.error.message });
      }

      const user = await userRepo.findById(id);
      if (!user) {
        return reply.code(404).send({ error: 'USER_NOT_FOUND' });
      }

      const updated = await userRepo.updateRole(id, body.data.role as Role);
      return reply.code(200).send({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        isActive: updated.isActive,
      });
    });
  };
}
