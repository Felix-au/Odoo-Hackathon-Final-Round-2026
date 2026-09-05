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

  }
