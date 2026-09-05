import { PrismaClient, BackorderRecord } from '@prisma/client';

export class BackorderRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: {
    companyId: string;
    fulfillmentSplitId: string;
    orderId: string;
    productId: string;
    variantId?: string | null;
    quantityNeeded: number;
    warehouseId: string;
  }): Promise<BackorderRecord> {
    return this.db.backorderRecord.create({ data: { ...input, variantId: input.variantId ?? null } });
  }

  async findOpenByProduct(companyId: string, productId: string): Promise<BackorderRecord[]> {
    return this.db.backorderRecord.findMany({
      where: { companyId, productId, resolvedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findByOrderId(orderId: string): Promise<BackorderRecord[]> {
    return this.db.backorderRecord.findMany({
      where: { orderId, resolvedAt: null },
    });
  }

  async resolve(id: string): Promise<BackorderRecord> {
    return this.db.backorderRecord.update({
      where: { id },
      data: { resolvedAt: new Date() },
    });
  }

  async resolveMany(ids: string[]): Promise<void> {
    await this.db.backorderRecord.updateMany({
      where: { id: { in: ids } },
      data: { resolvedAt: new Date() },
    });
  }
}
