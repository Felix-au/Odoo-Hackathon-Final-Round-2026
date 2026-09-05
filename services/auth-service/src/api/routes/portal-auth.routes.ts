import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import type { MagicLinkService } from '../../domain/services/magic-link.service';
import { MagicLinkError } from '../../domain/services/magic-link.service';
import type { PortalSessionService } from '../../domain/services/portal-session.service';
import { PortalSessionError } from '../../domain/services/portal-session.service';
import type { PortalCredentialRepository } from '../../db/repositories/portal-credential.repository';
import { env } from '../../config/env';

const MagicLinkRequestSchema = z.object({
  email: z.string().email(),
});

const PortalLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const PortalRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  companyName: z.string().optional(),
  contactName: z.string().optional(),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/portal',
  maxAge: env.PORTAL_SESSION_TTL_SECONDS,
};

export function portalAuthRoutes(
  magicLinkService: MagicLinkService,
  portalSessionService: PortalSessionService,
  portalCredentialRepo: PortalCredentialRepository,
) {
  return async function (fastify: FastifyInstance) {

    // POST /portal/auth/magic-link — REQ-F-004
    // Rate limited: 3/min per email
    fastify.post('/magic-link', {
      config: { rateLimit: { max: 3, timeWindow: '1 minute', keyGenerator: (req) => {
        const body = req.body as { email?: string };
        const ip = (req.headers['x-forwarded-for'] as string) || (req.headers['x-real-ip'] as string) || 'anon';
        return `magic_link:${body?.email ?? ip}`;
      }}},
    }, async (request, reply) => {
      const body = MagicLinkRequestSchema.safeParse(request.body);
      if (!body.success) {
        // Always return 202 to prevent enumeration
        return reply.code(202).send({
          message: 'If this email is registered, a login link has been sent.',
        });
      }

      // Fire and forget — always return 202
      magicLinkService.requestMagicLink(body.data.email).catch(() => {
        // Swallow errors silently (prevent enumeration)
      });

      return reply.code(202).send({
        message: 'If this email is registered, a login link has been sent.',
      });
    });

    // GET /portal/auth/verify?token=xxx — REQ-F-004, REQ-SEC-005
    fastify.get('/verify', async (request, reply) => {
      const query = request.query as { token?: string };

      if (!query.token) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Token Required',
          status: 400,
          detail: 'token query parameter is required',
          instance: request.url,
        });
      }

      try {
        const { customerId, email } = await magicLinkService.verifyMagicLink(query.token);
        const sessionToken = await portalSessionService.createSession(customerId, email);

        // Set httpOnly cookie — REQ-SEC-002 portal isolation
        reply.setCookie('portal_session', sessionToken, COOKIE_OPTIONS);

        return reply.code(200).send({ sessionToken, customerId, email });
      } catch (err) {
        if (err instanceof MagicLinkError) {
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

    // POST /portal/auth/login — REQ-F-005 (email + password portal login)
    fastify.post('/login', {
      config: { rateLimit: { max: 20, timeWindow: '1 minute', keyGenerator: (req) => {
        const ip = (req.headers['x-forwarded-for'] as string) || (req.headers['x-real-ip'] as string) || 'anon';
        return `portal_login:${ip}`;
      }}},
    }, async (request, reply) => {
      const body = PortalLoginSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: body.error.message,
          instance: request.url,
        });
      }

      const credential = await portalCredentialRepo.findByEmail(body.data.email.toLowerCase().trim());

      // Timing-safe comparison (prevent enumeration)
      const dummyHash = '$2a$12$dummy.hash.to.prevent.timing.attack.do.not.remove.x';
      const isValid = await bcrypt.compare(
        body.data.password,
        credential?.passwordHash ?? dummyHash,
      );

      if (!credential || !isValid || !credential.isActive) {
        return reply.code(401).send({
          type: 'https://dealflow360.com/errors/invalid-credentials',
          title: 'Invalid Credentials',
          status: 401,
          detail: 'Invalid email or password',
          instance: request.url,
        });
      }

      const sessionToken = await portalSessionService.createSession(credential.customerId, credential.email);
      reply.setCookie('portal_session', sessionToken, COOKIE_OPTIONS);

      return reply.code(200).send({
        sessionToken,
        customerId: credential.customerId,
      });
    });

    // POST /portal/auth/register — Client Registration
    fastify.post('/register', {
      config: { rateLimit: { max: 10, timeWindow: '1 minute', keyGenerator: (req) => {
        const ip = (req.headers['x-forwarded-for'] as string) || (req.headers['x-real-ip'] as string) || 'anon';
        return `portal_register:${ip}`;
      }}},
    }, async (request, reply) => {
      const body = PortalRegisterSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({
          type: 'https://dealflow360.com/errors/validation-error',
          title: 'Validation Error',
          status: 400,
          detail: body.error.message,
          instance: request.url,
        });
      }

      const email = body.data.email.toLowerCase().trim();
      const existing = await portalCredentialRepo.findByEmail(email);
      if (existing) {
        return reply.code(409).send({
          type: 'https://dealflow360.com/errors/email-conflict',
          title: 'Account Exists',
          status: 409,
          detail: 'An account with this email address already exists. Please sign in.',
          instance: request.url,
        });
      }

      const customerId = 'cust-' + randomUUID();
      const passwordHash = await bcrypt.hash(body.data.password, 12);

      await portalCredentialRepo.create({
        customerId,
        email,
        passwordHash,
      });

      const sessionToken = await portalSessionService.createSession(customerId, email);
      reply.setCookie('portal_session', sessionToken, COOKIE_OPTIONS);

      return reply.code(201).send({
        sessionToken,
        customerId,
        email,
        name: body.data.contactName || body.data.companyName || email.split('@')[0],
      });
    });

    // POST /portal/auth/logout
    fastify.post('/logout', async (request, reply) => {
      const sessionToken = request.cookies?.['portal_session'];
      if (sessionToken) {
        await portalSessionService.destroySession(sessionToken).catch(() => {});
        reply.clearCookie('portal_session', { path: '/portal' });
      }
      return reply.code(204).send();
    });
  };
}
