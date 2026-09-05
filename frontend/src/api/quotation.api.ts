import axios from 'axios';
import { Quotation, QuotationFilters } from '../types/quotation.types';
import { UpsellSuggestion } from '../types/catalog.types';

const GATEWAY_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

export const quotationHttp = axios.create({
  baseURL: GATEWAY_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 8000,
});

export const quotationApi = {
  getQuotations: async (
    token?: string,
    filters?: QuotationFilters
  ): Promise<{ data: Quotation[]; total: number }> => {
    const res = await quotationHttp.get('/quotations', {
      params: filters,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const items = res.data.quotations || res.data.data || (Array.isArray(res.data) ? res.data : []);
    return {
      data: items,
      total: res.data.total ?? items.length,
    };
  },

  getPipeline: async (token?: string) => {
    const res = await quotationHttp.get('/quotations/pipeline', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },

  getQuotationById: async (id: string, token?: string): Promise<Quotation> => {
    const res = await quotationHttp.get(`/quotations/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },

  getCustomers: async (token?: string) => {
    const res = await quotationHttp.get('/quotations/customers', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data?.customers || res.data?.data || res.data || [];
  },

  createQuotation: async (
    customerId: string,
    token?: string
  ): Promise<Quotation> => {
    const res = await quotationHttp.post(
      '/quotations',
      { customerId, currency: 'USD' },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data;
  },

  addLine: async (
    quotationId: string,
    lineData: {
      productId: string;
      productName?: string;
      categoryName?: string;
      quantity: number;
      unitPrice: number;
      costPrice?: number;
      discountPct?: number;
      isRecurring?: boolean;
      planInterval?: string;
    },
    token?: string
  ) => {
    const res = await quotationHttp.post(
      `/quotations/${quotationId}/lines`,
      lineData,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data;
  },

  updateLine: async (
    quotationId: string,
    lineId: string,
    data: { quantity?: number; discountPct?: number; unitPrice?: number },
    token?: string
  ) => {
    const res = await quotationHttp.put(
      `/quotations/${quotationId}/lines/${lineId}`,
      data,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data;
  },

  removeLine: async (quotationId: string, lineId: string, token?: string) => {
    const res = await quotationHttp.delete(
      `/quotations/${quotationId}/lines/${lineId}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data;
  },

  submitQuotation: async (quotationId: string, token?: string) => {
    const res = await quotationHttp.post(
      `/quotations/${quotationId}/submit`,
      {},
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data;
  },

  approveQuotation: async (quotationId: string, reason?: string, token?: string) => {
    const res = await quotationHttp.post(
      `/quotations/${quotationId}/approve`,
      { reason },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data;
  },

  rejectQuotation: async (quotationId: string, reason: string, token?: string) => {
    const res = await quotationHttp.post(
      `/quotations/${quotationId}/reject`,
      { reason },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data;
  },

  returnQuotation: async (quotationId: string, reason: string, token?: string) => {
    const res = await quotationHttp.post(
      `/quotations/${quotationId}/return`,
      { reason },
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data;
  },

  sendQuotation: async (quotationId: string, token?: string) => {
    const res = await quotationHttp.post(
      `/quotations/${quotationId}/send`,
      {},
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data;
  },

  updateQuotationMetadata: async (
    quotationId: string,
    data: { notes?: string; currency?: string; validUntil?: string; customerId?: string; version?: number },
    token?: string
  ) => {
    const res = await quotationHttp.put(
      `/quotations/${quotationId}`,
      data,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data;
  },

  getUpsellSuggestions: async (quotationId: string, token?: string): Promise<UpsellSuggestion[]> => {
    const res = await quotationHttp.get(
      `/quotations/${quotationId}/upsell-suggestions`,
      { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    return res.data?.suggestions || res.data || [];
  },
};
