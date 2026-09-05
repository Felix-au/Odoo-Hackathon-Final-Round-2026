import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService, AuthError } from '../../../src/domain/services/auth.service';
import type { UserRepository } from '../../../src/db/repositories/user.repository';
import type { RefreshTokenRepository } from '../../../src/db/repositories/refresh-token.repository';
import type { User, RefreshToken } from '@prisma/client';

// ─── Mock Factories ───────────────────────────────────────────

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-uuid-001',
    email: 'test@example.com',
    passwordHash: '$2a$12$Jm9L8Q5xK2gX3N1hV6rLpuSqE7wP4tM0zY1bC8dA6fRvWkNoIeHui',
    name: 'Test User',
    role: 'SALES_REP',
    companyId: 'default',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRefreshToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  return {
    id: 'rt-uuid-001',
    userId: 'user-uuid-001',
    tokenHash: 'abc123hash',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    revokedAt: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────

describe('AuthService.login', () => {
  let authService: AuthService;
  let userRepo: Partial<UserRepository>;
  let refreshTokenRepo: Partial<RefreshTokenRepository>;

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      updateRole: vi.fn(),
      setActive: vi.fn(),
      listAll: vi.fn(),
    };

    refreshTokenRepo = {
      create: vi.fn().mockResolvedValue(makeRefreshToken()),
      findByRawToken: vi.fn(),
      revoke: vi.fn(),
      revokeAllForUser: vi.fn(),
      purgeExpired: vi.fn(),
    };

    authService = new AuthService(
      userRepo as UserRepository,
      refreshTokenRepo as RefreshTokenRepository,
    );
  });

  it('should return tokens for valid credentials (CHECK-AUTH-001)', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('Password1!', 12);
    vi.mocked(userRepo.findByEmail!).mockResolvedValue(makeUser({ passwordHash: hash }));

    const result = await authService.login('test@example.com', 'Password1!');

    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
    expect(result.expiresIn).toBeGreaterThan(0);
    expect(result.user.email).toBe('test@example.com');
  });

  it('should throw INVALID_CREDENTIALS for wrong password (CHECK-AUTH-002)', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('CorrectPassword1!', 12);
    vi.mocked(userRepo.findByEmail!).mockResolvedValue(makeUser({ passwordHash: hash }));

    await expect(authService.login('test@example.com', 'WrongPass')).rejects.toThrow(AuthError);

    try {
      await authService.login('test@example.com', 'WrongPass');
    } catch (err) {
      expect((err as AuthError).code).toBe('INVALID_CREDENTIALS');
      expect((err as AuthError).statusCode).toBe(401);
    }
  });

  it('should throw INVALID_CREDENTIALS for non-existent email (email enumeration prevention)', async () => {
    vi.mocked(userRepo.findByEmail!).mockResolvedValue(null);

    await expect(authService.login('nonexistent@example.com', 'Password1!')).rejects.toThrow(AuthError);

    try {
      await authService.login('nonexistent@example.com', 'Password1!');
    } catch (err) {
      // MUST NOT be EMAIL_NOT_FOUND — same error as wrong password (REQ-SEC-007)
      expect((err as AuthError).code).toBe('INVALID_CREDENTIALS');
    }
  });

  it('should throw ACCOUNT_INACTIVE for deactivated user', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('Password1!', 12);
    vi.mocked(userRepo.findByEmail!).mockResolvedValue(makeUser({ isActive: false, passwordHash: hash }));

    try {
      await authService.login('test@example.com', 'Password1!');
    } catch (err) {
      expect((err as AuthError).code).toBe('ACCOUNT_INACTIVE');
      expect((err as AuthError).statusCode).toBe(403);
    }
  });
});

