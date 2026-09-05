import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '../catalog.api';
import { Product, ProductCategory, Warehouse } from '../../types/catalog.types';
import { useAuthStore } from '../../stores/auth.store';

export function useProducts(search?: string) {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<Product[], Error>({
    queryKey: ['products', search, token],
    queryFn: async () => {
      const res = await catalogApi.getProducts(token, { search });
      return res.data || [];
    },
    retry: 1,
    staleTime: 15_000,
  });
}

export function useCategories() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<ProductCategory[], Error>({
    queryKey: ['categories', token],
    queryFn: async () => {
      const res = await catalogApi.getCategories(token);
      return res || [];
    },
    retry: 1,
    staleTime: 30_000,
  });
}

export function useWarehouses() {
  const token = useAuthStore((s) => s.accessToken) || undefined;

  return useQuery<Warehouse[], Error>({
    queryKey: ['warehouses', token],
    queryFn: async () => {
      const res = await catalogApi.getWarehouses(token);
      return res || [];
    },
    retry: 1,
    staleTime: 60_000,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);

  return useMutation({
    mutationFn: async (data: {
      name: string;
      categoryId: string;
      basePrice: number;
      costPrice?: number;
      unit?: string;
      taxRate?: number;
      description?: string;
    }) => {
      if (!token) throw new Error('Authentication required to create products');
      return catalogApi.createProduct(token, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
