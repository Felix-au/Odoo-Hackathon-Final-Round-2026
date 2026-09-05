import { PrismaClient, type DiscountTier, type CustomerTier } from '@prisma/client';

export class DiscountTierRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(companyId: string): Promise<DiscountTier[]> {
    return this.prisma.discountTier.findMany({ where: { companyId } });
  }

  /** Returns all tiers including category-specific overrides */
  async findCeilings(companyId: string): Promise<{
    tierCeilings: Record<string, number>;
    categoryCeilings: Record<string, number>;
  }> {
    const tiers = await this.prisma.discountTier.findMany({ where: { companyId } });

    const tierCeilings: Record<string, number> = {};
    const categoryCeilings: Record<string, number> = {};

    for (const tier of tiers) {
      if (!tier.categoryId) {
        // Global ceiling for this tier
        const existing = tierCeilings[tier.customerTier] ?? 0;
        if (tier.ceilingPct > existing) {
          tierCeilings[tier.customerTier] = tier.ceilingPct;
        }
      } else {
        // Category-specific override
        const key = tier.categoryId;
        const existing = categoryCeilings[key] ?? 0;
        if (tier.ceilingPct > existing) {
          categoryCeilings[key] = tier.ceilingPct;
        }
      }
    }

    return { tierCeilings, categoryCeilings };
  }

  async create(data: {
    companyId: string;
    customerTier: CustomerTier;
    categoryId?: string;
    ceilingPct: number;
  }): Promise<DiscountTier> {
    return this.prisma.discountTier.create({ data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.discountTier.delete({ where: { id } });
  }
}
