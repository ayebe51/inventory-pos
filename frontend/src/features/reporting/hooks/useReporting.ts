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

export const useIncomeStatement = (periodId: string) => {
  return useQuery({
    queryKey: ['reporting', 'income-statement', periodId],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/reporting/financial/income-statement?period_id=${periodId}`);
      return data.data;
    },
    enabled: !!periodId
  });
};

export const useBalanceSheet = (asOfDate?: string) => {
  return useQuery({
    queryKey: ['reporting', 'balance-sheet', asOfDate],
    queryFn: async () => {
      const qs = asOfDate ? `?as_of_date=${asOfDate}` : '';
      const { data } = await api.get(`/api/v1/reporting/financial/balance-sheet${qs}`);
      return data.data;
    }
  });
};

export const useCashFlow = (periodId?: string) => {
  return useQuery({
    queryKey: ['reporting', 'cash-flow', periodId],
    queryFn: async () => {
      const qs = periodId ? `?period_id=${periodId}` : '';
      const { data } = await api.get(`/api/v1/reporting/financial/cash-flow-statement${qs}`);
      return data.data;
    }
  });
};

export const useARAging = (asOfDate?: string) => {
  return useQuery({
    queryKey: ['reporting', 'ar-aging', asOfDate],
    queryFn: async () => {
      const qs = asOfDate ? `?as_of_date=${asOfDate}` : '';
      const { data } = await api.get(`/api/v1/reporting/aging/ar${qs}`);
      return data.data;
    }
  });
};

export const useAPAging = (asOfDate?: string) => {
  return useQuery({
    queryKey: ['reporting', 'ap-aging', asOfDate],
    queryFn: async () => {
      const qs = asOfDate ? `?as_of_date=${asOfDate}` : '';
      const { data } = await api.get(`/api/v1/reporting/aging/ap${qs}`);
      return data.data;
    }
  });
};

