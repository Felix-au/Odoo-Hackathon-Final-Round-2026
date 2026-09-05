import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApprovalChainService } from '../../../src/domain/services/approval-chain.service';
import type { ApprovalChainRepository } from '../../../src/db/repositories/approval-chain.repository';
import type { CatalogCache } from '../../../src/cache/catalog-cache';

const mockChains = [
  { id: '1', companyId: 'default', name: 'No Approval', minRiskScore: 0, maxRiskScore: 0.1, requiredRoles: [], createdAt: new Date(), updatedAt: new Date() },
  { id: '2', companyId: 'default', name: 'Manager', minRiskScore: 0.1, maxRiskScore: 30, requiredRoles: ['SALES_MANAGER'], createdAt: new Date(), updatedAt: new Date() },
  { id: '3', companyId: 'default', name: 'Manager + Finance', minRiskScore: 30, maxRiskScore: 999, requiredRoles: ['SALES_MANAGER', 'FINANCE'], createdAt: new Date(), updatedAt: new Date() },
];

describe('ApprovalChainService.resolveForScore (CHECK-CAT-003)', () => {
  let service: ApprovalChainService;
  let repo: Partial<ApprovalChainRepository>;
  let cache: Partial<CatalogCache>;

  beforeEach(() => {
    repo = {
      resolveForScore: vi.fn().mockImplementation((_companyId: string, riskScore: number) => {
        const chain = mockChains.find(
          (c) => riskScore >= c.minRiskScore && riskScore < c.maxRiskScore,
        );
        return Promise.resolve(chain ?? null);
      }),
    };
    cache = {
      approvalChainKey: vi.fn().mockReturnValue('approval:key'),
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      approvalChainTtl: 900,
    };
    service = new ApprovalChainService(repo as ApprovalChainRepository, cache as CatalogCache);
  });

  it('score 0.05 → no approval required', async () => {
    const chain = await service.resolveForScore('default', 0.05);
    expect(chain?.requiredRoles).toEqual([]);
  });

  it('score 15 → SALES_MANAGER required', async () => {
    const chain = await service.resolveForScore('default', 15);
    expect(chain?.requiredRoles).toContain('SALES_MANAGER');
  });

  it('score 75 → SALES_MANAGER + FINANCE required', async () => {
    const chain = await service.resolveForScore('default', 75);
    expect(chain?.requiredRoles).toEqual(['SALES_MANAGER', 'FINANCE']);
  });

  it('returns null for score beyond all chains (repo returns null)', async () => {
    (repo.resolveForScore as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const chain = await service.resolveForScore('default', 9999);
    expect(chain).toBeNull();
  });

  it('caches result for subsequent calls', async () => {
    // Second call should use cache
    const cachedChain = { requiredRoles: ['SALES_MANAGER'] };
    cache.get = vi.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(cachedChain);
    service = new ApprovalChainService(repo as ApprovalChainRepository, cache as CatalogCache);

    await service.resolveForScore('default', 15);
    await service.resolveForScore('default', 15);

    // DB called once (first call); second served from cache
    expect(cache.set).toHaveBeenCalledTimes(1);
  });
});
