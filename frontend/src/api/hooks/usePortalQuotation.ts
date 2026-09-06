import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Quotation } from '../../types/quotation.types';
import { portalApiClient } from '../portal-client';
import { toast } from 'sonner';

export function usePortalQuotations(statusFilter?: string) {
  return useQuery<{ quotations: Quotation[]; total: number }>({
    queryKey: ['portal-quotations', statusFilter],
    queryFn: async () => {
      const url = statusFilter ? `/quotations?status=${statusFilter}` : '/quotations';
      const res = await portalApiClient.get(url);
      return res.data;
    },
    staleTime: 15_000,
    retry: 1,
  });
}

export function usePortalQuotation(id: string) {
  const queryClient = useQueryClient();

  // Fetch the quotation via the portal session endpoint (requires portal cookie/token)
  const quotationQuery = useQuery<Quotation | null>({
    queryKey: ['portal-quotation', id],
    queryFn: async () => {
      if (!id) return null;
      const res = await portalApiClient.get(`/quotations/${id}`);
      return res.data;
    },
    enabled: !!id,
    retry: false,
  });

  const submitNegotiationMutation = useMutation({
    mutationFn: async (params: { proposedDiscount?: number; message?: string; lineComments?: Record<string, string> }) => {
      const res = await portalApiClient.post(`/quotations/${id}/negotiate`, params);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['portal-quotations'] });
      toast.success('Your counter-proposal has been delivered to your sales representative.');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to submit counter-proposal';
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
      queryClient.invalidateQueries({ queryKey: ['portal-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stages'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-kpis'] });
      toast.success('Proposal accepted! Your order has been confirmed and submitted for fulfillment.');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to confirm proposal';
      toast.error(msg);
    },
  });

  const rejectQuotationMutation = useMutation({
    mutationFn: async (params?: { reason?: string }) => {
      const res = await portalApiClient.post(`/quotations/${id}/reject`, params || {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-quotation', id] });
      queryClient.invalidateQueries({ queryKey: ['portal-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stages'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-kpis'] });
      toast.info('Proposal declined. Feedback has been forwarded to your sales team.');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to decline proposal';
      toast.error(msg);
    },
  });

  return {
    quotation: quotationQuery.data || null,
    isLoading: quotationQuery.isLoading,
    error: quotationQuery.error,
    refetch: quotationQuery.refetch,
    submitNegotiation: submitNegotiationMutation.mutateAsync,
    confirmQuotation: confirmQuotationMutation.mutateAsync,
    rejectQuotation: rejectQuotationMutation.mutateAsync,
    isSubmitting:
      submitNegotiationMutation.isPending ||
      confirmQuotationMutation.isPending ||
      rejectQuotationMutation.isPending,
    submitError: submitNegotiationMutation.error,
    confirmError: confirmQuotationMutation.error,
    rejectError: rejectQuotationMutation.error,
  };
}
