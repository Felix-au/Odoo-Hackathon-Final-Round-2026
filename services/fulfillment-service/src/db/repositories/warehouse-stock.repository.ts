import { PrismaClient, WarehouseStock, Prisma } from '@prisma/client';

export interface UpsertStockInput {
  companyId: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  variantId?: string | null;
  quantityOnHand: number;
  reorderPoint?: number;
  reorderQty?: number;
}

export interface AdjustStockInput {
  companyId: string;
  warehouseId: string;
  productId: string;
  variantId?: string | null;
  delta: number; // positive = add, negative = subtract
}

export class WarehouseStockRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(companyId: string, warehouseId?: string): Promise<WarehouseStock[]> {
    return this.db.warehouseStock.findMany({
      where: { companyId, ...(warehouseId ? { warehouseId } : {}) },
      orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }],
    });
  }

  async findByProduct(
    companyId: string,
    productId: string,
    variantId?: string | null,
  ): Promise<WarehouseStock[]> {
    return this.db.warehouseStock.findMany({
      where: { companyId, productId, variantId: variantId ?? null },
      orderBy: { warehouseId: 'asc' },
    });
  }

  async upsert(input: UpsertStockInput): Promise<WarehouseStock> {
    const key = {
      companyId_warehouseId_productId_variantId: {
        companyId: input.companyId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        variantId: input.variantId ?? null,
      },
    };
    return this.db.warehouseStock.upsert({
      where: key,
      create: {
        companyId: input.companyId,
        warehouseId: input.warehouseId,
        warehouseName: input.warehouseName,
        productId: input.productId,
        variantId: input.variantId ?? null,
        quantityOnHand: input.quantityOnHand,
        reorderPoint: input.reorderPoint ?? 10,
        reorderQty: input.reorderQty ?? 50,
      },
      update: {
        warehouseName: input.warehouseName,
        quantityOnHand: input.quantityOnHand,
        ...(input.reorderPoint !== undefined ? { reorderPoint: input.reorderPoint } : {}),
        ...(input.reorderQty !== undefined ? { reorderQty: input.reorderQty } : {}),
      },
    });
  }

  async adjust(input: AdjustStockInput): Promise<WarehouseStock> {
    const existing = await this.db.warehouseStock.findUnique({
      where: {
        companyId_warehouseId_productId_variantId: {
          companyId: input.companyId,
          warehouseId: input.warehouseId,
          productId: input.productId,
          variantId: input.variantId ?? null,
        },
      },
    });
    if (!existing) throw new Error(`Stock record not found for product ${input.productId} in warehouse ${input.warehouseId}`);

    return this.db.warehouseStock.update({
      where: { id: existing.id },
      data: {
        quantityOnHand: { increment: input.delta },
      },
    });
  }

  async incrementReserved(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<void> {
    await tx.warehouseStock.updateMany({
      where: { companyId, warehouseId, productId, variantId },
      data: { quantityReserved: { increment: quantity } },
    });
  }

  async releaseReserved(
    companyId: string,
    warehouseId: string,
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<void> {
    await this.db.warehouseStock.updateMany({
      where: { companyId, warehouseId, productId, variantId },
      data: { quantityReserved: { decrement: quantity } },
    });
  }
}
}
