import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PriceListService } from '../../../src/domain/services/price-list.service';
import type { PriceListRepository } from '../../../src/db/repositories/price-list.repository';
import type { ProductRepository } from '../../../src/db/repositories/product.repository';
import type { CatalogCache } from '../../../src/cache/catalog-cache';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockCache(overrides: Partial<CatalogCache> = {}): CatalogCache {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    delPattern: vi.fn().mockResolvedValue(undefined),
    priceResolveKey: vi.fn().mockReturnValue('price:key'),
    priceTtl: 300,
    ...overrides,
  } as unknown as CatalogCache;
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1',
    companyId: 'default',
    name: 'Test Product',
    basePrice: new Decimal(1000),
    costPrice: new Decimal(600),
    categoryId: 'cat-1',
    unit: 'unit',
    taxRate: 18,
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: { id: 'cat-1', name: 'Hardware' },
    variants: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PriceListService.resolvePrice', () => {
  let service: PriceListService;
  let priceListRepo: Partial<PriceListRepository>;
  let productRepo: Partial<ProductRepository>;
  let cache: CatalogCache;

  beforeEach(() => {
    cache = makeMockCache();
    productRepo = {
      findById: vi.fn().mockResolvedValue(makeProduct()),
    };
    priceListRepo = {
      findByTierAndCurrency: vi.fn().mockResolvedValue(null),
    };
    service = new PriceListService(
      priceListRepo as PriceListRepository,
      productRepo as ProductRepository,
      cache,
    );
  });

  it('returns base price when no price list exists for tier/currency', async () => {
    const result = await service.resolvePrice('default', 'product-1', 'BRONZE', 'USD');

    expect(result).toMatchObject({
      productId: 'product-1',
      resolvedPrice: '1000.0000',
      currency: 'USD',
      priceListId: null,
      appliedRule: 'base_price',
    });
  });

  it('applies discount percentage rule correctly', async () => {
    // 10% off 1000 = 900
    (priceListRepo.findByTierAndCurrency as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'pl-1',
      rules: [{ productId: 'product-1', fixedPrice: null, discountPct: 10, minQty: 1 }],
    });

    const result = await service.resolvePrice('default', 'product-1', 'SILVER', 'USD');

    expect(result?.resolvedPrice).toBe('900.0000');
    expect(result?.appliedRule).toBe('tier_discount');
    expect(result?.priceListId).toBe('pl-1');
  });

  it('applies fixed price rule over discount percentage (precedence)', async () => {
    (priceListRepo.findByTierAndCurrency as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'pl-gold',
      rules: [{ productId: 'product-1', fixedPrice: new Decimal(850), discountPct: 10, minQty: 1 }],
    });

    const result = await service.resolvePrice('default', 'product-1', 'GOLD', 'USD');

    expect(result?.resolvedPrice).toBe('850.0000');
    expect(result?.appliedRule).toBe('fixed_price');
  });

  it('selects rule with highest minQty <= quantity', async () => {
    // quantity=10: should pick minQty=5 rule (discountPct 15%), not minQty=1 (10%)
    (priceListRepo.findByTierAndCurrency as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'pl-1',
      rules: [
        { productId: 'product-1', fixedPrice: null, discountPct: 10, minQty: 1 },
        { productId: 'product-1', fixedPrice: null, discountPct: 15, minQty: 5 },
      ],
    });

    const result = await service.resolvePrice('default', 'product-1', 'GOLD', 'USD', 10);

    expect(result?.resolvedPrice).toBe('850.0000'); // 1000 * (1 - 0.15) = 850
    expect(result?.appliedRule).toBe('tier_discount');
  });

  it('returns null when product not found', async () => {
    (productRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await service.resolvePrice('default', 'missing-product', 'GOLD', 'USD');

    expect(result).toBeNull();
  });

  it('returns cached result on subsequent calls (cache-aside)', async () => {
    const cachedResult = { productId: 'product-1', resolvedPrice: '999.0000', currency: 'USD', priceListId: null, appliedRule: 'cached' };
    cache = makeMockCache({ get: vi.fn().mockResolvedValue(cachedResult) });
    service = new PriceListService(priceListRepo as PriceListRepository, productRepo as ProductRepository, cache);

    const result = await service.resolvePrice('default', 'product-1', 'GOLD', 'USD');

    expect(result).toEqual(cachedResult);
    expect(productRepo.findById).not.toHaveBeenCalled();
  });
});
