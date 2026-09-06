import { useQuery, useMutation } from '@tanstack/react-query';
import { analyticsApi } from '../analytics.api';
import { catalogApi } from '../catalog.api';
import { billingApi } from '../billing.api';
import { useAuthStore } from '../../stores/auth.store';

export function useQuotationReport(params?: {
  from?: string;
  to?: string;
  repId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery({
    queryKey: ['report-quotations', params, token],
    queryFn: async () => {
      try {
        return await analyticsApi.getQuotationReport(params, token);
      } catch {
        return { quotations: [], total: 0, page: 1, pageSize: 20 };
      }
    },
    staleTime: 15_000,
  });
}

export function useCatalogProducts() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery({
    queryKey: ['report-catalog-products', token],
    queryFn: async () => {
      try {
        const res = await catalogApi.getProducts(token, { pageSize: 100 });
        return res.data || [];
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
}

export function useCatalogCategories() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery({
    queryKey: ['report-catalog-categories', token],
    queryFn: async () => {
      try {
        return await catalogApi.getCategories(token);
      } catch {
        return [];
      }
    },
    staleTime: 60_000,
  });
}

export function useTopRepsData() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery({
    queryKey: ['report-top-reps', token],
    queryFn: async () => {
      try {
        return await analyticsApi.getTopReps(token);
      } catch {
        return [];
      }
    },
    staleTime: 15_000,
  });
}

export function useReportSubscriptions() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery({
    queryKey: ['report-subscriptions', token],
    queryFn: async () => {
      try {
        const res = await billingApi.listSubscriptions(undefined, token);
        return res.subscriptions || [];
      } catch {
        return [];
      }
    },
    staleTime: 15_000,
  });
}

export function useExportReportMutation() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useMutation({
    mutationFn: async (payload: { reportType: string; format: 'PDF' | 'XLS'; filters?: any }) => {
      return await analyticsApi.exportReport(payload, token);
    },
  });
}
