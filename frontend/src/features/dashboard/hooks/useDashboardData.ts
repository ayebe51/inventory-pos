import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { DashboardResponse, ExecutiveDashboardData } from '../types/dashboard.types';

export const useDashboardData = () => {
  return useQuery<ExecutiveDashboardData>({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const { data } = await api.get<DashboardResponse>('/v1/reporting/executive-dashboard');
      return data.data; // The NestJS successResponse nests data under "data"
    },
    // Mock fallback since the backend requires DB connection
    initialData: {
      total_sales: 154200000,
      total_purchases: 85000000,
      cash_position: 250000000,
      ar_outstanding: 45000000,
      ap_outstanding: 30000000,
      top_products: [],
      generated_at: new Date(),
    }
  });
};
