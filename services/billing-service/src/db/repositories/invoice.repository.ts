import { PrismaClient, Invoice, InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';

export interface CreateInvoiceLineInput {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  taxRate?: number;
  taxAmount?: number;
}

export interface CreateInvoiceInput {
  companyId?: string;
  orderId: string;
  customerId: string;
  type: InvoiceType;
  currency?: string;
  dueDate?: Date | null;
  notes?: string | null;
  idempotencyKey?: string | null;
  status?: InvoiceStatus;
  lines: CreateInvoiceLineInput[];
}

export interface InvoiceFilters {
  companyId?: string;
  customerId?: string;
  orderId?: string;
  status?: InvoiceStatus;
  type?: InvoiceType;
}

export class InvoiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: true,
        payments: {
          orderBy: { recordedAt: 'desc' },
        },
      },
    });
  }

  async findByIdempotencyKey(key: string) {
    return this.prisma.invoice.findUnique({
      where: { idempotencyKey: key },
      include: {
        lines: true,
        payments: true,
      },
    });
  }

  async findByOrderId(orderId: string) {
    return this.prisma.invoice.findMany({
      where: { orderId },
      include: {
        lines: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async list(filters: InvoiceFilters, page = 1, pageSize = 20) {
    const where: Prisma.InvoiceWhereInput = {
      ...(filters.companyId && { companyId: filters.companyId }),
      ...(filters.customerId && { customerId: filters.customerId }),
      ...(filters.orderId && { orderId: filters.orderId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.type && { type: filters.type }),
    };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          lines: true,
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { invoices, total };
  }

  async create(data: CreateInvoiceInput) {
    let subtotal = 0;
    let totalTax = 0;

    const formattedLines = data.lines.map((l) => {
      const discount = l.discountPct ?? 0;
      const lineTotal = Math.round(l.quantity * l.unitPrice * (1 - discount / 100) * 10000) / 10000;
      const taxRate = l.taxRate ?? 0;
      const taxAmount = l.taxAmount !== undefined
        ? l.taxAmount
        : Math.round(lineTotal * (taxRate / 100) * 10000) / 10000;

      subtotal += lineTotal;
      totalTax += taxAmount;

      return {
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: new Prisma.Decimal(l.unitPrice),
        discountPct: discount,
        lineTotal: new Prisma.Decimal(lineTotal),
        taxRate,
        taxAmount: new Prisma.Decimal(taxAmount),
      };
    });

    subtotal = Math.round(subtotal * 10000) / 10000;
    totalTax = Math.round(totalTax * 10000) / 10000;
    const totalAmount = Math.round((subtotal + totalTax) * 10000) / 10000;

    return this.prisma.invoice.create({
      data: {
        companyId: data.companyId ?? 'default',
        orderId: data.orderId,
        customerId: data.customerId,
        type: data.type,
        status: data.status ?? InvoiceStatus.DRAFT,
        currency: data.currency ?? 'USD',
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(totalTax),
        totalAmount: new Prisma.Decimal(totalAmount),
        dueDate: data.dueDate ?? null,
        notes: data.notes ?? null,
        idempotencyKey: data.idempotencyKey ?? null,
        lines: {
          create: formattedLines,
        },
      },
      include: {
        lines: true,
        payments: true,
      },
    });
  }

  async updateStatus(
    id: string,
    status: InvoiceStatus,
    extra: { paidAt?: Date | null; voidedAt?: Date | null } = {},
  ) {
    return this.prisma.invoice.update({
      where: { id },
      data: {
        status,
        ...(extra.paidAt !== undefined && { paidAt: extra.paidAt }),
        ...(extra.voidedAt !== undefined && { voidedAt: extra.voidedAt }),
      },
      include: {
        lines: true,
        payments: true,
      },
    });
  }
}
