import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationApi } from '../quotation.api';
import { useAuthStore } from '../../stores/auth.store';
import { toast } from 'sonner';

export function useApprovalActions(quotationId: string) {
  const token = useAuthStore((s) => s.accessToken) || undefined;
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    mutationFn: async (params?: { role?: string; approverName?: string; reason?: string }) => {
      if (!token) throw new Error('Authentication required');
      return await quotationApi.approveQuotation(quotationId, params?.reason, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stages'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['deal-health-alerts'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || 'Failed to approve quotation';
      toast.error(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (params: { role?: string; approverName?: string; reason: string }) => {
      if (!token) throw new Error('Authentication required');
      return await quotationApi.rejectQuotation(quotationId, params.reason, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stages'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['deal-health-alerts'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || 'Failed to reject quotation';
      toast.error(msg);
    },
  });

  const returnForRevisionMutation = useMutation({
    mutationFn: async (params: { role?: string; approverName?: string; reason: string }) => {
      if (!token) throw new Error('Authentication required');
      return await quotationApi.returnQuotation(quotationId, params.reason, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stages'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['deal-health-alerts'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || 'Failed to return quotation';
      toast.error(msg);
    },
  });

  const sendQuotationMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Authentication required');
      return await quotationApi.sendQuotation(quotationId, token);
    },
    onSuccess: () => {
      toast.success('Quotation sent to customer portal');
      queryClient.invalidateQueries({ queryKey: ['quotation', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-stages'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['deal-health-alerts'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || 'Failed to send quotation';
      toast.error(msg);
    },
  });

  return {
    approve: approveMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    returnForRevision: returnForRevisionMutation.mutateAsync,
    sendQuotation: sendQuotationMutation.mutateAsync,
    isProcessing:
      approveMutation.isPending ||
      rejectMutation.isPending ||
      returnForRevisionMutation.isPending ||
      sendQuotationMutation.isPending,
  };
}
