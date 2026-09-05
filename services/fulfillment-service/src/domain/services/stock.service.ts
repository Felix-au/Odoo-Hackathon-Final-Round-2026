import { WarehouseStock } from '@prisma/client';
import { WarehouseStockRepository, UpsertStockInput, AdjustStockInput } from '../../db/repositories/warehouse-stock.repository';
import { BackorderRepository } from '../../db/repositories/backorder.repository';
import { EventPublisher } from '../../events/publisher';
import { prisma } from '../../db/prisma-client';

export interface StockArrivalInput {
  companyId: string;
  warehouseId: string;
  productId: string;
  variantId?: string | null;
  quantityArrived: number;
}

export class StockService {
  constructor(
    private readonly stockRepo: WarehouseStockRepository,
    private readonly backorderRepo: BackorderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async listStock(companyId: string, warehouseId?: string): Promise<WarehouseStock[]> {
    return this.stockRepo.findAll(companyId, warehouseId);
  }

  async setStock(input: UpsertStockInput): Promise<WarehouseStock> {
    return this.stockRepo.upsert(input);
  }

  async adjustStock(input: AdjustStockInput): Promise<WarehouseStock> {
    return this.stockRepo.adjust(input);
  }

  async recordArrival(input: StockArrivalInput): Promise<{
    stock: WarehouseStock;
    affectedOrderIds: string[];
  }> {
    // Increment stock
    const stock = await this.stockRepo.adjust({
      companyId: input.companyId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      variantId: input.variantId,
      delta: input.quantityArrived,
    });

    // Find open backorders for this product
    const openBackorders = await this.backorderRepo.findOpenByProduct(
      input.companyId,
      input.productId,
    );

    const affectedOrderIds = [...new Set(openBackorders.map((b) => b.orderId))];

    // Publish event (CHECK-FULL-004)
    await this.eventPublisher.publish('dealflow360:fulfillment', {
      eventType: 'fulfillment.stock_arrived',
      version: '1.0',
      companyId: input.companyId,
      payload: {
        warehouseId: input.warehouseId,
        productId: input.productId,
        variantId: input.variantId ?? null,
        quantityArrived: input.quantityArrived,
        affectedOrderIds,
      },
    });

    return { stock, affectedOrderIds };
  }
}
