export interface SplitItem {
  productId: string;
  productName: string;
  quantity: number;
  availableStock: number;
  isBackorder?: boolean;
}

export interface WarehouseSplit {
  warehouseId: string;
  warehouseName: string;
  isPrimary: boolean;
  shippingCostWeight: number;
  items: SplitItem[];
  estimatedCost: number;
}

export interface SplitRecommendation {
  orderId: string;
  totalShipments: number;
  estimatedShippingCost: number;
  hasBackorder: boolean;
  backorderItems?: Array<{
    productId: string;
    productName: string;
    quantity: number;
    expectedRestockDate?: string;
  }>;
  splits: WarehouseSplit[];
}

export interface WarehouseStockItem {
  id: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  variantId?: string | null;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint?: number;
  reorderQty?: number;
  updatedAt: string;
}

export interface FulfillmentOrderRecord {
  id: string;
  orderId: string;
  companyId: string;
  customerId: string;
  currency: string;
  isOverride: boolean;
  createdAt: string;
  updatedAt: string;
  splits: Array<{
    id: string;
    warehouseId: string;
    warehouseName: string;
    productId: string;
    productName: string;
    quantityRequested: number;
    quantityFulfilled: number;
    quantityBackordered: number;
    status: string;
  }>;
}

