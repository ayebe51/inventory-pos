import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

export const useDashboardData = () => {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const [execRes, trendRes] = await Promise.all([
        api.get('/api/v1/reporting/executive-dashboard'),
        api.get('/api/v1/reporting/sales/trend?days=7')
      ]);
      return {
        ...execRes.data.data,
        salesTrend: trendRes.data.data
      };
    }
  });
};

export const useRecentActivities = () => {
  return useQuery({
    queryKey: ['dashboard', 'recent-activities'],
    queryFn: async () => {
      const { data } = await api.get('/api/v1/reporting/recent-activities?limit=5');
      return data.data;
    }
  });
};

export const useMonthlyTrend = (year?: number) => {
  const currentYear = year || new Date().getFullYear();
  return useQuery({
    queryKey: ['dashboard', 'monthly-trend', currentYear],
    queryFn: async () => {
      const { data } = await api.get(`/api/v1/reporting/sales/trend/monthly?year=${currentYear}`);
      return data.data;
    }
  });
};
