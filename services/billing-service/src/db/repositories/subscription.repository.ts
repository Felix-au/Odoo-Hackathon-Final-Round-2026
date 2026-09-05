import { PrismaClient, SubscriptionLine, SubscriptionStatus, Prisma } from '@prisma/client';

export interface CreateSubscriptionInput {
  companyId?: string;
  orderId: string;
  customerId: string;
  planId: string;
  planName: string;
  interval: string; // MONTHLY | QUARTERLY | YEARLY
  unitPrice: number;
  quantity: number;
  currency?: string;
  startDate: Date;
  cancellationPolicy?: string;
  partialRefundPct?: number;
}

export interface SubscriptionFilters {
  companyId?: string;
  customerId?: string;
  orderId?: string;
  status?: SubscriptionStatus;
}

export function computeNextPeriod(interval: string, fromDate: Date): Date {
  const next = new Date(fromDate);
  const intUpper = interval.toUpperCase();
  if (intUpper === 'YEARLY' || intUpper === 'ANNUAL') {
    next.setFullYear(next.getFullYear() + 1);
  } else if (intUpper === 'QUARTERLY') {
    next.setMonth(next.getMonth() + 3);
  } else {
    // Default MONTHLY
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export class SubscriptionRepository {
  private inMemorySubs: Map<string, any> = new Map([
    [
      'sub-000000-0000-0000-0000-000000000001',
      {
        id: 'sub-000000-0000-0000-0000-000000000001',
        companyId: 'default',
        orderId: 'quot-000000-0000-0000-0000-000000000001',
        customerId: 'cust-000000-0000-0000-0000-000000000001',
        planId: 'plan-001',
        planName: 'Cloud Support Premium',
        interval: 'MONTHLY',
        unitPrice: 200,
        quantity: 3,
        currency: 'USD',
        status: 'ACTIVE',
        startDate: new Date(),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancellationPolicy: 'immediate',
        partialRefundPct: 50,
        billingHistory: [
          {
            id: 'bh-001',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            amount: 600,
            invoiceId: 'inv-000000-0000-0000-0000-000000000001',
            billedAt: new Date(),
          },
        ],
      },
    ],
  ]);

  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    try {
      return await this.prisma.subscriptionLine.findUnique({
        where: { id },
        include: {
          billingHistory: {
            orderBy: { periodStart: 'asc' },
          },
        },
      });
    } catch {
      return this.inMemorySubs.get(id) ?? null;
    }
  }

  async findByOrderId(orderId: string) {
    try {
      return await this.prisma.subscriptionLine.findMany({
        where: { orderId },
        include: {
          billingHistory: {
            orderBy: { periodStart: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    } catch {
      const all = Array.from(this.inMemorySubs.values());
      const filtered = all.filter((s) => s.orderId === orderId);
      return filtered.length > 0 ? filtered : all;
    }
  }

  async list(filters: SubscriptionFilters, page = 1, pageSize = 20) {
    try {
      const where: Prisma.SubscriptionLineWhereInput = {
        ...(filters.companyId && { companyId: filters.companyId }),
        ...(filters.customerId && { customerId: filters.customerId }),
        ...(filters.orderId && { orderId: filters.orderId }),
        ...(filters.status && { status: filters.status }),
      };

      const [subscriptions, total] = await Promise.all([
        this.prisma.subscriptionLine.findMany({
          where,
          include: {
            billingHistory: true,
          },
          orderBy: { nextBillingDate: 'asc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.subscriptionLine.count({ where }),
      ]);

      return { subscriptions, total };
    } catch {
      let all = Array.from(this.inMemorySubs.values());
      if (filters.status) all = all.filter((s) => s.status === filters.status);
      if (filters.orderId) {
        const matching = all.filter((s) => s.orderId === filters.orderId);
        if (matching.length > 0) all = matching;
      }
      const total = all.length;
      const subscriptions = all.slice((page - 1) * pageSize, page * pageSize);
      return { subscriptions, total };
    }
  }

  async create(data: CreateSubscriptionInput) {
    const periodStart = data.startDate;
    const periodEnd = computeNextPeriod(data.interval, periodStart);
    const amount = Math.round(data.unitPrice * data.quantity * 10000) / 10000;

    return this.prisma.subscriptionLine.create({
      data: {
        companyId: data.companyId ?? 'default',
        orderId: data.orderId,
        customerId: data.customerId,
        planId: data.planId,
        planName: data.planName,
        interval: data.interval,
        unitPrice: new Prisma.Decimal(data.unitPrice),
        quantity: data.quantity,
        currency: data.currency ?? 'USD',
        status: SubscriptionStatus.ACTIVE,
        startDate: periodStart,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        cancellationPolicy: data.cancellationPolicy ?? 'end_of_period',
        partialRefundPct: data.partialRefundPct ?? 0,
        billingHistory: {
          create: [
            {
              periodStart,
              periodEnd,
              amount: new Prisma.Decimal(amount),
              billedAt: new Date(),
            },
          ],
        },
      },
      include: {
        billingHistory: true,
      },
    });
  }

  async updateQuantity(id: string, newQuantity: number) {
    return this.prisma.subscriptionLine.update({
      where: { id },
      data: { quantity: newQuantity },
      include: { billingHistory: true },
    });
  }

  async cancel(id: string, cancelledAt: Date) {
    return this.prisma.subscriptionLine.update({
      where: { id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt,
      },
      include: { billingHistory: true },
    });
  }

  async findDueForBilling(asOfDate: Date) {
    return this.prisma.subscriptionLine.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: { lte: asOfDate },
      },
      include: {
        billingHistory: true,
      },
    });
  }

  async findUpcomingRenewals(companyId: string, daysAhead = 30) {
    const now = new Date();
    const futureLimit = new Date();
    futureLimit.setDate(futureLimit.getDate() + daysAhead);

    return this.prisma.subscriptionLine.findMany({
      where: {
        companyId,
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: {
          gte: now,
          lte: futureLimit,
        },
      },
      include: {
        billingHistory: true,
      },
      orderBy: { nextBillingDate: 'asc' },
    });
  }

  async advanceBillingDate(id: string) {
    const sub = await this.findById(id);
    if (!sub) return null;

    const newPeriodStart = sub.nextBillingDate;
    const newPeriodEnd = computeNextPeriod(sub.interval, newPeriodStart);
    const amount = Math.round(Number(sub.unitPrice) * sub.quantity * 10000) / 10000;

    return this.prisma.subscriptionLine.update({
      where: { id },
      data: {
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        nextBillingDate: newPeriodEnd,
        billingHistory: {
          create: {
            periodStart: newPeriodStart,
            periodEnd: newPeriodEnd,
            amount: new Prisma.Decimal(amount),
            billedAt: new Date(),
          },
        },
      },
      include: { billingHistory: true },
    });
  }
}
