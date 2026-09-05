import { PrismaClient, Payment, Prisma } from '@prisma/client';

export interface RecordPaymentInput {
  companyId?: string;
  invoiceId: string;
  amount: number;
  currency?: string;
  method: string;
  reference?: string | null;
  recordedBy: string;
  idempotencyKey?: string | null;
}

export class PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({
      where: { id },
      include: { invoice: true },
    });
  }

  async findByIdempotencyKey(key: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({
      where: { idempotencyKey: key },
      include: { invoice: true },
    });
  }

  async findByInvoiceId(invoiceId: string): Promise<Payment[]> {
    return this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { recordedAt: 'desc' },
    });
  }

  async recordPayment(data: RecordPaymentInput): Promise<Payment> {
    if (data.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(data.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    return this.prisma.payment.create({
      data: {
        companyId: data.companyId ?? 'default',
        invoiceId: data.invoiceId,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency ?? 'USD',
        method: data.method,
        reference: data.reference ?? null,
        recordedBy: data.recordedBy,
        idempotencyKey: data.idempotencyKey ?? null,
      },
      include: {
        invoice: true,
      },
    });
  }
}
