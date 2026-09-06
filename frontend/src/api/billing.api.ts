import axios from 'axios';
import { OneTimeInvoice, SubscriptionLine, BillingScheduleItem } from '../types/billing.types';

const GATEWAY_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

export const billingHttp = axios.create({
  baseURL: GATEWAY_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 6000,
});

export const billingApi = {
  listInvoices: async (params?: { orderId?: string; status?: string; page?: number }, token?: string): Promise<{ data: OneTimeInvoice[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.orderId) query.set('orderId', params.orderId);
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    const url = `/billing/invoices${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await billingHttp.get(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const rawList = res.data?.data || res.data?.invoices || (Array.isArray(res.data) ? res.data : []);
    const total = res.data?.total ?? rawList.length;
    const data: OneTimeInvoice[] = rawList.map((inv: any) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber || `INV-${inv.id.slice(0, 8).toUpperCase()}`,
      orderId: inv.orderId,
      customerId: inv.customerId,
      customerName: inv.customerName || (inv.customer?.name ?? 'Enterprise Client'),
      amount: inv.subtotal ?? inv.amount ?? 0,
      taxAmount: inv.taxAmount ?? 0,
      totalAmount: inv.totalAmount ?? 0,
      status: inv.status === 'SENT' ? 'ISSUED' : inv.status,
      dueDate: inv.dueDate,
      issuedAt: inv.createdAt || inv.issuedAt,
      paidAt: inv.paidAt,
    }));
    return { data, total };
  },

  getInvoice: async (orderId: string, token?: string): Promise<OneTimeInvoice | null> => {
    const res = await billingHttp.get(`/billing/invoices?orderId=${orderId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const invoices = res.data?.data || res.data?.invoices || (Array.isArray(res.data) ? res.data : [res.data]);
    if (!invoices || invoices.length === 0) return null;
    const inv = invoices[0];
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber || `INV-${inv.id.slice(0, 8).toUpperCase()}`,
      orderId: inv.orderId || orderId,
      customerId: inv.customerId,
      customerName: inv.customerName || (inv.customer?.name ?? 'Enterprise Client'),
      amount: inv.subtotal ?? inv.amount ?? 0,
      taxAmount: inv.taxAmount ?? 0,
      totalAmount: inv.totalAmount ?? 0,
      status: inv.status === 'SENT' ? 'ISSUED' : inv.status,
      dueDate: inv.dueDate,
      issuedAt: inv.createdAt || inv.issuedAt,
      paidAt: inv.paidAt,
    };
  },

  listSubscriptions: async (params?: { orderId?: string; status?: string }, token?: string): Promise<{ subscriptions: SubscriptionLine[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.orderId) query.set('orderId', params.orderId);
    if (params?.status) query.set('status', params.status);
    const url = `/billing/subscriptions${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await billingHttp.get(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const rawList = res.data?.subscriptions || res.data?.data || (Array.isArray(res.data) ? res.data : []);
    const total = res.data?.total ?? rawList.length;
    const subscriptions: SubscriptionLine[] = rawList.map((s: any) => ({
      id: s.id,
      orderId: s.orderId,
      planName: s.planName,
      interval: s.interval,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      totalAmount: Number(s.unitPrice) * s.quantity,
      status: s.status,
      currentPeriodStart: s.currentPeriodStart,
      currentPeriodEnd: s.currentPeriodEnd,
      nextBillingDate: s.nextBillingDate,
    }));
    return { subscriptions, total };
  },

  getSubscriptions: async (orderId: string, token?: string): Promise<SubscriptionLine[]> => {
    const res = await billingHttp.get(`/billing/subscriptions?orderId=${orderId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const list = res.data?.subscriptions || res.data?.data || (Array.isArray(res.data) ? res.data : []);
    return list.map((s: any) => ({
      id: s.id,
      orderId: s.orderId || orderId,
      planName: s.planName,
      interval: s.interval,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      totalAmount: Number(s.unitPrice) * s.quantity,
      status: s.status,
      currentPeriodStart: s.currentPeriodStart,
      currentPeriodEnd: s.currentPeriodEnd,
      nextBillingDate: s.nextBillingDate,
    }));
  },

  getSchedule: async (orderId: string, token?: string): Promise<BillingScheduleItem[]> => {
    const res = await billingHttp.get(`/billing/schedules?orderId=${orderId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const list = res.data?.schedules || (Array.isArray(res.data) ? res.data : []);
    return list.map((sc: any) => ({
      id: sc.id,
      date: sc.date,
      amount: sc.amount,
      type: sc.type,
      description: sc.description,
      status: sc.status,
    }));
  },

  recordPayment: async (invoiceId: string, payment: { amount: number; method: string; reference: string }, token?: string) => {
    const res = await billingHttp.post(`/billing/invoices/${invoiceId}/payments`, {
      amount: payment.amount,
      currency: 'USD',
      method: payment.method,
      reference: payment.reference,
    }, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },

  previewSubscriptionProration: async (
    subscriptionId: string,
    newQuantity: number,
    token?: string
  ): Promise<{
    subscriptionId: string;
    oldQuantity: number;
    newQuantity: number;
    unitPrice: number;
    periodDays: number;
    remainingDays: number;
    creditAmount: number;
    chargeAmount: number;
    netAmount: number;
    creditNote: boolean;
  }> => {
    const res = await billingHttp.get(
      `/billing/subscriptions/${subscriptionId}/proration-preview?newQuantity=${newQuantity}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data;
  },

  updateSubscriptionQuantity: async (subscriptionId: string, newQuantity: number, token?: string) => {
    const res = await billingHttp.put(`/billing/subscriptions/${subscriptionId}/quantity`, {
      newQuantity,
    }, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },
};
