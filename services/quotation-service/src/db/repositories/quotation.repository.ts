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
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.quotation.findUnique({
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
  }

  async findByIdempotencyKey(key: string) {
    return this.prisma.quotation.findUnique({
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
  }

  async list(filters: QuotationFilters, page = 1, pageSize = 20) {
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
  }

  async create(data: CreateQuotationInput): Promise<Quotation> {
    return this.prisma.quotation.create({
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
