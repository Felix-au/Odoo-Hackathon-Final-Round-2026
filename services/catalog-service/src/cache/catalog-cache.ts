import type Redis from 'ioredis';
import { env } from '../config/env';

/**
 * CatalogCache — Redis cache wrapper for catalog data.
 *
 * Strategy: Cache-aside with write-through invalidation.
 * - On READ: check cache first; on miss, fetch from DB and populate cache
 * - On WRITE: invalidate (delete) relevant cache keys after DB write
 *
 * Cache key namespacing: catalog:<companyId>:<type>:<identifier>
 */
export class CatalogCache {
  constructor(private readonly redis: Redis) {}

  // ─── Generic helpers ──────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  // ─── Cache key builders ───────────────────────────────────

  productKey(companyId: string, productId: string): string {
    return `catalog:${companyId}:product:${productId}`;
  }

  productListKey(companyId: string, page: number, pageSize: number, filters: string): string {
    return `catalog:${companyId}:products:${page}:${pageSize}:${filters}`;
  }

  discountCeilingsKey(companyId: string): string {
    return `catalog:${companyId}:discount-ceilings`;
  }

  approvalChainKey(companyId: string, riskScore: number): string {
    // Round to nearest 0.1 to improve cache hit rate
    const rounded = Math.round(riskScore * 10) / 10;
    return `catalog:${companyId}:approval-chain:${rounded}`;
  }

  approvalChainsListKey(companyId: string): string {
    return `catalog:${companyId}:approval-chains`;
  }

  upsellSuggestionsKey(companyId: string, productIds: string[]): string {
    const sorted = [...productIds].sort().join(',');
    return `catalog:${companyId}:upsell:${sorted}`;
  }

  warehousesKey(companyId: string): string {
    return `catalog:${companyId}:warehouses`;
  }

  priceResolveKey(companyId: string, productId: string, tier: string, currency: string): string {
    return `catalog:${companyId}:price:${productId}:${tier}:${currency}`;
  }

  // ─── Invalidation helpers ─────────────────────────────────

  async invalidateProduct(companyId: string, productId: string): Promise<void> {
    await Promise.all([
      this.del(this.productKey(companyId, productId)),
      this.delPattern(`catalog:${companyId}:products:*`),
      this.delPattern(`catalog:${companyId}:price:${productId}:*`),
      this.delPattern(`catalog:${companyId}:upsell:*`),
    ]);
  }

  async invalidateDiscountCeilings(companyId: string): Promise<void> {
    await this.del(this.discountCeilingsKey(companyId));
  }

  async invalidateApprovalChains(companyId: string): Promise<void> {
    await Promise.all([
      this.del(this.approvalChainsListKey(companyId)),
      this.delPattern(`catalog:${companyId}:approval-chain:*`),
    ]);
  }

  async invalidateWarehouses(companyId: string): Promise<void> {
    await this.del(this.warehousesKey(companyId));
  }

  // ─── TTL constants ────────────────────────────────────────

  get productTtl(): number { return env.CATALOG_CACHE_TTL_SECONDS; }
  get discountCeilingsTtl(): number { return env.DISCOUNT_CEILING_CACHE_TTL; }
  get approvalChainTtl(): number { return env.APPROVAL_CHAIN_CACHE_TTL; }
  get warehousesTtl(): number { return env.CATALOG_CACHE_TTL_SECONDS; }
  get upsellTtl(): number { return env.CATALOG_CACHE_TTL_SECONDS; }
  get priceTtl(): number { return env.CATALOG_CACHE_TTL_SECONDS; }
}
