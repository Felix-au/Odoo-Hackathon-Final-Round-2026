import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Quotation } from '../../types/quotation.types';
import { portalApiClient } from '../portal-client';
import { toast } from 'sonner';

export function usePortalQuotation(id: string) {
  const queryClient = useQueryClient();

  // Fetch the quotation via the portal session endpoint (requires portal cookie/token)
  const quotationQuery = useQuery<Quotation | null>({
    queryKey: ['portal-quotation', id],
    queryFn: async () => {
      const res = await portalApiClient.get(`/quotations/${id}`);
      return res.data;
    },
    retry: false,
  });

  const submitNegotiationMutation = useMutation({
    mutationFn: async (params: { proposedDiscount?: number; message?: string; lineComments?: Record<string, string> }) => {
      const res = await portalApiClient.post(`/quotations/${id}/negotiate`, params);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-quotation', id] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to submit feedback';
      toast.error(msg);
    },
  });

  const confirmQuotationMutation = useMutation({
    mutationFn: async () => {
      const res = await portalApiClient.post(`/quotations/${id}/confirm`, {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-quotation', id] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to confirm proposal';
      toast.error(msg);
    },
  });

  return {
    quotation: quotationQuery.data || null,
    isLoading: quotationQuery.isLoading,
    error: quotationQuery.error,
    submitNegotiation: submitNegotiationMutation.mutateAsync,
    confirmQuotation: confirmQuotationMutation.mutateAsync,
    isSubmitting: submitNegotiationMutation.isPending || confirmQuotationMutation.isPending,
    submitError: submitNegotiationMutation.error,
    confirmError: confirmQuotationMutation.error,
  };
}
