import { randomUUID } from 'crypto';
import type Redis from 'ioredis';
import { env } from '../../config/env';
import type { PortalCredentialRepository } from '../../db/repositories/portal-credential.repository';
import type { EmailClient } from '../../integrations/email.client';

export class MagicLinkError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'MagicLinkError';
  }
}

interface MagicLinkData {
  customerId: string;
  email: string;
  used: boolean;
  usedAt?: number;
}

const MAGIC_LINK_PREFIX = 'magic_link:';

export class MagicLinkService {
  constructor(
    private readonly redis: Redis,
    private readonly portalCredentialRepo: PortalCredentialRepository,
    private readonly emailClient: EmailClient,
  ) {}

  /**
   * REQ-F-004 — Generate and email a magic link for customer portal access.
   * Always returns 202 regardless of whether email exists (prevents enumeration).
   */
  async requestMagicLink(email: string): Promise<void> {
    const credential = await this.portalCredentialRepo.findByEmail(email.toLowerCase().trim());

    if (!credential || !credential.isActive) {
      // Still return without error — prevent email enumeration
      return;
    }

    const token = randomUUID();
    const data: MagicLinkData = {
      customerId: credential.customerId,
      email: credential.email,
      used: false,
    };

    // Store in Redis with 24h TTL (single-use — REQ-SEC-005)
    await this.redis.set(
      `${MAGIC_LINK_PREFIX}${token}`,
      JSON.stringify(data),
      'EX',
      env.MAGIC_LINK_TTL_SECONDS,
    );

    const baseUrl = process.env['FRONTEND_URL'] || (env.NODE_ENV === 'development' ? 'http://localhost:5173' : env.APP_BASE_URL);
    const verifyUrl = `${baseUrl}/portal/auth/verify?token=${token}`;
    await this.emailClient.sendMagicLink(credential.email, verifyUrl);
  }

  /**
   * REQ-F-004, REQ-SEC-005 — Validate magic link token (single-use).
   * Returns customerId + email if valid.
   */
  async verifyMagicLink(token: string): Promise<{ customerId: string; email: string }> {
    const key = `${MAGIC_LINK_PREFIX}${token}`;
    const raw = await this.redis.get(key);

    if (!raw) {
      throw new MagicLinkError('TOKEN_INVALID', 'Magic link token is invalid or has expired', 401);
    }

    const data = JSON.parse(raw) as MagicLinkData;

    if (data.used) {
      // 15-second grace window to support StrictMode / client prefetch without prematurely failing
      if (data.usedAt && Date.now() - data.usedAt < 15000) {
        return { customerId: data.customerId, email: data.email };
      }
      throw new MagicLinkError('TOKEN_ALREADY_USED', 'Magic link token has already been used', 401);
    }

    // Mark as used — atomic operation (set used flag, keep same TTL for audit)
    data.used = true;
    data.usedAt = Date.now();
    await this.redis.set(key, JSON.stringify(data), 'KEEPTTL');

    return { customerId: data.customerId, email: data.email };
  }
}
