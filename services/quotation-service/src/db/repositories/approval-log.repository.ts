import { PrismaClient, ApprovalLog, ApprovalAction } from '@prisma/client';

export interface CreateApprovalLogInput {
  quotationId: string;
  approverId: string;
  approverName: string;
  approverRole: string;
  action: ApprovalAction;
  reason?: string | null;
  riskScore: number;
}

export class ApprovalLogRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateApprovalLogInput): Promise<ApprovalLog> {
    return this.prisma.approvalLog.create({
      data: {
        quotationId: data.quotationId,
        approverId: data.approverId,
        approverName: data.approverName,
        approverRole: data.approverRole,
        action: data.action,
        reason: data.reason ?? null,
        riskScore: data.riskScore,
      },
    });
  }

  async findByQuotationId(quotationId: string): Promise<ApprovalLog[]> {
    return this.prisma.approvalLog.findMany({
      where: { quotationId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
