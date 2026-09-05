export interface CatalogProduct {
  id: string;
  name: string;
  basePrice: number;
  costPrice?: number;
  categoryId: string;
  category?: {
    id: string;
    name: string;
  };
  variants?: Array<{
    id: string;
    sku: string;
    name: string;
    priceModifier: number;
  }>;
}

export interface CeilingsResponse {
  tierCeilings: Record<string, number>;
  categoryCeilings: Record<string, number>;
}

export interface ApprovalChainResolution {
  riskScore: number;
  requiredRoles: ('SALES_MANAGER' | 'FINANCE')[];
}

export interface UpsellSuggestion {
  id?: string;
  suggestedProductId: string;
  suggestedProduct: {
    id: string;
    name: string;
    basePrice: number | string;
    description?: string;
  };
  marginDeltaIfAdded?: string;
  isPromoted?: boolean;
  promotionTag?: string;
}

export class CatalogClient {
  constructor(
    private readonly baseUrl: string,
    private readonly serviceToken: string,
  ) {}

  private getHeaders(token?: string) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || this.serviceToken}`,
      'x-service-token': this.serviceToken,
    };
  }

  async getProduct(productId: string, authToken?: string): Promise<CatalogProduct | null> {
    try {
      const res = await fetch(`${this.baseUrl}/catalog/products/${productId}`, {
        headers: this.getHeaders(authToken),
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Catalog service error: ${res.status} ${res.statusText}`);
      }
      return (await res.json()) as CatalogProduct;
    } catch {
      // Fallback for isolated testing/offline mode
      return null;
    }
  }

  async getDiscountCeilings(companyId = 'default', authToken?: string): Promise<CeilingsResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/catalog/discount-tiers/ceilings`, {
        headers: this.getHeaders(authToken),
      });
      if (res.ok) {
        return (await res.json()) as CeilingsResponse;
      }
    } catch {
      // fallback
    }

    // Default business rules ceilings
    return {
      tierCeilings: {
        BRONZE: 5,
        SILVER: 10,
        GOLD: 15,
      },
      categoryCeilings: {},
    };
  }

  async resolveApprovalChain(riskScore: number, authToken?: string): Promise<ApprovalChainResolution> {
    try {
      const res = await fetch(`${this.baseUrl}/catalog/approval-chains/resolve?riskScore=${riskScore}`, {
        headers: this.getHeaders(authToken),
      });
      if (res.ok) {
        const data = (await res.json()) as { requiredRoles: ('SALES_MANAGER' | 'FINANCE')[] };
        return {
          riskScore,
          requiredRoles: data.requiredRoles ?? [],
        };
      }
    } catch {
      // fallback
    }

    // Standard business rule resolution:
    // score = 0 -> none
    // 0 < score <= 30 -> SALES_MANAGER
    // score > 30 -> SALES_MANAGER + FINANCE
    let requiredRoles: ('SALES_MANAGER' | 'FINANCE')[] = [];
    if (riskScore > 30) {
      requiredRoles = ['SALES_MANAGER', 'FINANCE'];
    } else if (riskScore > 0) {
      requiredRoles = ['SALES_MANAGER'];
    }

    return {
      riskScore,
      requiredRoles,
    };
  }

  async getUpsellSuggestions(
    productIds: string[],
    currentMarginPct?: number,
    authToken?: string,
  ): Promise<UpsellSuggestion[]> {
    if (!productIds || productIds.length === 0) return [];
    try {
      const query = new URLSearchParams({
        productIds: productIds.join(','),
        ...(currentMarginPct !== undefined ? { marginPct: String(currentMarginPct) } : {}),
      });

      const res = await fetch(`${this.baseUrl}/catalog/upsell-rules/suggestions?${query.toString()}`, {
        headers: this.getHeaders(authToken),
      });
      if (res.ok) {
        const json = (await res.json()) as { data: UpsellSuggestion[] };
        return json.data || [];
      }
    } catch {
      // fallback
    }

    return [];
  }
}
