import { useQuery, useMutation } from '@tanstack/react-query';
import { Quotation } from '../../types/quotation.types';
import { quotationApi } from '../quotation.api';

export function usePortalQuotation(id: string) {
  const quotationQuery = useQuery<Quotation | null>({
    queryKey: ['portal-quotation', id],
    queryFn: async () => {
      try {
        return await quotationApi.getQuotationById(id);
      } catch {
        return null;
      }
    },
    retry: false,
  });

  const submitNegotiationMutation = useMutation({
    mutationFn: async (_params: { proposedDiscount?: number; message: string; lineComments?: Record<string, string> }) => {
      throw new Error('Customer portal negotiation API is currently in development.');
    },
  });

  const confirmQuotationMutation = useMutation({
    mutationFn: async () => {
      throw new Error('Customer portal confirmation API is currently in development.');
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
