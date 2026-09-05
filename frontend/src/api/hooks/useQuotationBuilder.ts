import { useQuery, useMutation } from '@tanstack/react-query';
import { quotationApi } from '../quotation.api';
import { Quotation } from '../../types/quotation.types';
import { UpsellSuggestion, Product } from '../../types/catalog.types';
import { useAuthStore } from '../../stores/auth.store';

export function useQuotation(id: string) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<Quotation | null>({
    queryKey: ['quotation', id, token],
    queryFn: async () => {
      try {
        return await quotationApi.getQuotationById(id, token);
      } catch {
        return null;
      }
    },
    staleTime: 15_000,
    retry: false,
  });
}

export function useQuotationBuilder(_id: string) {
  const addLineMutation = useMutation({
    mutationFn: async (_product: Product) => {
      throw new Error('Quotation service is currently in development.');
    },
  });

  const updateLineMutation = useMutation({
    mutationFn: async (_params: { lineId: string; quantity?: number; discountPct?: number }) => {
      throw new Error('Quotation service is currently in development.');
    },
  });

  const removeLineMutation = useMutation({
    mutationFn: async (_lineId: string) => {
      throw new Error('Quotation service is currently in development.');
    },
  });

  const submitQuotationMutation = useMutation({
    mutationFn: async () => {
      throw new Error('Quotation service is currently in development.');
    },
  });

  const sendToCustomerMutation = useMutation({
    mutationFn: async () => {
      throw new Error('Quotation service is currently in development.');
    },
  });

  return {
    addLine: addLineMutation.mutateAsync,
    updateLine: updateLineMutation.mutateAsync,
    removeLine: removeLineMutation.mutateAsync,
    submitQuotation: submitQuotationMutation.mutateAsync,
    sendToCustomer: sendToCustomerMutation.mutateAsync,
    isUpdating:
      addLineMutation.isPending ||
      updateLineMutation.isPending ||
      removeLineMutation.isPending ||
      submitQuotationMutation.isPending ||
      sendToCustomerMutation.isPending,
  };
}

export function useUpsellSuggestions(_quotationId: string) {
  return useQuery<UpsellSuggestion[]>({
    queryKey: ['upsell-suggestions'],
    queryFn: async () => [],
    staleTime: 60_000,
  });
}
