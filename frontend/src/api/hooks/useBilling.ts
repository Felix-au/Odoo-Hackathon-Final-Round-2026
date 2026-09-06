import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../billing.api';
import { OneTimeInvoice, SubscriptionLine, BillingScheduleItem } from '../../types/billing.types';
import { useAuthStore } from '../../stores/auth.store';

export function useBilling(orderId: string) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  const invoiceQuery = useQuery<OneTimeInvoice | null, Error>({
    queryKey: ['billing-invoice', orderId, token],
    queryFn: async () => {
      try {
        return await billingApi.getInvoice(orderId, token);
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 15_000,
  });

  const subscriptionsQuery = useQuery<SubscriptionLine[], Error>({
    queryKey: ['billing-subscriptions', orderId, token],
    queryFn: async () => {
      try {
        return await billingApi.getSubscriptions(orderId, token);
      } catch {
        return [];
      }
    },
    retry: false,
    staleTime: 15_000,
  });

  const scheduleQuery = useQuery<BillingScheduleItem[], Error>({
    queryKey: ['billing-schedule', orderId, token],
    queryFn: async () => {
      try {
        return await billingApi.getSchedule(orderId, token);
      } catch {
        return [];
      }
    },
    retry: false,
    staleTime: 15_000,
  });

  return {
    invoice: invoiceQuery.data || null,
    subscriptions: subscriptionsQuery.data || [],
    schedule: scheduleQuery.data || [],
    isLoading: invoiceQuery.isLoading || subscriptionsQuery.isLoading || scheduleQuery.isLoading,
  };
}

export function useAllInvoices(params?: { orderId?: string; status?: string }) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<{ data: OneTimeInvoice[]; total: number }, Error>({
    queryKey: ['billing-all-invoices', params?.orderId, params?.status, token],
    queryFn: async () => {
      return await billingApi.listInvoices(params, token);
    },
    staleTime: 15_000,
  });
}

export function useAllSubscriptions(params?: { orderId?: string; status?: string }) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<{ subscriptions: SubscriptionLine[]; total: number }, Error>({
    queryKey: ['billing-all-subscriptions', params?.orderId, params?.status, token],
    queryFn: async () => {
      return await billingApi.listSubscriptions(params, token);
    },
    staleTime: 15_000,
  });
}

export function useRecordPayment(_orderId: string) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return {
    mutateAsync: async (payment: { amount: number; method: string; reference: string }) => {
      if (!token) throw new Error('Authentication required');
      const invoice = await billingApi.getInvoice(_orderId, token);
      if (!invoice) throw new Error('Invoice not found for order');
      return await billingApi.recordPayment(invoice.id, payment, token);
    },
    isPending: false,
  };
}

export function useRecordInvoicePayment() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return {
    mutateAsync: async (invoiceId: string, payment: { amount: number; method: string; reference: string }) => {
      if (!token) throw new Error('Authentication required');
      return await billingApi.recordPayment(invoiceId, payment, token);
    },
    isPending: false,
  };
}

export function useProrationPreview() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return {
    mutateAsync: async (params: { subscriptionId: string; newQty: number }) => {
      if (!token) throw new Error('Authentication required');
      return await billingApi.previewSubscriptionProration(params.subscriptionId, params.newQty, token);
    },
    isPending: false,
  };
}

export function useUpdateSubscriptionQuantity() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return {
    mutateAsync: async (params: { subscriptionId: string; newQty: number }) => {
      if (!token) throw new Error('Authentication required');
      return await billingApi.updateSubscriptionQuantity(params.subscriptionId, params.newQty, token);
    },
    isPending: false,
  };
}

