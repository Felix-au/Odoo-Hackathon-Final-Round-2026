import { PrismaClient, CustomerNegotiation, NegotiationStatus } from '@prisma/client';

export interface CreateNegotiationInput {
  quotationId: string;
  customerId: string;
  message?: string | null;
  proposedDiscount?: number | null;
  lineComments?: Record<string, string> | null;
}

export class NegotiationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateNegotiationInput): Promise<CustomerNegotiation> {
    return this.prisma.customerNegotiation.create({
      data: {
        quotationId: data.quotationId,
        customerId: data.customerId,
        message: data.message ?? null,
        proposedDiscount: data.proposedDiscount ?? null,
        lineComments: data.lineComments ?? undefined,
        status: NegotiationStatus.PENDING,
      },
    });
  }

  async findByQuotationId(quotationId: string): Promise<CustomerNegotiation[]> {
    return this.prisma.customerNegotiation.findMany({
      where: { quotationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(id: string, status: NegotiationStatus): Promise<CustomerNegotiation> {
    return this.prisma.customerNegotiation.update({
      where: { id },
      data: {
        status,
        resolvedAt: new Date(),
      },
    });
  }
}
