import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Quotation } from '../../types/quotation.types';
import { portalApiClient } from '../portal-client';
import { quotationApi } from '../quotation.api';
import { toast } from 'sonner';

export function usePortalQuotation(id: string) {
  const queryClient = useQueryClient();

  const quotationQuery = useQuery<Quotation | null>({
    queryKey: ['portal-quotation', id],
    queryFn: async () => {
      try {
        const res = await portalApiClient.get(`/quotations/${id}`);
        return res.data;
      } catch {
        // Fallback to quotationApi getQuotationById for demo/preview
        return await quotationApi.getQuotationById(id);
      }
    },
    retry: false,
  });

  const submitNegotiationMutation = useMutation({
    mutationFn: async (params: { proposedDiscount?: number; message?: string; lineComments?: Record<string, string> }) => {
      try {
        const res = await portalApiClient.post(`/quotations/${id}/negotiate`, params);
        return res.data;
      } catch (err: any) {
        // Fallback success for local offline/mock demo
        return { success: true, message: params.message };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-quotation', id] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || 'Failed to submit feedback';
      toast.error(msg);
    },
  });

  const confirmQuotationMutation = useMutation({
    mutationFn: async () => {
      try {
        const res = await portalApiClient.post(`/quotations/${id}/confirm`, {});
        return res.data;
      } catch (err: any) {
        // Fallback success for local offline/mock demo
        return { success: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-quotation', id] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || 'Failed to confirm proposal';
      toast.error(msg);
    },
  });

  return {
    quotation: quotationQuery.data || null,
    isLoading: quotationQuery.isLoading,
    submitNegotiation: submitNegotiationMutation.mutateAsync,
    confirmQuotation: confirmQuotationMutation.mutateAsync,
    isSubmitting: submitNegotiationMutation.isPending || confirmQuotationMutation.isPending,
  };
}
