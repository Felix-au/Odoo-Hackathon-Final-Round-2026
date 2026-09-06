import { PrismaClient, FulfillmentOrder, FulfillmentSplit, FulfillmentStatus, Prisma } from '@prisma/client';

export interface CreateFulfillmentOrderInput {
  companyId: string;
  orderId: string;
  customerId: string;
  currency?: string;
  isOverride: boolean;
  splits: Array<{
    warehouseId: string;
    warehouseName: string;
    productId: string;
    variantId?: string | null;
    productName: string;
    quantityRequested: number;
    quantityFulfilled: number;
    quantityBackordered: number;
    status: FulfillmentStatus;
  }>;
}

export type FulfillmentOrderWithSplits = FulfillmentOrder & {
  splits: FulfillmentSplit[];
};

export class FulfillmentOrderRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(
    tx: Prisma.TransactionClient,
    input: CreateFulfillmentOrderInput,
  ): Promise<FulfillmentOrderWithSplits> {
    return tx.fulfillmentOrder.create({
      data: {
        companyId: input.companyId,
        orderId: input.orderId,
        customerId: input.customerId,
        currency: input.currency ?? 'USD',
        isOverride: input.isOverride,
        splits: {
          create: input.splits.map((s) => ({
            warehouseId: s.warehouseId,
            warehouseName: s.warehouseName,
            productId: s.productId,
            variantId: s.variantId ?? null,
            productName: s.productName,
            quantityRequested: s.quantityRequested,
            quantityFulfilled: s.quantityFulfilled,
            quantityBackordered: s.quantityBackordered,
            status: s.status,
          })),
        },
      },
      include: { splits: true },
    });
  }

  async findByOrderId(orderId: string): Promise<FulfillmentOrderWithSplits | null> {
    return this.db.fulfillmentOrder.findFirst({
      where: { orderId },
      include: { splits: true },
    });
  }

  async findById(id: string): Promise<FulfillmentOrderWithSplits | null> {
    return this.db.fulfillmentOrder.findUnique({
      where: { id },
      include: { splits: true },
    });
  }

  async list(companyId = 'default'): Promise<FulfillmentOrderWithSplits[]> {
    return this.db.fulfillmentOrder.findMany({
      where: { companyId },
      include: { splits: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOverride(
    tx: Prisma.TransactionClient,
    id: string,
    splits: Array<{
      warehouseId: string;
      warehouseName: string;
      productId: string;
      variantId?: string | null;
      productName: string;
      quantityRequested: number;
      quantityFulfilled: number;
      quantityBackordered: number;
      status: FulfillmentStatus;
    }>,
  ): Promise<FulfillmentOrderWithSplits> {
    // Delete old splits, insert new ones
    await tx.fulfillmentSplit.deleteMany({ where: { fulfillmentOrderId: id } });
    return tx.fulfillmentOrder.update({
      where: { id },
      data: {
        isOverride: true,
        splits: {
          create: splits.map((s) => ({
            warehouseId: s.warehouseId,
            warehouseName: s.warehouseName,
            productId: s.productId,
            variantId: s.variantId ?? null,
            productName: s.productName,
            quantityRequested: s.quantityRequested,
            quantityFulfilled: s.quantityFulfilled,
            quantityBackordered: s.quantityBackordered,
            status: s.status,
          })),
        },
      },
      include: { splits: true },
    });
  }
}
