import { PrismaClient, type CustomerPortalCredential } from '@prisma/client';

export class PortalCredentialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<CustomerPortalCredential | null> {
    return this.prisma.customerPortalCredential.findUnique({ where: { email } });
  }

  async findByCustomerId(customerId: string): Promise<CustomerPortalCredential | null> {
    return this.prisma.customerPortalCredential.findUnique({ where: { customerId } });
  }

  async create(data: {
    customerId: string;
    email: string;
    passwordHash?: string;
  }): Promise<CustomerPortalCredential> {
    return this.prisma.customerPortalCredential.create({ data });
  }

  async updatePassword(customerId: string, passwordHash: string): Promise<void> {
    await this.prisma.customerPortalCredential.update({
      where: { customerId },
      data: { passwordHash },
    });
  }

  async setActive(customerId: string, isActive: boolean): Promise<void> {
    await this.prisma.customerPortalCredential.update({
      where: { customerId },
      data: { isActive },
    });
  }
}
