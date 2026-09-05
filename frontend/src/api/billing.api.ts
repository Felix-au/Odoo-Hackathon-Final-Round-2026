import axios from 'axios';
import { OneTimeInvoice, SubscriptionLine, BillingScheduleItem } from '../types/billing.types';

const GATEWAY_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

export const billingHttp = axios.create({
  baseURL: GATEWAY_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 6000,
});

export const billingApi = {
  getInvoice: async (orderId: string, token?: string): Promise<OneTimeInvoice | null> => {
    const res = await billingHttp.get(`/billing/invoices?orderId=${orderId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const invoices = res.data?.invoices || (Array.isArray(res.data) ? res.data : [res.data]);
    if (!invoices || invoices.length === 0) return null;
    const inv = invoices[0];
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      orderId: inv.orderId || orderId,
      customerId: inv.customerId,
      customerName: inv.customerName,
      amount: inv.subtotal ?? inv.amount ?? 0,
      taxAmount: inv.taxAmount ?? 0,
      totalAmount: inv.totalAmount ?? 0,
      status: inv.status === 'SENT' ? 'ISSUED' : inv.status,
      dueDate: inv.dueDate,
      issuedAt: inv.createdAt || inv.issuedAt,
      paidAt: inv.paidAt,
    };
  },

  getSubscriptions: async (orderId: string, token?: string): Promise<SubscriptionLine[]> => {
    const res = await billingHttp.get(`/billing/subscriptions?orderId=${orderId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const list = res.data?.subscriptions || (Array.isArray(res.data) ? res.data : []);
    return list.map((s: any) => ({
      id: s.id,
      orderId: s.orderId || orderId,
      planName: s.planName,
      interval: s.interval,
      quantity: s.quantity,
      unitPrice: s.unitPrice,
      totalAmount: s.unitPrice * s.quantity,
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

  updateSubscriptionQuantity: async (subscriptionId: string, newQuantity: number, token?: string) => {
    const res = await billingHttp.put(`/billing/subscriptions/${subscriptionId}/quantity`, {
      newQuantity,
    }, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },
};
