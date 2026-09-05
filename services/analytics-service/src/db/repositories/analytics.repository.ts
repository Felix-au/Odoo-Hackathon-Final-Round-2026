import { PrismaClient, Prisma, QuotationSnapshot } from '@prisma/client';

export interface UpsertQuotationSnapshotInput {
  id: string;
  companyId?: string;
  repId: string;
  repName: string;
  customerId: string;
  customerName: string;
  customerTier?: string;
  status: string;
  totalAmount: number;
  totalMarginPct?: number;
  blendedRiskScore?: number;
  currency?: string;
  lastActivityAt?: Date;
  createdAt?: Date;
  confirmedAt?: Date | null;
  lines?: Array<{
    productId: string;
    productName: string;
    categoryId?: string | null;
    categoryName?: string | null;
    discountPct?: number;
    lineTotal: number;
    marginPct?: number;
  }>;
}

export interface QuotationReportFilters {
  from?: Date;
  to?: Date;
  repId?: string;
  status?: string;
  customerId?: string;
  page?: number;
  pageSize?: number;
}

export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertQuotationSnapshot(data: UpsertQuotationSnapshotInput) {
    const companyId = data.companyId ?? 'default';

    const snapshot = await this.prisma.quotationSnapshot.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        companyId,
        repId: data.repId,
        repName: data.repName,
        customerId: data.customerId,
        customerName: data.customerName,
        customerTier: data.customerTier ?? 'STANDARD',
        status: data.status,
        totalAmount: new Prisma.Decimal(data.totalAmount),
        totalMarginPct: data.totalMarginPct ?? 0,
        blendedRiskScore: data.blendedRiskScore ?? 0,
        currency: data.currency ?? 'USD',
        lastActivityAt: data.lastActivityAt ?? new Date(),
        createdAt: data.createdAt ?? new Date(),
        confirmedAt: data.confirmedAt ?? null,
      },
      update: {
        status: data.status,
        totalAmount: new Prisma.Decimal(data.totalAmount),
        totalMarginPct: data.totalMarginPct ?? 0,
        blendedRiskScore: data.blendedRiskScore ?? 0,
        lastActivityAt: data.lastActivityAt ?? new Date(),
        confirmedAt: data.confirmedAt !== undefined ? data.confirmedAt : undefined,
      },
    });

    if (data.lines && data.lines.length > 0) {
      await this.prisma.quotationLineSnapshot.deleteMany({
        where: { quotationId: data.id },
      });

      for (const line of data.lines) {
        await this.prisma.quotationLineSnapshot.create({
          data: {
            quotationId: data.id,
            companyId,
            productId: line.productId,
            productName: line.productName,
            categoryId: line.categoryId ?? null,
            categoryName: line.categoryName ?? null,
            discountPct: line.discountPct ?? 0,
            lineTotal: new Prisma.Decimal(line.lineTotal),
            marginPct: line.marginPct ?? 0,
          },
        });
      }
    }

    return snapshot;
  }

  async upsertInvoiceSnapshot(data: {
    id: string;
    companyId?: string;
    orderId: string;
    customerId: string;
    type: string;
    status: string;
    amount: number;
    currency?: string;
    paidAt?: Date | null;
  }) {
    const companyId = data.companyId ?? 'default';
    return this.prisma.invoiceSnapshot.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        companyId,
        orderId: data.orderId,
        customerId: data.customerId,
        type: data.type,
        status: data.status,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency ?? 'USD',
        paidAt: data.paidAt ?? null,
      },
      update: {
        status: data.status,
        paidAt: data.paidAt !== undefined ? data.paidAt : undefined,
      },
    });
  }

  async upsertSubscriptionSnapshot(data: {
    id: string;
    companyId?: string;
    orderId: string;
    customerId: string;
    planName: string;
    interval: string;
    quantity: number;
    unitPrice: number;
    status: string;
    nextBillingDate: Date;
  }) {
    const companyId = data.companyId ?? 'default';
    return this.prisma.subscriptionSnapshot.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        companyId,
        orderId: data.orderId,
        customerId: data.customerId,
        planName: data.planName,
        interval: data.interval,
        quantity: data.quantity,
        unitPrice: new Prisma.Decimal(data.unitPrice),
        status: data.status,
        nextBillingDate: data.nextBillingDate,
      },
      update: {
        status: data.status,
        quantity: data.quantity,
        nextBillingDate: data.nextBillingDate,
      },
    });
  }

  async getDashboardData(companyId = 'default', fromDate?: Date, toDate?: Date) {
    const where: Prisma.QuotationSnapshotWhereInput = {
      companyId,
      ...(fromDate && toDate && {
        createdAt: {
          gte: fromDate,
          lte: toDate,
        },
      }),
    };

    const quotations = await this.prisma.quotationSnapshot.findMany({
      where,
    });

    const totalQuotations = quotations.length;
    let totalRevenue = 0;
    let totalMarginSum = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let totalApprovalDays = 0;
    let approvedItems = 0;

    const pipelineBreakdown: Record<string, number> = {
      DRAFT: 0,
      PENDING_MANAGER_APPROVAL: 0,
      PENDING_FINANCE_APPROVAL: 0,
      APPROVED: 0,
      SENT: 0,
      UNDER_NEGOTIATION: 0,
      CONFIRMED: 0,
      REJECTED: 0,
      LOST: 0,
    };

    const repStats: Record<string, { repId: string; repName: string; totalRevenue: number; quotationCount: number }> = {};

    for (const q of quotations) {
      // Pipeline breakdown
      if (pipelineBreakdown[q.status] !== undefined) {
        pipelineBreakdown[q.status]++;
      } else {
        pipelineBreakdown[q.status] = 1;
      }

      // Revenue: only count confirmed/won quotations towards revenue
      if (q.status === 'CONFIRMED') {
        totalRevenue += Number(q.totalAmount);
      }

      totalMarginSum += q.totalMarginPct;

      if (q.status === 'APPROVED' || q.status === 'CONFIRMED' || q.status === 'SENT') {
        approvedCount++;
      }
      if (q.status === 'REJECTED') {
        rejectedCount++;
      }
      if (q.status === 'PENDING_MANAGER_APPROVAL' || q.status === 'PENDING_FINANCE_APPROVAL') {
        pendingCount++;
      }

      if (q.confirmedAt) {
        const diffDays = Math.max(0, (q.confirmedAt.getTime() - q.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        totalApprovalDays += diffDays;
        approvedItems++;
      }

      // Top reps
      if (!repStats[q.repId]) {
        repStats[q.repId] = { repId: q.repId, repName: q.repName, totalRevenue: 0, quotationCount: 0 };
      }
      repStats[q.repId].quotationCount++;
      if (q.status === 'CONFIRMED') {
        repStats[q.repId].totalRevenue += Number(q.totalAmount);
      }
    }

    const averageMargin = totalQuotations > 0 ? Number((totalMarginSum / totalQuotations).toFixed(1)) : 0;
    const totalDecided = approvedCount + rejectedCount;
    const approvalRate = totalDecided > 0 ? Number((approvedCount / totalDecided).toFixed(2)) : 0;
    const averageApprovalDays = approvedItems > 0 ? Number((totalApprovalDays / approvedItems).toFixed(1)) : 0;

    const topReps = Object.values(repStats)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 5)
      .map((r) => ({
        ...r,
        totalRevenue: r.totalRevenue.toFixed(2),
      }));

    // Recurring Revenue
    const activeSubs = await this.prisma.subscriptionSnapshot.findMany({
      where: { companyId, status: 'ACTIVE' },
    });

    let mrr = 0;
    let upcomingRenewals30Days = 0;
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const sub of activeSubs) {
      const lineAmt = Number(sub.unitPrice) * sub.quantity;
      if (sub.interval.toUpperCase() === 'YEARLY' || sub.interval.toUpperCase() === 'ANNUAL') {
        mrr += lineAmt / 12;
      } else if (sub.interval.toUpperCase() === 'QUARTERLY') {
        mrr += lineAmt / 3;
      } else {
        mrr += lineAmt;
      }

      if (sub.nextBillingDate >= now && sub.nextBillingDate <= in30Days) {
        upcomingRenewals30Days += lineAmt;
      }
    }

    return {
      period: {
        from: fromDate ? fromDate.toISOString().split('T')[0] : null,
        to: toDate ? toDate.toISOString().split('T')[0] : null,
      },
      kpis: {
        totalQuotations,
        totalRevenue: totalRevenue.toFixed(2),
        averageMargin,
        approvalRate,
        averageApprovalDays,
        pendingApprovals: pendingCount,
      },
      pipelineBreakdown,
      topReps,
      recurringRevenue: {
        mrr: mrr.toFixed(2),
        upcomingRenewals30Days: upcomingRenewals30Days.toFixed(2),
      },
    };
  }

  async getQuotationReport(companyId = 'default', filters: QuotationReportFilters) {
    const where: Prisma.QuotationSnapshotWhereInput = {
      companyId,
      ...(filters.repId && { repId: filters.repId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.customerId && { customerId: filters.customerId }),
      ...(filters.from && filters.to && {
        createdAt: {
          gte: filters.from,
          lte: filters.to,
        },
      }),
    };

    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    const [quotations, total] = await Promise.all([
      this.prisma.quotationSnapshot.findMany({
        where,
        include: { lines: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.quotationSnapshot.count({ where }),
    ]);

    return { quotations, total, page, pageSize };
  }

  async getProductReport(companyId = 'default', filters: { from?: Date; to?: Date }) {
    const lines = await this.prisma.quotationLineSnapshot.findMany({
      where: { companyId },
    });

    const prodStats: Record<string, { productId: string; productName: string; quantity: number; revenue: number }> = {};
    for (const l of lines) {
      if (!prodStats[l.productId]) {
        prodStats[l.productId] = { productId: l.productId, productName: l.productName, quantity: 0, revenue: 0 };
      }
      prodStats[l.productId].quantity++;
      prodStats[l.productId].revenue += Number(l.lineTotal);
    }

    return Object.values(prodStats).sort((a, b) => b.revenue - a.revenue);
  }
}
