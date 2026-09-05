import type { PriceListRepository } from '../db/repositories/price-list.repository';
import type { ProductRepository } from '../db/repositories/product.repository';
import type { CatalogCache } from '../cache/catalog-cache';
import type { CustomerTier } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class PriceListService {
  constructor(
    private readonly priceListRepo: PriceListRepository,
    private readonly productRepo: ProductRepository,
    private readonly cache: CatalogCache,
  ) {}

  async getAll(companyId: string) {
    return this.priceListRepo.findAll(companyId);
  }

  async create(companyId: string, data: {
    name: string;
    customerTier: CustomerTier;
    currency?: string;
  }) {
    return this.priceListRepo.create({ ...data, companyId });
  }

  async update(id: string, data: { name?: string; isActive?: boolean }) {
    return this.priceListRepo.update(id, data);
  }

  /**
   * Resolve the effective price for a product given tier + currency.
   * Precedence: fixedPrice rule > discountPct rule > base price
   */
  async resolvePrice(companyId: string, productId: string, tier: CustomerTier, currency: string, quantity: number = 1) {
    const cacheKey = this.cache.priceResolveKey(companyId, productId, tier, currency);
    const cached = await this.cache.get<object>(cacheKey);
    if (cached) return cached;

    const product = await this.productRepo.findById(productId);
    if (!product) return null;

    const priceList = await this.priceListRepo.findByTierAndCurrency(companyId, tier, currency);

    const basePrice = Number(product.basePrice);
    let resolvedPrice = basePrice;
    let priceListId: string | null = null;
    let appliedRule: string = 'base_price';

    if (priceList) {
      // Find rule with highest minQty <= quantity
      const applicableRules = priceList.rules
        .filter((r) => r.productId === productId && r.minQty <= quantity)
        .sort((a, b) => b.minQty - a.minQty);

      if (applicableRules.length > 0) {
        const rule = applicableRules[0];
        priceListId = priceList.id;

        if (rule.fixedPrice !== null && rule.fixedPrice !== undefined) {
          resolvedPrice = Number(rule.fixedPrice);
          appliedRule = 'fixed_price';
        } else if (rule.discountPct !== null && rule.discountPct !== undefined) {
          resolvedPrice = basePrice * (1 - rule.discountPct / 100);
          appliedRule = 'tier_discount';
        }
      }
    }

    const result = {
      productId,
      resolvedPrice: resolvedPrice.toFixed(4),
      currency,
      priceListId,
      appliedRule,
    };

    await this.cache.set(cacheKey, result, this.cache.priceTtl);
    return result;
  }
}
