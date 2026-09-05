import { PrismaClient, DealHealthConfig, DealAlert, NudgeAction } from '@prisma/client';

export interface DealAlertInput {
  companyId?: string;
  quotationId: string;
  type: 'STALLED' | 'DISCOUNT_ANOMALY' | 'DELIVERY_SLIPPAGE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
}

export interface NudgeActionInput {
  alertId: string;
  quotationId: string;
  triggeredBy: string;
  type: 'EMAIL_NUDGE' | 'ESCALATION';
  sentTo: string[];
}

export class DealHealthRepository {
  private inMemoryAlerts: any[] = [
    {
      id: 'alert-001',
      companyId: 'default',
      quotationId: 'quot-ana-002',
      type: 'STALLED',
      severity: 'MEDIUM',
      message: 'Quotation for Beta Industries has been inactive for 10 days',
      isResolved: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      nudges: [],
    },
  ];

  constructor(private readonly prisma: PrismaClient) {}

  async getConfig(companyId = 'default'): Promise<DealHealthConfig> {
    try {
      const config = await this.prisma.dealHealthConfig.findUnique({
        where: { companyId },
      });

      if (config) return config;

      return await this.prisma.dealHealthConfig.create({
        data: {
          companyId,
          stallDaysThreshold: 7,
          anomalyStdDevFactor: 2.0,
          deliverySlippageDays: 3,
        },
      });
    } catch {
      return {
        id: 'cfg-01',
        companyId,
        stallDaysThreshold: 7,
        anomalyStdDevFactor: 2.0,
        deliverySlippageDays: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  async updateConfig(
    companyId: string,
    data: {
      stallDaysThreshold?: number;
      anomalyStdDevFactor?: number;
      deliverySlippageDays?: number;
    },
  ): Promise<DealHealthConfig> {
    try {
      return await this.prisma.dealHealthConfig.upsert({
        where: { companyId },
        create: {
          companyId,
          stallDaysThreshold: data.stallDaysThreshold ?? 7,
          anomalyStdDevFactor: data.anomalyStdDevFactor ?? 2.0,
          deliverySlippageDays: data.deliverySlippageDays ?? 3,
        },
        update: {
          ...(data.stallDaysThreshold !== undefined && { stallDaysThreshold: data.stallDaysThreshold }),
          ...(data.anomalyStdDevFactor !== undefined && { anomalyStdDevFactor: data.anomalyStdDevFactor }),
          ...(data.deliverySlippageDays !== undefined && { deliverySlippageDays: data.deliverySlippageDays }),
        },
      });
    } catch {
      return {
        id: 'cfg-01',
        companyId,
        stallDaysThreshold: data.stallDaysThreshold ?? 7,
        anomalyStdDevFactor: data.anomalyStdDevFactor ?? 2.0,
        deliverySlippageDays: data.deliverySlippageDays ?? 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  async findAlerts(companyId = 'default', isResolved?: boolean): Promise<DealAlert[]> {
    try {
      return await this.prisma.dealAlert.findMany({
        where: {
          companyId,
          ...(isResolved !== undefined && { isResolved }),
        },
        orderBy: { createdAt: 'desc' },
        include: {
          nudges: true,
        },
      });
    } catch {
      return this.inMemoryAlerts.filter(
        (a) => a.companyId === companyId && (isResolved === undefined || a.isResolved === isResolved),
      );
    }
  }

  async findAlertById(id: string): Promise<DealAlert | null> {
    return this.prisma.dealAlert.findUnique({
      where: { id },
      include: { nudges: true },
    });
  }

  async upsertAlert(data: DealAlertInput): Promise<DealAlert> {
    const companyId = data.companyId ?? 'default';

    // Look for existing unresolved alert of same type for this quotation
    const existing = await this.prisma.dealAlert.findFirst({
      where: {
        companyId,
        quotationId: data.quotationId,
        type: data.type,
        isResolved: false,
      },
    });

    if (existing) {
      return this.prisma.dealAlert.update({
        where: { id: existing.id },
        data: {
          severity: data.severity,
          message: data.message,
          updatedAt: new Date(),
        },
      });
    }

    return this.prisma.dealAlert.create({
      data: {
        companyId,
        quotationId: data.quotationId,
        type: data.type,
        severity: data.severity,
        message: data.message,
      },
    });
  }

  async resolveAlert(id: string): Promise<DealAlert> {
    return this.prisma.dealAlert.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
    });
  }

  async createNudge(data: NudgeActionInput): Promise<NudgeAction> {
    return this.prisma.nudgeAction.create({
      data: {
        alertId: data.alertId,
        quotationId: data.quotationId,
        triggeredBy: data.triggeredBy,
        type: data.type,
        sentTo: data.sentTo,
      },
    });
  }
}
