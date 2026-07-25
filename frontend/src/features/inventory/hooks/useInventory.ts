import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { PaginatedProducts } from '../types/inventory.types';

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
      const { data } = await api.get('/v1/master-data/products', { params });
      return data;
    },
    // Adding fallback data so UI works without backend
    initialData: {
      data: [
        {
          id: '1',
          code: 'SKU-1001',
          barcode: null,
          name: 'Premium Wireless Headphones',
          description: null,
          category_id: 'cat-1',
          brand_id: null,
          uom_id: 'uom-1',
          cost_method: 'WAC',
          standard_cost: 1500000,
          selling_price: 2500000,
          min_selling_price: 2000000,
          reorder_point: 10,
          reorder_qty: 50,
          max_stock: null,
          is_serialized: false,
          is_batch_tracked: false,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ],
      meta: {
        page: 1,
        per_page: 20,
        total: 1,
        total_pages: 1
      }
    }
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newProduct: Partial<Product>) => {
      const { data } = await api.post('/v1/master-data/products', newProduct);
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
      const { data } = await api.patch(`/v1/master-data/products/${id}`, updateData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });
};
