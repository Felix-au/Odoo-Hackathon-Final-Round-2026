import { PrismaClient, type PriceList, type PriceListRule, type CustomerTier } from '@prisma/client';

export class PriceListRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(companyId: string): Promise<(PriceList & { rules: PriceListRule[] })[]> {
    return this.prisma.priceList.findMany({
      where: { companyId, isActive: true },
      include: { rules: true },
      orderBy: [{ customerTier: 'asc' }, { currency: 'asc' }],
    });
  }

  async findById(id: string): Promise<(PriceList & { rules: PriceListRule[] }) | null> {
    return this.prisma.priceList.findUnique({
      where: { id },
      include: { rules: true },
    });
  }

  async findByTierAndCurrency(
    companyId: string,
    tier: CustomerTier,
    currency: string,
  ): Promise<(PriceList & { rules: PriceListRule[] }) | null> {
    return this.prisma.priceList.findFirst({
      where: { companyId, customerTier: tier, currency, isActive: true },
      include: { rules: true },
    });
  }

  async create(data: {
    companyId: string;
    name: string;
    customerTier: CustomerTier;
    currency?: string;
  }): Promise<PriceList> {
    return this.prisma.priceList.create({ data });
  }

  async update(id: string, data: Partial<{ name: string; isActive: boolean }>): Promise<PriceList> {
    return this.prisma.priceList.update({ where: { id }, data });
  }

  async addRule(priceListId: string, data: {
    productId: string;
    fixedPrice?: number;
    discountPct?: number;
    minQty?: number;
  }): Promise<PriceListRule> {
    return this.prisma.priceListRule.create({ data: { priceListId, ...data } });
  }

  async deleteRule(ruleId: string): Promise<void> {
    await this.prisma.priceListRule.delete({ where: { id: ruleId } });
  }
}
