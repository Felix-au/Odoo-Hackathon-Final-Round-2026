/**
 * Split Algorithm Service
 * Pure function — no DB calls, no side effects. Fully unit-testable.
 *
 * Goal: Minimize number of distinct warehouses used (= fewer shipments).
 * Tiebreaker: Prefer warehouses with lower shippingCostWeight.
 *
 * Algorithm:
 * 1. For each line item, collect warehouses that have available stock (onHand - reserved).
 * 2. Score warehouses by how many distinct product lines they can (at least partially) serve.
 * 3. Greedy: pick the highest-scoring warehouse first (ties broken by lowest cost weight).
 * 4. Assign as much quantity as possible from chosen warehouse; decrement working copy.
 * 5. Repeat until all lines satisfied or no more stock available.
 * 6. Remaining quantity becomes backorder.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SplitRequestLine {
  productId: string;
  variantId?: string | null;
  productName: string;
  quantityNeeded: number;
}

export interface SplitRequest {
  orderId: string;
  companyId: string;
  lines: SplitRequestLine[];
}

export interface WarehouseStockView {
  warehouseId: string;
  warehouseName: string;
  shippingCostWeight: number; // lower = cheaper
  availableQty: number;       // quantityOnHand - quantityReserved
}

export interface SplitResultLine {
  warehouseId: string;
  warehouseName: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  quantityFromHere: number;
  quantityBackordered: number;
  shippingCostWeight: number;
}

export interface SplitRecommendation {
  orderId: string;
  splits: SplitResultLine[];
  estimatedShipmentCount: number;       // distinct warehouses used
  estimatedTotalShippingCost: number;   // sum of (cost_weight × shipments_from_warehouse)
  hasBackorder: boolean;
  backorderedItems: Array<{ productId: string; variantId?: string | null; quantity: number }>;
}

// ─── Algorithm ────────────────────────────────────────────────────────────────

/**
 * @param request       The order lines to fulfill
 * @param stockByProduct  Map of `${productId}|${variantId ?? ''}` → array of warehouse stock views
 */
export function computeOptimalSplit(
  request: SplitRequest,
  stockByProduct: Map<string, WarehouseStockView[]>,
): SplitRecommendation {
  // Working copy — mutable available qty per warehouse per product
  const workingStock = new Map<string, Map<string, number>>();
  // key: productKey, inner key: warehouseId → available qty

  for (const [productKey, stocks] of stockByProduct) {
    const warehouseMap = new Map<string, number>();
    for (const s of stocks) {
      warehouseMap.set(s.warehouseId, Math.max(0, s.availableQty));
    }
    workingStock.set(productKey, warehouseMap);
  }

  // Working quantities still needed per line
  const remaining = new Map<string, number>(
    request.lines.map((l) => [productKey(l.productId, l.variantId), l.quantityNeeded]),
  );

  const splits: SplitResultLine[] = [];
  const usedWarehouseIds = new Set<string>();

  // All warehouse metadata (deduplicated)
  const allWarehouses = new Map<string, { warehouseName: string; shippingCostWeight: number }>();
  for (const stocks of stockByProduct.values()) {
    for (const s of stocks) {
      if (!allWarehouses.has(s.warehouseId)) {
        allWarehouses.set(s.warehouseId, {
          warehouseName: s.warehouseName,
          shippingCostWeight: s.shippingCostWeight,
        });
      }
    }
  }

  // Greedy loop — each iteration picks the best remaining warehouse
  let changed = true;
  while (changed) {
    changed = false;

    // Score warehouses by how many lines (with qty > 0 remaining) they can serve
    const scores = new Map<string, number>();
    for (const [warehouseId] of allWarehouses) {
      let score = 0;
      for (const [pk, remQty] of remaining) {
        if (remQty <= 0) continue;
        const whStock = workingStock.get(pk)?.get(warehouseId) ?? 0;
        if (whStock > 0) score++;
      }
      if (score > 0) scores.set(warehouseId, score);
    }

    if (scores.size === 0) break;

    // Pick warehouse with highest score; tiebreak by lowest shippingCostWeight
    let bestWarehouseId: string | null = null;
    let bestScore = -1;
    let bestCostWeight = Infinity;

    for (const [warehouseId, score] of scores) {
      const meta = allWarehouses.get(warehouseId)!;
      if (
        score > bestScore ||
        (score === bestScore && meta.shippingCostWeight < bestCostWeight)
      ) {
        bestWarehouseId = warehouseId;
        bestScore = score;
        bestCostWeight = meta.shippingCostWeight;
      }
    }

    if (!bestWarehouseId) break;

    const whMeta = allWarehouses.get(bestWarehouseId)!;

    // Assign quantities from this warehouse
    for (const line of request.lines) {
      const pk = productKey(line.productId, line.variantId);
      const remQty = remaining.get(pk) ?? 0;
      if (remQty <= 0) continue;

      const whMap = workingStock.get(pk);
      const available = whMap?.get(bestWarehouseId) ?? 0;
      if (available <= 0) continue;

      const toFulfill = Math.min(remQty, available);
      splits.push({
        warehouseId: bestWarehouseId,
        warehouseName: whMeta.warehouseName,
        productId: line.productId,
        variantId: line.variantId,
        productName: line.productName,
        quantityFromHere: toFulfill,
        quantityBackordered: 0,
        shippingCostWeight: whMeta.shippingCostWeight,
      });

      remaining.set(pk, remQty - toFulfill);
      whMap!.set(bestWarehouseId, available - toFulfill);
      usedWarehouseIds.add(bestWarehouseId);
      changed = true;
    }
  }

  // Any remaining qty becomes backorder
  const backorderedItems: SplitRecommendation['backorderedItems'] = [];
  for (const line of request.lines) {
    const pk = productKey(line.productId, line.variantId);
    const remQty = remaining.get(pk) ?? 0;
    if (remQty > 0) {
      splits.push({
        warehouseId: 'BACKORDER',
        warehouseName: 'Backorder',
        productId: line.productId,
        variantId: line.variantId,
        productName: line.productName,
        quantityFromHere: 0,
        quantityBackordered: remQty,
        shippingCostWeight: 0,
      });
      backorderedItems.push({ productId: line.productId, variantId: line.variantId, quantity: remQty });
    }
  }

  // Compute shipping cost = sum across used warehouses of costWeight (1 shipment per warehouse)
  let totalCost = 0;
  for (const wid of usedWarehouseIds) {
    totalCost += allWarehouses.get(wid)?.shippingCostWeight ?? 0;
  }

  return {
    orderId: request.orderId,
    splits,
    estimatedShipmentCount: usedWarehouseIds.size,
    estimatedTotalShippingCost: Math.round(totalCost * 100) / 100,
    hasBackorder: backorderedItems.length > 0,
    backorderedItems,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function productKey(productId: string, variantId?: string | null): string {
  return `${productId}|${variantId ?? ''}`;
}
