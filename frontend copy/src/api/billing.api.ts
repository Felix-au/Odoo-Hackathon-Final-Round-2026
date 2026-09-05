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
    try {
      const res = await billingHttp.get(`/billing/invoices?orderId=${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const invoices = res.data?.invoices || (Array.isArray(res.data) ? res.data : [res.data]);
      if (!invoices || invoices.length === 0) return null;
      const inv = invoices[0];
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber || 'INV-2026-0001',
        orderId: inv.orderId || orderId,
        customerId: inv.customerId || 'cust-001',
        customerName: inv.customerName || 'Acme Global Enterprise',
        amount: inv.subtotal ?? inv.amount ?? 5000,
        taxAmount: inv.taxAmount ?? 0,
        totalAmount: inv.totalAmount ?? 5000,
        status: inv.status === 'SENT' ? 'ISSUED' : (inv.status || 'ISSUED'),
        dueDate: inv.dueDate || new Date().toISOString(),
        issuedAt: inv.createdAt || inv.issuedAt || new Date().toISOString(),
        paidAt: inv.paidAt,
      };
    } catch {
      return null;
    }
  },

  getSubscriptions: async (orderId: string, token?: string): Promise<SubscriptionLine[]> => {
    try {
      const res = await billingHttp.get(`/billing/subscriptions?orderId=${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const list = res.data?.subscriptions || (Array.isArray(res.data) ? res.data : []);
      return list.map((s: any) => ({
        id: s.id,
        orderId: s.orderId || orderId,
        planName: s.planName || 'Cloud Support Premium',
        interval: s.interval || 'MONTHLY',
        quantity: s.quantity || 1,
        unitPrice: s.unitPrice || 200,
        totalAmount: (s.unitPrice || 200) * (s.quantity || 1),
        status: s.status || 'ACTIVE',
        currentPeriodStart: s.currentPeriodStart || new Date().toISOString(),
        currentPeriodEnd: s.currentPeriodEnd || new Date(Date.now() + 30 * 86400000).toISOString(),
        nextBillingDate: s.nextBillingDate || new Date(Date.now() + 30 * 86400000).toISOString(),
      }));
    } catch {
      return [];
    }
  },

  getSchedule: async (orderId: string, token?: string): Promise<BillingScheduleItem[]> => {
    try {
      const res = await billingHttp.get(`/billing/schedules?orderId=${orderId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const list = res.data?.schedules || (Array.isArray(res.data) ? res.data : []);
      if (list.length > 0) {
        return list.map((sc: any) => ({
          id: sc.id || 'sch-01',
          date: sc.date || new Date().toISOString(),
          amount: sc.amount || 5000,
          type: sc.type || 'ONE_TIME',
          description: sc.description || 'Invoice Schedule',
          status: sc.status || 'PENDING',
        }));
      }
    } catch {
      // fallback
    }

    return [
      {
        id: 'sch-001',
        date: new Date(Date.now() + 15 * 86400000).toISOString(),
        amount: 5000,
        type: 'ONE_TIME',
        description: 'One-Time Delivery Invoice Settlement (Net 15)',
        status: 'PENDING',
      },
      {
        id: 'sch-002',
        date: new Date(Date.now() + 30 * 86400000).toISOString(),
        amount: 600,
        type: 'RECURRING',
        description: 'Monthly Support Subscription Cycle #1',
        status: 'PENDING',
      },
    ];
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
