import { FulfillmentStatus } from '@prisma/client';
import { FulfillmentOrderRepository, FulfillmentOrderWithSplits } from '../../db/repositories/fulfillment-order.repository';
import { WarehouseStockRepository } from '../../db/repositories/warehouse-stock.repository';
import { BackorderRepository } from '../../db/repositories/backorder.repository';
import {
  computeOptimalSplit,
  productKey,
  SplitRequest,
  SplitRecommendation,
  WarehouseStockView,
} from './split-algorithm.service';
import { EventPublisher } from '../../events/publisher';
import { prisma } from '../../db/prisma-client';

export interface OrderLine {
  productId: string;
  variantId?: string | null;
  productName: string;
  quantityNeeded: number;
}

export interface AcceptSplitInput {
  orderId: string;
  companyId: string;
  customerId: string;
  currency?: string;
  isOverride: boolean;
  splits: Array<{
    warehouseId: string;
    warehouseName: string;
    productId: string;
    variantId?: string | null;
    productName: string;
    quantity: number;
  }>;
}

// Default shipping cost weight when not provided by Catalog (hackathon simplification)
const DEFAULT_SHIPPING_COST_WEIGHT = 1.0;

export class FulfillmentOrderService {
  constructor(
    private readonly orderRepo: FulfillmentOrderRepository,
    private readonly stockRepo: WarehouseStockRepository,
    private readonly backorderRepo: BackorderRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async getSplitRecommendation(
    companyId: string,
    orderId: string,
    lines: OrderLine[],
  ): Promise<SplitRecommendation> {
    // Build stock map for algorithm
    const stockByProduct = new Map<string, WarehouseStockView[]>();
    for (const line of lines) {
      const pk = productKey(line.productId, line.variantId);
      const stocks = await this.stockRepo.findByProduct(companyId, line.productId, line.variantId);
      stockByProduct.set(
        pk,
        stocks.map((s) => ({
          warehouseId: s.warehouseId,
          warehouseName: s.warehouseName,
          shippingCostWeight: DEFAULT_SHIPPING_COST_WEIGHT,
          availableQty: Math.max(0, s.quantityOnHand - s.quantityReserved),
        })),
      );
    }

    const request: SplitRequest = { orderId, companyId, lines };
    return computeOptimalSplit(request, stockByProduct);
  }

  async acceptSplit(input: AcceptSplitInput): Promise<FulfillmentOrderWithSplits> {
    const existingOrder = await this.orderRepo.findByOrderId(input.orderId);
    if (existingOrder) {
      if (input.isOverride) {
        return this.manualOverride(existingOrder.id, input.companyId, input.splits);
      }
      return existingOrder;
    }

    return prisma.$transaction(async (tx) => {
      // Build split records and reserve stock
      const splitRecords = input.splits.map((s) => {
        const isBackorder = s.quantity === 0;
        return {
          warehouseId: s.warehouseId,
          warehouseName: s.warehouseName,
          productId: s.productId,
          variantId: s.variantId ?? null,
          productName: s.productName,
          quantityRequested: s.quantity,
          quantityFulfilled: 0,
          quantityBackordered: 0,
          status: isBackorder ? FulfillmentStatus.BACKORDERED : FulfillmentStatus.RESERVED,
        };
      });

      const order = await this.orderRepo.create(tx, {
        companyId: input.companyId,
        orderId: input.orderId,
        customerId: input.customerId,
        currency: input.currency,
        isOverride: input.isOverride,
        splits: splitRecords,
      });

      // Reserve stock for non-backorder splits
      for (const s of input.splits) {
        if (s.quantity > 0 && s.warehouseId !== 'BACKORDER') {
          await this.stockRepo.incrementReserved(
            tx,
            input.companyId,
            s.warehouseId,
            s.productId,
            s.variantId ?? null,
            s.quantity,
          );
        }
      }

      // Create backorder records for zero-qty splits
      for (const split of order.splits) {
        if (split.status === FulfillmentStatus.BACKORDERED && split.quantityRequested > 0) {
          await this.backorderRepo.create({
            companyId: input.companyId,
            fulfillmentSplitId: split.id,
            orderId: input.orderId,
            productId: split.productId,
            variantId: split.variantId,
            quantityNeeded: split.quantityRequested,
            warehouseId: split.warehouseId === 'BACKORDER' ? '' : split.warehouseId,
          });
        }
      }

      return order;
    });
  }

  async manualOverride(
    fulfillmentOrderId: string,
    companyId: string,
    splits: AcceptSplitInput['splits'],
  ): Promise<FulfillmentOrderWithSplits> {
    const existing = await this.orderRepo.findById(fulfillmentOrderId);
    if (!existing) throw new Error(`FulfillmentOrder ${fulfillmentOrderId} not found`);

    return prisma.$transaction(async (tx) => {
      // Release previously reserved stock
      for (const oldSplit of existing.splits) {
        if (oldSplit.status === FulfillmentStatus.RESERVED && oldSplit.quantityRequested > 0) {
          await this.stockRepo.releaseReserved(
            companyId,
            oldSplit.warehouseId,
            oldSplit.productId,
            oldSplit.variantId,
            oldSplit.quantityRequested,
          );
        }
      }

      const newSplitRecords = splits.map((s) => ({
        warehouseId: s.warehouseId,
        warehouseName: s.warehouseName,
        productId: s.productId,
        variantId: s.variantId ?? null,
        productName: s.productName,
        quantityRequested: s.quantity,
        quantityFulfilled: 0,
        quantityBackordered: 0,
        status: FulfillmentStatus.RESERVED as FulfillmentStatus,
      }));

      const updated = await this.orderRepo.updateOverride(tx, fulfillmentOrderId, newSplitRecords);

      // Reserve new stock
      for (const s of splits) {
        if (s.quantity > 0 && s.warehouseId !== 'BACKORDER') {
          await this.stockRepo.incrementReserved(
            tx,
            companyId,
            s.warehouseId,
            s.productId,
            s.variantId ?? null,
            s.quantity,
          );
        }
      }

      return updated;
    });
  }

  async getOrderStatus(orderId: string): Promise<FulfillmentOrderWithSplits | null> {
    return this.orderRepo.findByOrderId(orderId);
  }

  async listOrders(companyId = 'default'): Promise<FulfillmentOrderWithSplits[]> {
    return this.orderRepo.list(companyId);
  }

  async consolidateBackorder(
    fulfillmentOrderId: string,
    companyId: string,
  ): Promise<{ resolved: number }> {
    const order = await this.orderRepo.findById(fulfillmentOrderId);
    if (!order) throw new Error(`FulfillmentOrder ${fulfillmentOrderId} not found`);

    const openBackorders = await this.backorderRepo.findByOrderId(order.orderId);
    const ids = openBackorders.map((b) => b.id);
    if (ids.length > 0) {
      await this.backorderRepo.resolveMany(ids);
    }

    return { resolved: ids.length };
  }
}
