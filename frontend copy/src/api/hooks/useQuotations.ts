import { useQuery } from '@tanstack/react-query';
import { quotationApi } from '../quotation.api';
import { Quotation, QuotationFilters } from '../../types/quotation.types';
import { useAuthStore } from '../../stores/auth.store';

export function useQuotations(filters?: QuotationFilters) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<{ data: Quotation[]; total: number; isLive: boolean }, Error>({
    queryKey: ['quotations', filters, token],
    queryFn: async () => {
      try {
        const res = await quotationApi.getQuotations(token, filters);
        return { data: res.data || [], total: res.total || 0, isLive: true };
      } catch {
        // When quotation service is offline/incomplete, return empty real data rather than mocking
        return { data: [], total: 0, isLive: false };
      }
    },
    retry: false,
    staleTime: 15_000,
  });
}

export function useQuotation(id: string) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<Quotation | null, Error>({
    queryKey: ['quotation', id, token],
    queryFn: async () => {
      try {
        const res = await quotationApi.getQuotationById(id, token);
        return res;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 15_000,
  });
}

export function useCreateQuotation() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return {
    mutateAsync: async (customerId?: string): Promise<Quotation> => {
      if (!token) throw new Error('Authentication required');
      const targetCustomerId = customerId || 'cust-000000-0000-0000-0000-000000000001';
      return await quotationApi.createQuotation(targetCustomerId, token);
    },
    isPending: false,
  };
}
