import { PrismaClient, type SubscriptionPlan } from '@prisma/client';

export class SubscriptionPlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(companyId: string): Promise<(SubscriptionPlan & { productLinks: import('@prisma/client').ProductPlanLink[] })[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: { companyId },
      include: { productLinks: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string): Promise<SubscriptionPlan | null> {
    return this.prisma.subscriptionPlan.findUnique({
      where: { id },
      include: { productLinks: true },
    });
  }

  async findByProductId(productId: string): Promise<SubscriptionPlan[]> {
    return this.prisma.subscriptionPlan.findMany({
      where: {
        isActive: true,
        productLinks: { some: { productId } },
      },
    });
  }

  async create(data: {
    companyId: string;
    name: string;
    interval: import('@prisma/client').BillingInterval;
    basePrice: number;
    currency?: string;
    prorationMode?: import('@prisma/client').ProrationMode;
    cancellationPolicy?: string;
    partialRefundPct?: number;
  }): Promise<SubscriptionPlan> {
    return this.prisma.subscriptionPlan.create({ data });
  }

  async update(id: string, data: Partial<{
    name: string;
    basePrice: number;
    currency: string;
    prorationMode: import('@prisma/client').ProrationMode;
    cancellationPolicy: string;
    partialRefundPct: number;
    isActive: boolean;
  }>): Promise<SubscriptionPlan> {
    return this.prisma.subscriptionPlan.update({ where: { id }, data });
  }

  async linkToProduct(planId: string, productId: string): Promise<void> {
    await this.prisma.productPlanLink.create({ data: { planId, productId } });
  }

  async unlinkFromProduct(planId: string, productId: string): Promise<void> {
    await this.prisma.productPlanLink.deleteMany({ where: { planId, productId } });
  }
}
