import type { ApprovalChainRepository } from '../db/repositories/approval-chain.repository';
import type { CatalogCache } from '../cache/catalog-cache';

export class ApprovalChainService {
  constructor(
    private readonly approvalChainRepo: ApprovalChainRepository,
    private readonly cache: CatalogCache,
  ) {}

  async getAll(companyId: string) {
    const cacheKey = this.cache.approvalChainsListKey(companyId);
    const cached = await this.cache.get<object[]>(cacheKey);
    if (cached) return cached;

    const chains = await this.approvalChainRepo.findAll(companyId);
    await this.cache.set(cacheKey, chains, this.cache.approvalChainTtl);
    return chains;
  }

  /** Resolve which approval chain applies for a given risk score (CHECK-CAT-003) */
  async resolveForScore(companyId: string, riskScore: number) {
    const cacheKey = this.cache.approvalChainKey(companyId, riskScore);
    const cached = await this.cache.get<object | null>(cacheKey);
    if (cached !== undefined && cached !== null) return cached;

    const chain = await this.approvalChainRepo.resolveForScore(companyId, riskScore);

    // Cache even null (no approval required)
    await this.cache.set(cacheKey, chain ?? { requiredRoles: [] }, this.cache.approvalChainTtl);
    return chain;
  }

  async create(companyId: string, data: {
    name: string;
    minRiskScore: number;
    maxRiskScore: number;
    requiredRoles: string[];
  }) {
    const chain = await this.approvalChainRepo.create({ ...data, companyId });
    await this.cache.invalidateApprovalChains(companyId);
    return chain;
  }

  async update(companyId: string, id: string, data: Parameters<ApprovalChainRepository['update']>[1]) {
    const chain = await this.approvalChainRepo.update(id, data);
    await this.cache.invalidateApprovalChains(companyId);
    return chain;
  }

  async delete(companyId: string, id: string) {
    await this.approvalChainRepo.delete(id);
    await this.cache.invalidateApprovalChains(companyId);
  }
}
