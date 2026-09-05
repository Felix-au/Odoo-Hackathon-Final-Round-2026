export interface ProductCategory {
  id: string;
  name: string;
  discountCeilingPct: number;
  companyId?: string;
}

export interface ProductVariant {
  id: string;
  attribute: string;
  value: string;
  extraPrice: string | number;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  category?: ProductCategory;
  basePrice: string | number;
  costPrice: string | number;
  unit: string;
  taxRate: number;
  description?: string;
  isActive?: boolean;
  variants?: ProductVariant[];
}

export interface TierCeilings {
  tierCeilings: Record<string, number>;
  categoryCeilings: Record<string, number>;
  cachedAt?: string;
  ttlSeconds?: number;
}

export interface ApprovalChainResolved {
  riskScore: number;
  requiresApproval: boolean;
  requiredRoles: string[];
  chainId?: string;
  chainName?: string;
}

export interface UpsellSuggestion {
  suggestedProductId: string;
  suggestedProduct: {
    id: string;
    name: string;
    basePrice: string | number;
    categoryName?: string;
  };
  estimatedMarginPct: number;
  isPromoted: boolean;
  promotionTag: string;
  priority: number;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  shippingCostWeight: number;
  isPrimary?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  billingInterval: 'MONTHLY' | 'ANNUAL';
  price: string | number;
  productId: string;
}
