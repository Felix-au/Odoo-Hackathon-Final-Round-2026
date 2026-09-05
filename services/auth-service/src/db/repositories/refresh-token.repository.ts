import { PrismaClient, type RefreshToken } from '@prisma/client';
import { createHash } from 'crypto';

export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Hash raw token with SHA-256 before DB storage */
  static hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async create(data: {
    userId: string;
    rawToken: string;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: RefreshTokenRepository.hash(data.rawToken),
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByRawToken(rawToken: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash: RefreshTokenRepository.hash(rawToken) },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Purge expired tokens older than 30 days (maintenance task) */
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return count;
  }
}
