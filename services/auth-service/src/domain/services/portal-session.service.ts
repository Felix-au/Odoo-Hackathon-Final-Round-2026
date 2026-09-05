import { randomUUID } from 'crypto';
import type Redis from 'ioredis';
import { env } from '../../config/env';

export class PortalSessionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 401,
  ) {
    super(message);
    this.name = 'PortalSessionError';
  }
}

interface SessionData {
  customerId: string;
  email: string;
  createdAt: string;
}

const SESSION_PREFIX = 'portal_session:';

export class PortalSessionService {
  constructor(private readonly redis: Redis) {}

  /** Create a new portal session and return the opaque session token */
  async createSession(customerId: string, email: string): Promise<string> {
    const token = randomUUID();
    const data: SessionData = {
      customerId,
      email,
      createdAt: new Date().toISOString(),
    };

    await this.redis.set(
      `${SESSION_PREFIX}${token}`,
      JSON.stringify(data),
      'EX',
      env.PORTAL_SESSION_TTL_SECONDS,
    );

    return token;
  }

  /** Validate a portal session token and return session data */
  async validateSession(token: string): Promise<SessionData> {
    const raw = await this.redis.get(`${SESSION_PREFIX}${token}`);

    if (!raw) {
      throw new PortalSessionError('SESSION_INVALID', 'Portal session is invalid or has expired', 401);
    }

    return JSON.parse(raw) as SessionData;
  }

  /** Invalidate (logout) a portal session */
  async destroySession(token: string): Promise<void> {
    await this.redis.del(`${SESSION_PREFIX}${token}`);
  }

  /** Extend session TTL on activity (sliding window) */
  async touchSession(token: string): Promise<void> {
    await this.redis.expire(`${SESSION_PREFIX}${token}`, env.PORTAL_SESSION_TTL_SECONDS);
  }
}
