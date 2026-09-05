import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import type { User, Role } from '@prisma/client';
import { env } from '../../config/env';
import type { UserRepository } from '../repositories/user.repository';
import type { RefreshTokenRepository } from '../repositories/refresh-token.repository';

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/;

export interface SignupInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
  companyId?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    companyId: string;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  companyId: string;
}

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
  ) {}

  /** REQ-F-001 — Register new internal user */
  async signup(input: SignupInput): Promise<User> {
    // Validate password complexity
    if (input.password.length < 8 || !PASSWORD_REGEX.test(input.password)) {
      throw new AuthError(
        'VALIDATION_ERROR',
        'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character (!@#$%^&*)',
        400,
      );
    }

    // Check for existing email
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new AuthError('EMAIL_ALREADY_EXISTS', 'This email is already registered', 409);
    }

    // Hash password — bcrypt async (salt rounds: 12)
    const passwordHash = await bcrypt.hash(input.password, 12);

    return this.userRepo.create({
      email: input.email.toLowerCase().trim(),
      passwordHash,
      name: input.name.trim(),
      role: input.role ?? 'SALES_REP',
      companyId: input.companyId ?? 'default',
    });
  }

  /** REQ-F-002 — Authenticate internal user, issue JWT + refresh token */
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(email.toLowerCase().trim());

    // Always compare (even if user not found) to prevent timing attacks
    const dummyHash = '$2a$12$dummy.hash.to.prevent.timing.attack.do.not.remove';
    const isValid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);

    if (!user || !isValid) {
      // REQ: never reveal whether email exists
      throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AuthError('ACCOUNT_INACTIVE', 'Account is deactivated', 403);
    }

    const accessToken = this.issueAccessToken(user);
    const { rawToken: refreshToken } = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRY,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      },
    };
  }

  /** Exchange a valid refresh token for a new access token (rotates refresh token) */
  async refreshAccessToken(rawRefreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const stored = await this.refreshTokenRepo.findByRawToken(rawRefreshToken);

    if (!stored) {
      throw new AuthError('TOKEN_INVALID', 'Refresh token not found', 401);
    }
    if (stored.revokedAt) {
      throw new AuthError('TOKEN_INVALID', 'Refresh token has been revoked', 401);
    }
    if (stored.expiresAt < new Date()) {
      throw new AuthError('TOKEN_EXPIRED', 'Refresh token has expired', 401);
    }

    // Rotate: revoke old token
    await this.refreshTokenRepo.revoke(stored.id);

    const user = await this.userRepo.findById(stored.userId);
    if (!user || !user.isActive) {
      throw new AuthError('ACCOUNT_INACTIVE', 'Account not found or inactive', 403);
    }

    const accessToken = this.issueAccessToken(user);
    return { accessToken, expiresIn: env.JWT_ACCESS_EXPIRY };
  }

  /** Revoke a refresh token on logout */
  async logout(rawRefreshToken: string): Promise<void> {
    const stored = await this.refreshTokenRepo.findByRawToken(rawRefreshToken);
    if (stored && !stored.revokedAt) {
      await this.refreshTokenRepo.revoke(stored.id);
    }
    // Silently succeed even if token not found (idempotent logout)
  }

  /** Verify a JWT access token and return its payload */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      throw new AuthError('TOKEN_INVALID', 'Access token is invalid or expired', 401);
    }
  }

  private issueAccessToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRY });
  }

  private async issueRefreshToken(userId: string): Promise<{ rawToken: string }> {
    const rawToken = randomUUID();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRY * 1000);
    await this.refreshTokenRepo.create({ userId, rawToken, expiresAt });
    return { rawToken };
  }
}
