import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscountTierService } from '../../../src/domain/services/discount-tier.service';
import type { DiscountTierRepository } from '../../../src/db/repositories/discount-tier.repository';
import type { CatalogCache } from '../../../src/cache/catalog-cache';

describe('DiscountTierService.getCeilings (CHECK-CAT-002)', () => {
  let service: DiscountTierService;
  let repo: Partial<DiscountTierRepository>;
  let cache: Partial<CatalogCache>;

  const sampleCeilings = {
    tierCeilings: { BRONZE: 5, SILVER: 10, GOLD: 15 },
    categoryCeilings: { 'cat-services': 8 },
  };

  beforeEach(() => {
    repo = {
      findCeilings: vi.fn().mockResolvedValue(sampleCeilings),
    };
    cache = {
      discountCeilingsKey: vi.fn().mockReturnValue('catalog:default:discount-ceilings'),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      discountCeilingsTtl: 300,
    };
    service = new DiscountTierService(repo as DiscountTierRepository, cache as CatalogCache);
  });

  it('returns ceilings from DB and caches the result', async () => {
    const result = await service.getCeilings('default');

    expect(result).toEqual(sampleCeilings);
    expect(repo.findCeilings).toHaveBeenCalledWith('default');
    expect(cache.set).toHaveBeenCalledWith(
      'catalog:default:discount-ceilings',
      sampleCeilings,
      300,
    );
  });

  it('returns cached ceilings without hitting DB', async () => {
    cache.get = vi.fn().mockResolvedValue(sampleCeilings);
    service = new DiscountTierService(repo as DiscountTierRepository, cache as CatalogCache);

    const result = await service.getCeilings('default');

    expect(result).toEqual(sampleCeilings);
    expect(repo.findCeilings).not.toHaveBeenCalled();
  });

  it('tierCeilings maps BRONZE=5, SILVER=10, GOLD=15', async () => {
    const result = await service.getCeilings('default');

    expect(result.tierCeilings['BRONZE']).toBe(5);
    expect(result.tierCeilings['SILVER']).toBe(10);
    expect(result.tierCeilings['GOLD']).toBe(15);
  });
});

describe('DiscountTierService.create invalidates cache', () => {
  it('invalidates discount ceilings cache after create', async () => {
    const invalidate = vi.fn().mockResolvedValue(undefined);
    const repo = {
      create: vi.fn().mockResolvedValue({ id: '1' }),
    } as unknown as DiscountTierRepository;
    const cache = {
      discountCeilingsKey: vi.fn().mockReturnValue('key'),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      discountCeilingsTtl: 300,
      invalidateDiscountCeilings: invalidate,
    } as unknown as CatalogCache;

    const service = new DiscountTierService(repo, cache);
    await service.create('default', { customerTier: 'GOLD', ceilingPct: 20 });

    expect(invalidate).toHaveBeenCalledWith('default');
  });
});
