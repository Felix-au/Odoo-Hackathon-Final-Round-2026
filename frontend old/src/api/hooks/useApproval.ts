import { useMutation } from '@tanstack/react-query';

export function useApprovalActions(_quotationId: string) {
  const approveMutation = useMutation({
    mutationFn: async (_params: { role: string; approverName: string; reason?: string }) => {
      throw new Error('Quotation service is currently in development. Approval action cannot be processed yet.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (_params: { role: string; approverName: string; reason: string }) => {
      throw new Error('Quotation service is currently in development. Reject action cannot be processed yet.');
    },
  });

  const returnForRevisionMutation = useMutation({
    mutationFn: async (_params: { role: string; approverName: string; reason: string }) => {
      throw new Error('Quotation service is currently in development. Return action cannot be processed yet.');
    },
  });

  return {
    approve: approveMutation.mutateAsync,
    reject: rejectMutation.mutateAsync,
    returnForRevision: returnForRevisionMutation.mutateAsync,
    isProcessing:
      approveMutation.isPending || rejectMutation.isPending || returnForRevisionMutation.isPending,
  };
}
