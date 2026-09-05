import { PrismaClient, type ApprovalChain } from '@prisma/client';

export class ApprovalChainRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(companyId: string): Promise<ApprovalChain[]> {
    return this.prisma.approvalChain.findMany({
      where: { companyId },
      orderBy: { minRiskScore: 'asc' },
    });
  }

  /** Find the chain that covers the given risk score */
  async resolveForScore(companyId: string, riskScore: number): Promise<ApprovalChain | null> {
    return this.prisma.approvalChain.findFirst({
      where: {
        companyId,
        minRiskScore: { lte: riskScore },
        maxRiskScore: { gt: riskScore },
      },
      orderBy: { minRiskScore: 'asc' },
    });
  }

  async create(data: {
    companyId: string;
    name: string;
    minRiskScore: number;
    maxRiskScore: number;
    requiredRoles: string[];
  }): Promise<ApprovalChain> {
    return this.prisma.approvalChain.create({ data });
  }

  async update(id: string, data: Partial<{
    name: string;
    minRiskScore: number;
    maxRiskScore: number;
    requiredRoles: string[];
  }>): Promise<ApprovalChain> {
    return this.prisma.approvalChain.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.approvalChain.delete({ where: { id } });
  }
}