describe('AuthService.signup', () => {
  let authService: AuthService;
  let userRepo: Partial<UserRepository>;
  let refreshTokenRepo: Partial<RefreshTokenRepository>;

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(makeUser()),
      findById: vi.fn(),
      updateRole: vi.fn(),
      setActive: vi.fn(),
      listAll: vi.fn(),
    };

    refreshTokenRepo = {
      create: vi.fn(),
      findByRawToken: vi.fn(),
      revoke: vi.fn(),
      revokeAllForUser: vi.fn(),
      purgeExpired: vi.fn(),
    };

    authService = new AuthService(
      userRepo as UserRepository,
      refreshTokenRepo as RefreshTokenRepository,
    );
  });

  it('should reject weak passwords (CHECK-AUTH-003)', async () => {
    await expect(authService.signup({
      email: 'user@example.com',
      password: 'short',
      name: 'User',
    })).rejects.toThrow(AuthError);

    await expect(authService.signup({
      email: 'user@example.com',
      password: 'nouppercase1!',
      name: 'User',
    })).rejects.toThrow(AuthError);

    await expect(authService.signup({
      email: 'user@example.com',
      password: 'NoSpecialChar1',
      name: 'User',
    })).rejects.toThrow(AuthError);
  });

  it('should accept strong passwords', async () => {
    await expect(authService.signup({
      email: 'user@example.com',
      password: 'StrongP@ss1',
      name: 'New User',
    })).resolves.toBeDefined();
  });

  it('should throw EMAIL_ALREADY_EXISTS for duplicate email', async () => {
    vi.mocked(userRepo.findByEmail!).mockResolvedValue(makeUser());

    try {
      await authService.signup({
        email: 'test@example.com',
        password: 'Password1!',
        name: 'Another User',
      });
    } catch (err) {
      expect((err as AuthError).code).toBe('EMAIL_ALREADY_EXISTS');
      expect((err as AuthError).statusCode).toBe(409);
    }
  });
});

describe('AuthService.refreshAccessToken', () => {
  let authService: AuthService;
  let userRepo: Partial<UserRepository>;
  let refreshTokenRepo: Partial<RefreshTokenRepository>;

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeUser()),
      create: vi.fn(),
      updateRole: vi.fn(),
      setActive: vi.fn(),
      listAll: vi.fn(),
    };

    refreshTokenRepo = {
      create: vi.fn(),
      findByRawToken: vi.fn(),
      revoke: vi.fn(),
      revokeAllForUser: vi.fn(),
      purgeExpired: vi.fn(),
    };

    authService = new AuthService(
      userRepo as UserRepository,
      refreshTokenRepo as RefreshTokenRepository,
    );
  });

  it('should return new access token for valid refresh token', async () => {
    vi.mocked(refreshTokenRepo.findByRawToken!).mockResolvedValue(makeRefreshToken());
    vi.mocked(refreshTokenRepo.revoke!).mockResolvedValue(undefined);

    const result = await authService.refreshAccessToken('valid-raw-token');

    expect(result).toHaveProperty('accessToken');
    expect(result.expiresIn).toBeGreaterThan(0);
    // Token should be rotated
    expect(refreshTokenRepo.revoke).toHaveBeenCalledOnce();
  });

  it('should throw TOKEN_INVALID for revoked token', async () => {
    vi.mocked(refreshTokenRepo.findByRawToken!).mockResolvedValue(
      makeRefreshToken({ revokedAt: new Date() }),
    );

    await expect(authService.refreshAccessToken('revoked-token')).rejects.toThrow(AuthError);
    try {
      await authService.refreshAccessToken('revoked-token');
    } catch (err) {
      expect((err as AuthError).code).toBe('TOKEN_INVALID');
    }
  });

  it('should throw TOKEN_EXPIRED for expired token', async () => {
    vi.mocked(refreshTokenRepo.findByRawToken!).mockResolvedValue(
      makeRefreshToken({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(authService.refreshAccessToken('expired-token')).rejects.toThrow(AuthError);
    try {
      await authService.refreshAccessToken('expired-token');
    } catch (err) {
      expect((err as AuthError).code).toBe('TOKEN_EXPIRED');
    }
  });
});
