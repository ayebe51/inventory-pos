import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

export const useSalesSummary = (fromDate: string, toDate: string) => {
  return useQuery({
    queryKey: ['reporting', 'sales-summary', fromDate, toDate],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/reporting/sales/summary?from_date=${fromDate}&to_date=${toDate}`);
      return data.data;
    },
  });
};

export const useInventoryPosition = (asOfDate?: string) => {
  return useQuery({
    queryKey: ['reporting', 'inventory-position', asOfDate],
    queryFn: async () => {
      const qs = asOfDate ? `?as_of_date=${asOfDate}` : '';
      const { data } = await api.get(`/api/v1/reporting/inventory/position${qs}`);
      return data.data;
    },
  });
};

export const useExecutiveDashboard = (asOfDate?: string) => {
  return useQuery({
    queryKey: ['reporting', 'executive-dashboard', asOfDate],
    queryFn: async () => {
      const qs = asOfDate ? `?as_of_date=${asOfDate}` : '';
      const { data } = await api.get(`/api/v1/reporting/executive-dashboard${qs}`);
      return data.data;
    }
  });
};

export const useTrialBalance = (periodId: string) => {
  return useQuery({
    queryKey: ['reporting', 'trial-balance', periodId],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/reporting/financial/trial-balance?period_id=${periodId}`);
      return data.data;
    },
    enabled: !!periodId
  });
};

