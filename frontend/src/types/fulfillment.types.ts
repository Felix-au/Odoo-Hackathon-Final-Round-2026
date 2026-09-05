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
