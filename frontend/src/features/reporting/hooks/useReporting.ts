import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { SalesSummaryData, InventoryPositionData } from '../types/reporting.types';

export const useSalesSummary = (fromDate: string, toDate: string) => {
  return useQuery<SalesSummaryData[]>({
    queryKey: ['reporting', 'sales-summary', fromDate, toDate],
    queryFn: async () => {
      // Stub for actual API call, currently backend might not have this exact shape mapped
      // const { data } = await api.get(`/v1/reporting/sales?from_date=${fromDate}&to_date=${toDate}`);
      // return data.data;

      // Mock data for charts
      return [
        { date: 'Mon', revenue: 15000000, transactions: 120 },
        { date: 'Tue', revenue: 18000000, transactions: 145 },
        { date: 'Wed', revenue: 16500000, transactions: 130 },
        { date: 'Thu', revenue: 21000000, transactions: 170 },
        { date: 'Fri', revenue: 25000000, transactions: 210 },
        { date: 'Sat', revenue: 32000000, transactions: 280 },
        { date: 'Sun', revenue: 28000000, transactions: 240 },
      ];
    },
  });
};

export const useInventoryPosition = () => {
  return useQuery<InventoryPositionData[]>({
    queryKey: ['reporting', 'inventory-position'],
    queryFn: async () => {
      // Mock data for charts
      return [
        { category: 'Electronics', value: 45 },
        { category: 'Furniture', value: 25 },
        { category: 'Office Supplies', value: 20 },
        { category: 'Food & Beverage', value: 10 },
      ];
    },
  });
};
