import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationApi } from '../quotation.api';
import { Quotation } from '../../types/quotation.types';
import { UpsellSuggestion } from '../../types/catalog.types';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from 'sonner';

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

export function useUpsellSuggestions(quotationId: string) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<UpsellSuggestion[]>({
    queryKey: ['upsell-suggestions', quotationId, token],
    queryFn: () => quotationApi.getUpsellSuggestions(quotationId, token),
    staleTime: 20_000,
  });
}

export function useQuotationBuilder(id: string) {
  const token = useAuthStore((s) => s.accessToken) || undefined;
  const queryClient = useQueryClient();

  const addLineMutation = useMutation({
    mutationFn: async (productData: {
      productId: string;
      productName: string;
      categoryName?: string;
      quantity: number;
      unitPrice: number;
      costPrice?: number;
      discountPct?: number;
      isRecurring?: boolean;
      planInterval?: string;
    }) => {
      return quotationApi.addLine(id, productData, token);
    },
    onSuccess: () => {
      toast.success('Line item added to quotation');
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['upsell-suggestions', id] });
    },
    onError: () => {
      toast.error('Failed to add product line');
    },
  });

  const updateLineMutation = useMutation({
    mutationFn: async (params: { lineId: string; quantity?: number; discountPct?: number; unitPrice?: number }) => {
      return quotationApi.updateLine(id, params.lineId, params, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['upsell-suggestions', id] });
    },
    onError: () => {
      toast.error('Failed to update line');
    },
  });

  const removeLineMutation = useMutation({
    mutationFn: async (lineId: string) => {
      return quotationApi.removeLine(id, lineId, token);
    },
    onSuccess: () => {
      toast.success('Line removed');
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['upsell-suggestions', id] });
    },
    onError: () => {
      toast.error('Failed to remove line');
    },
  });

  const submitQuotationMutation = useMutation({
    mutationFn: async () => {
      return quotationApi.submitQuotation(id, token);
    },
    onSuccess: (data) => {
      toast.success('Quotation submitted for review/approval');
      queryClient.invalidateQueries({ queryKey: ['quotation', id] });
      return data;
    },
    onError: () => {
      toast.error('Submission failed');
    },
  });

  return {
    addLine: addLineMutation.mutateAsync,
    updateLine: updateLineMutation.mutateAsync,
    removeLine: removeLineMutation.mutateAsync,
    submitQuotation: submitQuotationMutation.mutateAsync,
    isUpdating:
      addLineMutation.isPending ||
      updateLineMutation.isPending ||
      removeLineMutation.isPending ||
      submitQuotationMutation.isPending,
  };
}
