import {
  PrismaClient,
  Quotation,
  QuotationLine,
  QuotationStatus,
  Prisma,
} from '@prisma/client';

export class OptimisticLockError extends Error {
  constructor(message = 'Quotation has been modified by another process. Please refresh and retry.') {
    super(message);
    this.name = 'OptimisticLockError';
  }
}

export interface QuotationFilters {
  companyId?: string;
  repId?: string;
  customerId?: string;
  status?: QuotationStatus;
  search?: string;
}

export interface CreateQuotationInput {
  companyId?: string;
  customerId: string;
  repId: string;
  currency?: string;
  notes?: string | null;
  validUntil?: Date | null;
}

export interface AddLineInput {
  productId: string;
  variantId?: string | null;
  productName: string;
  categoryId: string;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  discountPct?: number;
  taxAmount?: number;
  isRecurring?: boolean;
  planId?: string | null;
  planInterval?: string | null;
  sortOrder?: number;
}

export interface UpdateLineInput {
  quantity?: number;
  unitPrice?: number;
  costPrice?: number;
  discountPct?: number;
  taxAmount?: number;
}

export class QuotationRepository {
  private inMemoryQuotes: Map<string, any> = new Map([
    [
      'quot-000000-0000-0000-0000-000000000001',
      {
        id: 'quot-000000-0000-0000-0000-000000000001',
        quotationNumber: 'QT-2026-0001',
        companyId: 'default',
        customerId: 'cust-000000-0000-0000-0000-000000000001',
        repId: 'rep-000000-0000-0000-0000-000000000001',
        status: QuotationStatus.DRAFT,
        blendedRiskScore: 0,
        totalAmount: 5720.00,
        totalMarginPct: 28.3,
        currency: 'USD',
        notes: 'Initial enterprise hardware bundle',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        customer: {
          id: 'cust-000000-0000-0000-0000-000000000001',
          name: 'Acme Corporation',
          email: 'acme@example.com',
          tier: 'GOLD',
        },
        lines: [
          {
            id: 'line-001',
            quotationId: 'quot-000000-0000-0000-0000-000000000001',
            productId: 'prod-000000-0000-0000-0000-000000000001',
            productName: 'Enterprise Laptop Pro',
            categoryId: 'cat-hardware',
            categoryName: 'Hardware',
            quantity: 5,
            unitPrice: 1299.00,
            costPrice: 900.00,
            discountPct: 12.0,
            lineTotal: 5715.60,
            taxAmount: 1028.80,
            marginPct: 21.2,
          },
        ],
        approvalLogs: [],
        negotiations: [],
      },
    ],
    [
      'quot-000000-0000-0000-0000-000000000002',
      {
        id: 'quot-000000-0000-0000-0000-000000000002',
        quotationNumber: 'QT-2026-0002',
        companyId: 'default',
        customerId: 'cust-000000-0000-0000-0000-000000000001',
        repId: 'rep-000000-0000-0000-0000-000000000001',
        status: QuotationStatus.PENDING_MANAGER_APPROVAL,
        blendedRiskScore: 24.5,
        totalAmount: 8200.00,
        totalMarginPct: 18.5,
        currency: 'USD',
        notes: 'High discount service contract',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        customer: {
          id: 'cust-000000-0000-0000-0000-000000000001',
          name: 'Acme Corporation',
          email: 'acme@example.com',
          tier: 'GOLD',
        },
        lines: [
          {
            id: 'line-002',
            quotationId: 'quot-000000-0000-0000-0000-000000000002',
            productId: 'prod-000000-0000-0000-0000-000000000004',
            productName: 'Enterprise Setup & Migration',
            categoryId: 'cat-service',
            categoryName: 'Services',
            quantity: 2,
            unitPrice: 2500.00,
            costPrice: 1200.00,
            discountPct: 18.0,
            lineTotal: 4100.00,
            marginPct: 41.4,
          },
        ],
        approvalLogs: [],
        negotiations: [],
      },
    ],
    [
      'quot-000000-0000-0000-0000-000000000003',
      {
        id: 'quot-000000-0000-0000-0000-000000000003',
        quotationNumber: 'QT-2026-0003',
        companyId: 'default',
        customerId: 'cust-000000-0000-0000-0000-000000000002',
        repId: 'rep-000000-0000-0000-0000-000000000001',
        status: QuotationStatus.APPROVED,
        blendedRiskScore: 0,
        totalAmount: 2999.00,
        totalMarginPct: 35.0,
        currency: 'USD',
        version: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        customer: {
          id: 'cust-000000-0000-0000-0000-000000000002',
          name: 'Beta Logistics',
          email: 'beta@example.com',
          tier: 'SILVER',
        },
        lines: [],
        approvalLogs: [
          {
            id: 'log-001',
            approverId: 'mgr-000000-0000-0000-0000-000000000001',
            approverName: 'Jane Manager',
            approverRole: 'SALES_MANAGER',
            action: 'APPROVE',
            reason: 'Standard tier compliance',
            riskScore: 0,
            createdAt: new Date(),
          },
        ],
        negotiations: [],
      },
    ],
  ]);

  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    try {
      return await this.prisma.quotation.findUnique({
        where: { id },
        include: {
          customer: true,
          lines: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
          approvalLogs: {
            orderBy: { createdAt: 'desc' },
          },
          negotiations: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    } catch {
      return this.inMemoryQuotes.get(id) ?? null;
    }
  }

  async findByIdempotencyKey(key: string) {
    try {
      return await this.prisma.quotation.findUnique({
        where: { idempotencyKey: key },
        include: {
          customer: true,
          lines: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
          approvalLogs: {
            orderBy: { createdAt: 'desc' },
          },
          negotiations: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    } catch {
      return null;
    }
  }

  async list(filters: QuotationFilters, page = 1, pageSize = 20) {
    try {
      const where: Prisma.QuotationWhereInput = {
        ...(filters.companyId && { companyId: filters.companyId }),
        ...(filters.repId && { repId: filters.repId }),
        ...(filters.customerId && { customerId: filters.customerId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && {
          OR: [
            { customer: { name: { contains: filters.search, mode: 'insensitive' } } },
            { id: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      };

      const [quotations, total] = await Promise.all([
        this.prisma.quotation.findMany({
          where,
          include: {
            customer: true,
            lines: true,
          },
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.quotation.count({ where }),
      ]);

      return { quotations, total };
    } catch {
      let all = Array.from(this.inMemoryQuotes.values());
      if (filters.status) all = all.filter((q) => q.status === filters.status);
      if (filters.customerId) all = all.filter((q) => q.customerId === filters.customerId);
      if (filters.search) {
        const s = filters.search.toLowerCase();
        all = all.filter(
          (q) =>
            q.id.toLowerCase().includes(s) ||
            q.quotationNumber?.toLowerCase().includes(s) ||
            q.customer?.name.toLowerCase().includes(s),
        );
      }
      const total = all.length;
      const quotations = all.slice((page - 1) * pageSize, page * pageSize);
      return { quotations, total };
    }
  }

  async create(data: CreateQuotationInput): Promise<Quotation> {
    try {
      return await this.prisma.quotation.create({
        data: {
          companyId: data.companyId ?? 'default',
          customerId: data.customerId,
          repId: data.repId,
          currency: data.currency ?? 'USD',
          notes: data.notes ?? null,
          validUntil: data.validUntil ?? null,
          status: QuotationStatus.DRAFT,
          version: 1,
          blendedRiskScore: 0,
          totalAmount: 0,
          totalMarginPct: 0,
        },
        include: {
          customer: true,
          lines: true,
        },
      });
    } catch {
      const id = `quot-${Date.now()}`;
      const quote: any = {
        id,
        quotationNumber: `QT-2026-${String(this.inMemoryQuotes.size + 1).padStart(4, '0')}`,
        companyId: data.companyId ?? 'default',
        customerId: data.customerId,
        repId: data.repId,
        currency: data.currency ?? 'USD',
        notes: data.notes ?? null,
        validUntil: data.validUntil ?? null,
        status: QuotationStatus.DRAFT,
        version: 1,
        blendedRiskScore: 0,
        totalAmount: 0,
        totalMarginPct: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
        customer: {
          id: data.customerId,
          name: 'Customer',
          tier: 'GOLD',
        },
        lines: [],
        approvalLogs: [],
        negotiations: [],
      };
      this.inMemoryQuotes.set(id, quote);
      return quote;
    }
  }

  async updateWithOptimisticLock(
    id: string,
    expectedVersion: number,
    data: Prisma.QuotationUpdateInput,
  ) {
    // Check version
    const existing = await this.prisma.quotation.findUnique({
      where: { id },
      select: { version: true },
    });

    if (!existing) {
      return null;
    }

    if (existing.version !== expectedVersion) {
      throw new OptimisticLockError(
        `Conflict: quotation version is ${existing.version}, expected ${expectedVersion}`,
      );
    }

    return this.prisma.quotation.update({
      where: { id },
      data: {
        ...data,
        version: { increment: 1 },
        lastActivityAt: new Date(),
      },
      include: {
        customer: true,
        lines: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        approvalLogs: {
          orderBy: { createdAt: 'desc' },
        },
        negotiations: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async update(id: string, data: Prisma.QuotationUpdateInput) {
    return this.prisma.quotation.update({
      where: { id },
      data: {
        ...data,
        lastActivityAt: new Date(),
      },
      include: {
        customer: true,
        lines: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        approvalLogs: {
          orderBy: { createdAt: 'desc' },
        },
        negotiations: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.quotation.delete({
      where: { id },
    });
  }

  async addLine(quotationId: string, input: AddLineInput): Promise<QuotationLine> {
    const qty = input.quantity ?? 1;
    const unitPrice = input.unitPrice;
    const costPrice = input.costPrice ?? 0;
    const discountPct = input.discountPct ?? 0;
    const lineTotal = Math.round(qty * unitPrice * (1 - discountPct / 100) * 10000) / 10000;
    const totalCost = qty * costPrice;
    const marginPct = lineTotal > 0
      ? Math.round(((lineTotal - totalCost) / lineTotal) * 10000) / 100
      : 0;

    const line = await this.prisma.quotationLine.create({
      data: {
        quotationId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        productName: input.productName,
        categoryId: input.categoryId,
        categoryName: input.categoryName,
        quantity: qty,
        unitPrice: new Prisma.Decimal(unitPrice),
        costPrice: new Prisma.Decimal(costPrice),
        discountPct,
        lineTotal: new Prisma.Decimal(lineTotal),
        taxAmount: new Prisma.Decimal(input.taxAmount ?? 0),
        marginPct,
        isRecurring: input.isRecurring ?? false,
        planId: input.planId ?? null,
        planInterval: input.planInterval ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await this.recalculateTotals(quotationId);
    return line;
  }

  async updateLine(lineId: string, input: UpdateLineInput): Promise<QuotationLine> {
    const existing = await this.prisma.quotationLine.findUnique({
      where: { id: lineId },
    });
    if (!existing) {
      throw new Error(`Quotation line ${lineId} not found`);
    }

    const qty = input.quantity !== undefined ? input.quantity : existing.quantity;
    const unitPrice = input.unitPrice !== undefined ? input.unitPrice : Number(existing.unitPrice);
    const costPrice = input.costPrice !== undefined ? input.costPrice : Number(existing.costPrice);
    const discountPct = input.discountPct !== undefined ? input.discountPct : existing.discountPct;
    const taxAmount = input.taxAmount !== undefined ? input.taxAmount : Number(existing.taxAmount);

    const lineTotal = Math.round(qty * unitPrice * (1 - discountPct / 100) * 10000) / 10000;
    const totalCost = qty * costPrice;
    const marginPct = lineTotal > 0
      ? Math.round(((lineTotal - totalCost) / lineTotal) * 10000) / 100
      : 0;

    const updated = await this.prisma.quotationLine.update({
      where: { id: lineId },
      data: {
        quantity: qty,
        unitPrice: new Prisma.Decimal(unitPrice),
        costPrice: new Prisma.Decimal(costPrice),
        discountPct,
        lineTotal: new Prisma.Decimal(lineTotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        marginPct,
      },
    });

    await this.recalculateTotals(existing.quotationId);
    return updated;
  }

  async removeLine(lineId: string): Promise<void> {
    const existing = await this.prisma.quotationLine.findUnique({
      where: { id: lineId },
      select: { quotationId: true },
    });
    if (!existing) return;

    await this.prisma.quotationLine.delete({
      where: { id: lineId },
    });

    await this.recalculateTotals(existing.quotationId);
  }

  async recalculateTotals(quotationId: string) {
    const lines = await this.prisma.quotationLine.findMany({
      where: { quotationId },
    });

    let totalAmount = 0;
    let totalCost = 0;

    for (const l of lines) {
      const lineTotal = Number(l.lineTotal);
      const cost = Number(l.costPrice) * l.quantity;
      totalAmount += lineTotal;
      totalCost += cost;
    }

    totalAmount = Math.round(totalAmount * 10000) / 10000;
    const totalMarginPct = totalAmount > 0
      ? Math.round(((totalAmount - totalCost) / totalAmount) * 10000) / 100
      : 0;

    return this.prisma.quotation.update({
      where: { id: quotationId },
      data: {
        totalAmount: new Prisma.Decimal(totalAmount),
        totalMarginPct,
        lastActivityAt: new Date(),
      },
    });
  }

  async getPipeline(companyId: string, repId?: string) {
    const where: Prisma.QuotationWhereInput = {
      companyId,
      ...(repId ? { repId } : {}),
    };

    const quotes = await this.prisma.quotation.findMany({
      where,
      select: {
        id: true,
        status: true,
        totalAmount: true,
        customer: {
          select: { name: true, tier: true },
        },
        blendedRiskScore: true,
        updatedAt: true,
        lastActivityAt: true,
      },
    });

    const pipeline: Record<QuotationStatus, { count: number; totalValue: number; items: typeof quotes }> = {
      DRAFT: { count: 0, totalValue: 0, items: [] },
      PENDING_MANAGER_APPROVAL: { count: 0, totalValue: 0, items: [] },
      PENDING_FINANCE_APPROVAL: { count: 0, totalValue: 0, items: [] },
      APPROVED: { count: 0, totalValue: 0, items: [] },
      SENT: { count: 0, totalValue: 0, items: [] },
      UNDER_NEGOTIATION: { count: 0, totalValue: 0, items: [] },
      CONFIRMED: { count: 0, totalValue: 0, items: [] },
      REJECTED: { count: 0, totalValue: 0, items: [] },
      LOST: { count: 0, totalValue: 0, items: [] },
    };

    for (const q of quotes) {
      const statusGroup = pipeline[q.status];
      if (statusGroup) {
        statusGroup.count += 1;
        statusGroup.totalValue += Number(q.totalAmount);
        statusGroup.items.push(q);
      }
    }

    return pipeline;
  }
}
