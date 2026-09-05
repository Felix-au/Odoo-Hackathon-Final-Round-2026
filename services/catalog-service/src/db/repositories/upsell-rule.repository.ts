import { PrismaClient, type UpsellRule } from '@prisma/client';

export class UpsellRuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(companyId: string): Promise<UpsellRule[]> {
    return this.prisma.upsellRule.findMany({
      where: { companyId },
      orderBy: [{ priority: 'desc' }, { isPromoted: 'desc' }],
    });
  }

  /** Get active upsell suggestions for a set of trigger products (CHECK-CAT-004) */
  async findSuggestionsForProducts(
    companyId: string,
    triggerProductIds: string[],
  ): Promise<(UpsellRule & {
    suggestedProduct: import('@prisma/client').Product & { category: import('@prisma/client').ProductCategory };
  })[]> {
    return this.prisma.upsellRule.findMany({
      where: {
        companyId,
        isActive: true,
        triggerProductId: { in: triggerProductIds },
      },
      include: {
        suggestedProduct: {
          include: { category: true },
        },
      },
      orderBy: [{ isPromoted: 'desc' }, { priority: 'desc' }],
    }) as Promise<(UpsellRule & {
      suggestedProduct: import('@prisma/client').Product & { category: import('@prisma/client').ProductCategory };
    })[]>;
  }

  async create(data: {
    companyId: string;
    triggerProductId: string;
    suggestedProductId: string;
    minMarginPct?: number;
    isPromoted?: boolean;
    priority?: number;
  }): Promise<UpsellRule> {
    return this.prisma.upsellRule.create({ data });
  }

  async update(id: string, data: Partial<{
    minMarginPct: number;
    isPromoted: boolean;
    priority: number;
    isActive: boolean;
  }>): Promise<UpsellRule> {
    return this.prisma.upsellRule.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.upsellRule.delete({ where: { id } });
  }
}
