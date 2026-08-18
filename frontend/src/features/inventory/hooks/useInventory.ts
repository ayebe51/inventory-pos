import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { PaginatedProducts, Product } from '../types/inventory.types';

interface UseProductsParams {
  page?: number;
  per_page?: number;
  name?: string;
  code?: string;
}

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
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
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
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
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
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });
};

