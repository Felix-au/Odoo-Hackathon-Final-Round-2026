import axios from 'axios';
import { Product, ProductCategory, Warehouse, SubscriptionPlan, TierCeilings } from '../types/catalog.types';

const GATEWAY_API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1';

export const catalogHttp = axios.create({
  baseURL: GATEWAY_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

export const catalogApi = {
  getProducts: async (
    token?: string,
    params?: { search?: string; categoryId?: string; page?: number; pageSize?: number }
  ): Promise<{ data: Product[]; total: number; page: number; pageSize: number }> => {
    const res = await catalogHttp.get('/catalog/products', {
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },

  getProductById: async (id: string, token?: string): Promise<Product> => {
    const res = await catalogHttp.get(`/catalog/products/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data?.data || res.data;
  },

  createProduct: async (
    token: string,
    data: {
      name: string;
      categoryId: string;
      basePrice: number;
      costPrice?: number;
      unit?: string;
      taxRate?: number;
      description?: string;
    }
  ): Promise<Product> => {
    const res = await catalogHttp.post('/catalog/products', data, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data?.data || res.data;
  },

  updateProduct: async (
    id: string,
    data: {
      name?: string;
      categoryId?: string;
      basePrice?: number;
      costPrice?: number;
      unit?: string;
      taxRate?: number;
      description?: string;
      isActive?: boolean;
    },
    token?: string
  ): Promise<Product> => {
    const res = await catalogHttp.put(`/catalog/products/${id}`, data, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data?.data || res.data;
  },

  deleteProduct: async (id: string, token?: string): Promise<void> => {
    await catalogHttp.delete(`/catalog/products/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  },

  getCategories: async (token?: string): Promise<ProductCategory[]> => {
    const res = await catalogHttp.get('/catalog/categories', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return Array.isArray(res.data) ? res.data : (res.data?.data || []);
  },

  getDiscountTiers: async (token?: string): Promise<any[]> => {
    const res = await catalogHttp.get('/catalog/discount-tiers', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
  },

  getApprovalChains: async (token?: string): Promise<any[]> => {
    const res = await catalogHttp.get('/catalog/approval-chains', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
  },

  resolveApprovalChain: async (riskScore: number, token?: string): Promise<any> => {
    const res = await catalogHttp.get(`/catalog/approval-chains/resolve?riskScore=${riskScore}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data;
  },

  getDiscountCeilings: async (token?: string): Promise<TierCeilings> => {
    const res = await catalogHttp.get('/catalog/discount-tiers/ceilings', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.data?.data || res.data;
  },

  getWarehouses: async (token?: string): Promise<Warehouse[]> => {
    const res = await catalogHttp.get('/catalog/warehouses', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return Array.isArray(res.data) ? res.data : (res.data?.data || []);
  },

  getSubscriptionPlans: async (token?: string): Promise<SubscriptionPlan[]> => {
    const res = await catalogHttp.get('/catalog/subscription-plans', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return Array.isArray(res.data) ? res.data : (res.data?.data || []);
  },
};
