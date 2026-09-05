import type { UpsellRuleRepository } from '../db/repositories/upsell-rule.repository';
import type { CatalogCache } from '../cache/catalog-cache';

export class UpsellRuleService {
  constructor(
    private readonly upsellRuleRepo: UpsellRuleRepository,
    private readonly cache: CatalogCache,
  ) {}

  async getAll(companyId: string) {
    return this.upsellRuleRepo.findAll(companyId);
  }

  /**
   * Get upsell/cross-sell suggestions for a set of products.
   * Filters by minMarginPct — only suggests products that meet margin threshold (REQ-F-052).
   * CHECK-CAT-004
   */
  async getSuggestions(companyId: string, triggerProductIds: string[], currentMarginPct?: number) {
    const cacheKey = this.cache.upsellSuggestionsKey(companyId, triggerProductIds);
    const cached = await this.cache.get<object[]>(cacheKey);
    if (cached) return cached;

    const rules = await this.upsellRuleRepo.findSuggestionsForProducts(companyId, triggerProductIds);

    // Filter by minMarginPct if caller supplies current margin context
    const filtered = currentMarginPct !== undefined
      ? rules.filter((r) => r.minMarginPct <= currentMarginPct)
      : rules;

    const suggestions = filtered.map((rule) => ({
      ruleId: rule.id,
      triggerProductId: rule.triggerProductId,
      suggestedProduct: {
        id: rule.suggestedProduct.id,
        name: rule.suggestedProduct.name,
        basePrice: rule.suggestedProduct.basePrice,
        costPrice: rule.suggestedProduct.costPrice,
        category: { id: rule.suggestedProduct.category.id, name: rule.suggestedProduct.category.name },
      },
      isPromoted: rule.isPromoted,
      priority: rule.priority,
      minMarginPct: rule.minMarginPct,
    }));

    await this.cache.set(cacheKey, suggestions, this.cache.upsellTtl);
    return suggestions;
  }

  async create(companyId: string, data: {
    triggerProductId: string;
    suggestedProductId: string;
    minMarginPct?: number;
    isPromoted?: boolean;
    priority?: number;
  }) {
    const rule = await this.upsellRuleRepo.create({ ...data, companyId });
    await this.cache.delPattern(`catalog:${companyId}:upsell:*`);
    return rule;
  }

  async update(companyId: string, id: string, data: Parameters<UpsellRuleRepository['update']>[1]) {
    const rule = await this.upsellRuleRepo.update(id, data);
    await this.cache.delPattern(`catalog:${companyId}:upsell:*`);
    return rule;
  }

  async delete(companyId: string, id: string) {
    await this.upsellRuleRepo.delete(id);
    await this.cache.delPattern(`catalog:${companyId}:upsell:*`);
  }
}
