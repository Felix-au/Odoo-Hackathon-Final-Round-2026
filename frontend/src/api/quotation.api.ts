import axios from 'axios';
import { Quotation, QuotationFilters } from '../types/quotation.types';

const GATEWAY_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

export const quotationHttp = axios.create({
  baseURL: GATEWAY_API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 6000,
});

export const quotationApi = {
  getQuotations: async (token?: string, filters?: QuotationFilters): Promise<{ data: Quotation[]; total: number }> => {
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

  getQuotationById: async (id: string, token?: string): Promise<Quotation> => {
    const res = await quotationHttp.get(`/quotations/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },

  createQuotation: async (customerId: string, token?: string): Promise<Quotation> => {
    const res = await quotationHttp.post('/quotations', { customerId }, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },
};
