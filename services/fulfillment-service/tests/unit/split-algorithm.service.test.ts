import { describe, it, expect } from 'vitest';
import {
  computeOptimalSplit,
  productKey,
  SplitRequest,
  WarehouseStockView,
} from '../../src/domain/services/split-algorithm.service';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const WH_A = 'wh-aaaa-0000-0000-0000-000000000001';
const WH_B = 'wh-bbbb-0000-0000-0000-000000000002';
const WH_C = 'wh-cccc-0000-0000-0000-000000000003';
const PROD_1 = 'prod-1111-0000-0000-0000-000000000001';
const PROD_2 = 'prod-2222-0000-0000-0000-000000000002';
const ORDER_ID = 'ord-0000-0000-0000-0000-000000000001';

function makeStockMap(entries: Array<{
  productId: string;
  variantId?: string | null;
  warehouseId: string;
  warehouseName: string;
  shippingCostWeight: number;
  availableQty: number;
}>): Map<string, WarehouseStockView[]> {
  const map = new Map<string, WarehouseStockView[]>();
  for (const e of entries) {
    const pk = productKey(e.productId, e.variantId);
    if (!map.has(pk)) map.set(pk, []);
    map.get(pk)!.push({
      warehouseId: e.warehouseId,
      warehouseName: e.warehouseName,
      shippingCostWeight: e.shippingCostWeight,
      availableQty: e.availableQty,
    });
  }
  return map;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SplitAlgorithmService.computeOptimalSplit', () => {

  // CHECK-FULL-001: 2 warehouses, product has 3 in A + 5 in B, order needs 5
  it('CHECK-FULL-001: splits across 2 warehouses when single warehouse cannot fulfill', () => {
    const request: SplitRequest = {
      orderId: ORDER_ID,
      companyId: 'default',
      lines: [{ productId: PROD_1, productName: 'Laptop Pro', quantityNeeded: 5 }],
    };

    const stock = makeStockMap([
      { productId: PROD_1, warehouseId: WH_A, warehouseName: 'Main Warehouse', shippingCostWeight: 1.0, availableQty: 3 },
      { productId: PROD_1, warehouseId: WH_B, warehouseName: 'East Depot', shippingCostWeight: 1.3, availableQty: 5 },
    ]);

    const result = computeOptimalSplit(request, stock);

    // Should fulfill from both warehouses
    expect(result.estimatedShipmentCount).toBe(2);
    expect(result.hasBackorder).toBe(false);
    expect(result.backorderedItems).toHaveLength(0);

    const totalFulfilled = result.splits
      .filter((s) => s.warehouseId !== 'BACKORDER')
      .reduce((sum, s) => sum + s.quantityFromHere, 0);
    expect(totalFulfilled).toBe(5);
  });

  // CHECK-FULL-005: single warehouse can cover all — must NOT use extra warehouses
  it('CHECK-FULL-005: uses single warehouse when it can fulfill all (minimize shipments)', () => {
    const request: SplitRequest = {
      orderId: ORDER_ID,
      companyId: 'default',
      lines: [{ productId: PROD_1, productName: 'Laptop Pro', quantityNeeded: 3 }],
    };

    // WH_A has enough; WH_B and WH_C also have stock but should NOT be used
    const stock = makeStockMap([
      { productId: PROD_1, warehouseId: WH_A, warehouseName: 'Main', shippingCostWeight: 1.0, availableQty: 10 },
      { productId: PROD_1, warehouseId: WH_B, warehouseName: 'East', shippingCostWeight: 1.3, availableQty: 5 },
      { productId: PROD_1, warehouseId: WH_C, warehouseName: 'West', shippingCostWeight: 2.0, availableQty: 5 },
    ]);

    const result = computeOptimalSplit(request, stock);

    expect(result.estimatedShipmentCount).toBe(1);
    expect(result.hasBackorder).toBe(false);

    const splits = result.splits.filter((s) => s.quantityFromHere > 0);
    expect(splits).toHaveLength(1);
    expect(splits[0].warehouseId).toBe(WH_A); // lowest cost tiebreaker
    expect(splits[0].quantityFromHere).toBe(3);
  });

  it('cost-weight tiebreaker: prefers lower-cost warehouse when coverage is equal', () => {
    const request: SplitRequest = {
      orderId: ORDER_ID,
      companyId: 'default',
      lines: [{ productId: PROD_1, productName: 'Widget', quantityNeeded: 2 }],
    };

    const stock = makeStockMap([
      { productId: PROD_1, warehouseId: WH_B, warehouseName: 'Expensive', shippingCostWeight: 2.5, availableQty: 10 },
      { productId: PROD_1, warehouseId: WH_A, warehouseName: 'Cheap', shippingCostWeight: 0.8, availableQty: 10 },
    ]);

    const result = computeOptimalSplit(request, stock);

    expect(result.estimatedShipmentCount).toBe(1);
    const usedWarehouse = result.splits.find((s) => s.quantityFromHere > 0);
    expect(usedWarehouse?.warehouseId).toBe(WH_A); // cheaper wins
  });

  it('full backorder when no stock available', () => {
    const request: SplitRequest = {
      orderId: ORDER_ID,
      companyId: 'default',
      lines: [{ productId: PROD_1, productName: 'Widget', quantityNeeded: 5 }],
    };

    const stock = makeStockMap([
      { productId: PROD_1, warehouseId: WH_A, warehouseName: 'Main', shippingCostWeight: 1.0, availableQty: 0 },
    ]);

    const result = computeOptimalSplit(request, stock);

    expect(result.estimatedShipmentCount).toBe(0);
    expect(result.hasBackorder).toBe(true);
    expect(result.backorderedItems[0]?.quantity).toBe(5);
  });

  it('partial fulfillment + backorder for remainder', () => {
    const request: SplitRequest = {
      orderId: ORDER_ID,
      companyId: 'default',
      lines: [{ productId: PROD_1, productName: 'Widget', quantityNeeded: 10 }],
    };

    const stock = makeStockMap([
      { productId: PROD_1, warehouseId: WH_A, warehouseName: 'Main', shippingCostWeight: 1.0, availableQty: 3 },
      { productId: PROD_1, warehouseId: WH_B, warehouseName: 'East', shippingCostWeight: 1.3, availableQty: 4 },
    ]);

    const result = computeOptimalSplit(request, stock);

    const fulfilled = result.splits
      .filter((s) => s.warehouseId !== 'BACKORDER')
      .reduce((sum, s) => sum + s.quantityFromHere, 0);

    expect(fulfilled).toBe(7);
    expect(result.hasBackorder).toBe(true);
    expect(result.backorderedItems[0]?.quantity).toBe(3);
  });

  it('multi-product: prefers warehouse covering most lines', () => {
    // WH_A has both products; WH_B only has PROD_2
    // Algorithm should pick WH_A first (score=2 vs score=1)
    const request: SplitRequest = {
      orderId: ORDER_ID,
      companyId: 'default',
      lines: [
        { productId: PROD_1, productName: 'Laptop', quantityNeeded: 2 },
        { productId: PROD_2, productName: 'Mouse', quantityNeeded: 3 },
      ],
    };

    const stock = makeStockMap([
      { productId: PROD_1, warehouseId: WH_A, warehouseName: 'Main', shippingCostWeight: 1.0, availableQty: 5 },
      { productId: PROD_2, warehouseId: WH_A, warehouseName: 'Main', shippingCostWeight: 1.0, availableQty: 5 },
      { productId: PROD_2, warehouseId: WH_B, warehouseName: 'East', shippingCostWeight: 1.3, availableQty: 5 },
    ]);

    const result = computeOptimalSplit(request, stock);

    // Should use only WH_A since it covers both lines
    expect(result.estimatedShipmentCount).toBe(1);
    expect(result.hasBackorder).toBe(false);
    const whIds = new Set(result.splits.filter((s) => s.quantityFromHere > 0).map((s) => s.warehouseId));
    expect(whIds.has(WH_A)).toBe(true);
    expect(whIds.has(WH_B)).toBe(false);
  });
});
