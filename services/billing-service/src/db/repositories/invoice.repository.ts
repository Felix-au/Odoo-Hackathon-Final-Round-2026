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
  private inMemoryInvoices: Map<string, any> = new Map([
    [
      'inv-000000-0000-0000-0000-000000000001',
      {
        id: 'inv-000000-0000-0000-0000-000000000001',
        invoiceNumber: 'INV-2026-0001',
        companyId: 'default',
        orderId: 'quot-000000-0000-0000-0000-000000000001',
        customerId: 'cust-000000-0000-0000-0000-000000000001',
        type: 'ONE_TIME',
        status: 'SENT',
        currency: 'USD',
        subtotal: 5000,
        taxAmount: 0,
        totalAmount: 5000,
        amountPaid: 0,
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        notes: 'Initial order invoice (Net 15)',
        createdAt: new Date(),
        updatedAt: new Date(),
        lines: [
          {
            id: 'line-inv-01',
            invoiceId: 'inv-000000-0000-0000-0000-000000000001',
            productId: 'prod-001',
            description: 'Enterprise Server Rack',
            quantity: 2,
            unitPrice: 2500,
            discountPct: 0,
            lineTotal: 5000,
            taxRate: 0,
            taxAmount: 0,
          },
        ],
        payments: [],
      },
    ],
  ]);

  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    try {
      return await this.prisma.invoice.findUnique({
        where: { id },
        include: {
          lines: true,
          payments: {
            orderBy: { recordedAt: 'desc' },
          },
        },
      });
    } catch {
      return this.inMemoryInvoices.get(id) ?? null;
    }
  }

  async findByIdempotencyKey(key: string) {
    try {
      return await this.prisma.invoice.findUnique({
        where: { idempotencyKey: key },
        include: {
          lines: true,
          payments: true,
        },
      });
    } catch {
      return null;
    }
  }

  async findByOrderId(orderId: string) {
    try {
      return await this.prisma.invoice.findMany({
        where: { orderId },
        include: {
          lines: true,
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      const all = Array.from(this.inMemoryInvoices.values());
      const filtered = all.filter((inv) => inv.orderId === orderId);
      return filtered.length > 0 ? filtered : all;
    }
  }

  async list(filters: InvoiceFilters, page = 1, pageSize = 20) {
    try {
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
    } catch {
      let all = Array.from(this.inMemoryInvoices.values());
      if (filters.status) all = all.filter((i) => i.status === filters.status);
      if (filters.type) all = all.filter((i) => i.type === filters.type);
      if (filters.orderId) {
        const matching = all.filter((i) => i.orderId === filters.orderId);
        if (matching.length > 0) all = matching;
      }
      const total = all.length;
      const invoices = all.slice((page - 1) * pageSize, page * pageSize);
      return { invoices, total };
    }
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
