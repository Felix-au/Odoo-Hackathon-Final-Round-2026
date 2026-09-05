import type { DiscountTierRepository } from '../../db/repositories/discount-tier.repository';
import type { CatalogCache } from '../../cache/catalog-cache';
import type { CustomerTier } from '@prisma/client';

export class DiscountTierService {
  constructor(
    private readonly discountTierRepo: DiscountTierRepository,
    private readonly cache: CatalogCache,
  ) {}

  async getAll(companyId: string) {
    return this.discountTierRepo.findAll(companyId);
  }

  /** Returns structured ceiling map — cached for 5 min (used by Quotation Service, CHECK-CAT-002) */
  async getCeilings(companyId: string) {
    const cacheKey = this.cache.discountCeilingsKey(companyId);
    const cached = await this.cache.get<{ tierCeilings: Record<string, number>; categoryCeilings: Record<string, number> }>(cacheKey);
    if (cached) return cached;

    const ceilings = await this.discountTierRepo.findCeilings(companyId);
    await this.cache.set(cacheKey, ceilings, this.cache.discountCeilingsTtl);
    return ceilings;
  }

  async create(companyId: string, data: {
    customerTier: CustomerTier;
    categoryId?: string;
    ceilingPct: number;
  }) {
    const tier = await this.discountTierRepo.create({ ...data, companyId });
    await this.cache.invalidateDiscountCeilings(companyId);
    return tier;
  }

  async delete(companyId: string, id: string) {
    await this.discountTierRepo.delete(id);
    await this.cache.invalidateDiscountCeilings(companyId);
  }
}
