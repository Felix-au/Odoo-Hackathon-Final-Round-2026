import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MagicLinkService, MagicLinkError } from '../../../src/domain/services/magic-link.service';
import type { PortalCredentialRepository } from '../../../src/db/repositories/portal-credential.repository';
import type { EmailClient } from '../../../src/integrations/email.client';
import type { CustomerPortalCredential } from '@prisma/client';

// ─── Mock Redis ───────────────────────────────────────────────

function makeRedis() {
  const store = new Map<string, string>();
  return {
    set: vi.fn(async (key: string, value: string) => { store.set(key, value); return 'OK'; }),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    del: vi.fn(async (key: string) => { store.delete(key); return 1; }),
    // Expose store for test assertions
    _store: store,
  };
}

function makeCredential(overrides: Partial<CustomerPortalCredential> = {}): CustomerPortalCredential {
  return {
    id: 'cred-uuid-001',
    customerId: 'cust-uuid-001',
    email: 'portal@example.com',
    passwordHash: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('MagicLinkService.requestMagicLink', () => {
  let magicLinkService: MagicLinkService;
  let redis: ReturnType<typeof makeRedis>;
  let portalCredentialRepo: Partial<PortalCredentialRepository>;
  let emailClient: Partial<EmailClient>;

  beforeEach(() => {
    redis = makeRedis();
    portalCredentialRepo = {
      findByEmail: vi.fn(),
    };
    emailClient = {
      sendMagicLink: vi.fn().mockResolvedValue(undefined),
    };

    magicLinkService = new MagicLinkService(
      redis as unknown as import('ioredis').default,
      portalCredentialRepo as PortalCredentialRepository,
      emailClient as EmailClient,
    );
  });

  it('should silently succeed for unknown email (prevent enumeration) (CHECK-AUTH-004)', async () => {
    vi.mocked(portalCredentialRepo.findByEmail!).mockResolvedValue(null);

    // Should NOT throw for non-existent email
    await expect(magicLinkService.requestMagicLink('unknown@example.com')).resolves.toBeUndefined();

    // Email should NOT have been sent
    expect(emailClient.sendMagicLink).not.toHaveBeenCalled();
  });

  it('should generate token and send email for valid email (CHECK-AUTH-004)', async () => {
    vi.mocked(portalCredentialRepo.findByEmail!).mockResolvedValue(makeCredential());

    await magicLinkService.requestMagicLink('portal@example.com');

    // Should have stored a token in Redis
    expect(redis.set).toHaveBeenCalledOnce();
    const [key, value] = vi.mocked(redis.set).mock.calls[0] as [string, string];
    expect(key).toMatch(/^magic_link:/);
    const data = JSON.parse(value);
    expect(data.used).toBe(false);
    expect(data.customerId).toBe('cust-uuid-001');

    // Should have sent the email
    expect(emailClient.sendMagicLink).toHaveBeenCalledOnce();
  });
});

describe('MagicLinkService.verifyMagicLink', () => {
  let magicLinkService: MagicLinkService;
  let redis: ReturnType<typeof makeRedis>;
  let portalCredentialRepo: Partial<PortalCredentialRepository>;
  let emailClient: Partial<EmailClient>;

  beforeEach(() => {
    redis = makeRedis();
    portalCredentialRepo = { findByEmail: vi.fn() };
    emailClient = { sendMagicLink: vi.fn() };

    magicLinkService = new MagicLinkService(
      redis as unknown as import('ioredis').default,
      portalCredentialRepo as PortalCredentialRepository,
      emailClient as EmailClient,
    );
  });

  it('should return customerId + email for valid token (CHECK-AUTH-004)', async () => {
    const token = 'valid-test-token';
    redis._store.set(`magic_link:${token}`, JSON.stringify({
      customerId: 'cust-001',
      email: 'portal@example.com',
      used: false,
    }));

    const result = await magicLinkService.verifyMagicLink(token);

    expect(result.customerId).toBe('cust-001');
    expect(result.email).toBe('portal@example.com');
  });

  it('should throw TOKEN_INVALID for unknown token', async () => {
    await expect(magicLinkService.verifyMagicLink('nonexistent-token')).rejects.toThrow(MagicLinkError);

    try {
      await magicLinkService.verifyMagicLink('nonexistent-token');
    } catch (err) {
      expect((err as MagicLinkError).code).toBe('TOKEN_INVALID');
      expect((err as MagicLinkError).statusCode).toBe(401);
    }
  });

  it('should throw TOKEN_ALREADY_USED for single-use enforcement (REQ-SEC-005)', async () => {
    const token = 'used-token';
    redis._store.set(`magic_link:${token}`, JSON.stringify({
      customerId: 'cust-001',
      email: 'portal@example.com',
      used: true,  // Already used
    }));

    await expect(magicLinkService.verifyMagicLink(token)).rejects.toThrow(MagicLinkError);

    try {
      await magicLinkService.verifyMagicLink(token);
    } catch (err) {
      expect((err as MagicLinkError).code).toBe('TOKEN_ALREADY_USED');
    }
  });

  it('should mark token as used after first verification (single-use enforcement)', async () => {
    const token = 'fresh-token';
    redis._store.set(`magic_link:${token}`, JSON.stringify({
      customerId: 'cust-001',
      email: 'portal@example.com',
      used: false,
    }));

    await magicLinkService.verifyMagicLink(token);

    // Second call should fail
    await expect(magicLinkService.verifyMagicLink(token)).rejects.toThrow(MagicLinkError);
  });
});
