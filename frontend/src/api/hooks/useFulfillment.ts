import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fulfillmentApi } from '../fulfillment.api';
import { SplitRecommendation, WarehouseStockItem, FulfillmentOrderRecord } from '../../types/fulfillment.types';
import { useAuthStore } from '../../stores/auth.store';

export function useFulfillmentSplit(orderId: string, lines?: any[]) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<SplitRecommendation | null, Error>({
    queryKey: ['fulfillment-split', orderId, lines, token],
    queryFn: async () => {
      try {
        const res = await fulfillmentApi.getSplitRecommendation(orderId, token, lines);
        return res;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 15_000,
  });
}

export function useAcceptSplit(
  orderId: string,
  currentSplits?: SplitRecommendation | null,
  customerId?: string,
  currency?: string,
) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return {
    mutateAsync: async (isOverride: boolean = false) => {
      if (!token) throw new Error('Authentication required');
      if (!currentSplits?.splits?.length) {
        throw new Error('No items or warehouses available to allocate for this order.');
      }
      const splits = currentSplits.splits.flatMap((w) =>
        w.items.map((item) => ({
          warehouseId: w.warehouseId,
          warehouseName: w.warehouseName,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
        }))
      );

      return await fulfillmentApi.acceptSplit({
        orderId,
        companyId: 'default',
        customerId: customerId || 'cust-000000-0000-0000-0000-000000000001',
        currency: currency || 'USD',
        isOverride,
        splits,
      }, token);
    },
    isPending: false,
  };
}

export function useUpdateSplit(orderId: string) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return {
    mutateAsync: async (split: SplitRecommendation) => {
      if (!token) throw new Error('Authentication required');
      const splits = split.splits.flatMap(s => s.items.map(item => ({
        warehouseId: s.warehouseId,
        warehouseName: s.warehouseName,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
      })));
      return await fulfillmentApi.updateSplit(orderId, {
        companyId: 'default',
        splits,
      }, token);
    },
    isPending: false,
  };
}

export function useWarehouseStock(warehouseId?: string) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<WarehouseStockItem[], Error>({
    queryKey: ['warehouse-stock', warehouseId, token],
    queryFn: async () => {
      try {
        return await fulfillmentApi.getStock(warehouseId, token);
      } catch {
        return [];
      }
    },
    staleTime: 15_000,
  });
}

export function useSetStock() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useMutation({
    mutationFn: async (data: {
      warehouseId: string;
      warehouseName: string;
      productId: string;
      quantityOnHand: number;
      reorderPoint?: number;
      reorderQty?: number;
    }) => {
      return fulfillmentApi.setStock(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useMutation({
    mutationFn: async (data: {
      warehouseId: string;
      productId: string;
      delta: number;
    }) => {
      return fulfillmentApi.adjustStock(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse-stock'] });
    },
  });
}

export function useFulfillmentOrders() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<FulfillmentOrderRecord[], Error>({
    queryKey: ['fulfillment-orders', token],
    queryFn: async () => {
      try {
        return await fulfillmentApi.listOrders(token);
      } catch {
        return [];
      }
    },
    staleTime: 15_000,
  });
}

