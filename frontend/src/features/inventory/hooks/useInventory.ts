import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { api } from '../../../lib/api';
import type { PaginatedProducts, Product } from '../types/inventory.types';

interface UseProductsParams {
  page?: number;
  per_page?: number;
  name?: string;
  code?: string;
}

const extractApiError = (err: any): string =>
  err?.response?.data?.error?.message ||
  (Array.isArray(err?.response?.data?.message) ? err.response.data.message[0] : err?.response?.data?.message) ||
  'Terjadi kesalahan. Coba lagi.';

export const useProducts = (params?: UseProductsParams) => {
  return useQuery<PaginatedProducts>({
    queryKey: ['products', params],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/master-data/products', { params });
      return data;
    }
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newProduct: Partial<Product>) => {
      const { data } = await api.post('/api/v1/master-data/products', newProduct);
      return data;
    },
    onSuccess: () => {
      message.success('Produk berhasil dibuat');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      message.error(extractApiError(err));
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updateData }: Partial<Product> & { id: string }) => {
      const { data } = await api.patch(`/api/v1/master-data/products/${id}`, updateData);
      return data;
    },
    onSuccess: () => {
      message.success('Produk berhasil diperbarui');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      message.error(extractApiError(err));
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/api/v1/master-data/products/${id}`);
      return data;
    },
    onSuccess: () => {
      message.success('Produk berhasil dihapus');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      message.error(extractApiError(err));
    },
  });
};

