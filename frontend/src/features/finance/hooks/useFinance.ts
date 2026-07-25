import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { FinanceData, CreateJournalEntryPayload } from '../types/finance.types';

export const useFinanceData = () => {
  return useQuery<FinanceData>({
    queryKey: ['finance', 'overview'],
    queryFn: async () => {
      // In a real app, this would be a specific endpoint for the finance dashboard.
      // Here we combine the reporting endpoint for cash position with mocked transactions.
      const { data } = await api.get('/v1/reporting/executive-dashboard');
      
      return {
        currentCashBalance: data.data.cash_position,
        recentTransactions: [
          { id: '1', date: new Date().toISOString().split('T')[0], desc: 'POS Sale #INV-1092', amount: 3500000, type: 'credit' },
          { id: '2', date: new Date(Date.now() - 86400000).toISOString().split('T')[0], desc: 'Supplier Payment (Tech Indo)', amount: 12500000, type: 'debit' },
          { id: '3', date: new Date(Date.now() - 86400000).toISOString().split('T')[0], desc: 'POS Sale #INV-1091', amount: 850000, type: 'credit' },
          { id: '4', date: new Date(Date.now() - 172800000).toISOString().split('T')[0], desc: 'Office Supplies', amount: 450000, type: 'debit' },
          { id: '5', date: new Date(Date.now() - 172800000).toISOString().split('T')[0], desc: 'POS Sale #INV-1090', amount: 1200000, type: 'credit' },
        ]
      };
    },
    initialData: {
      currentCashBalance: 124500000,
      recentTransactions: [
        { id: '1', date: '2026-07-25', desc: 'POS Sale #INV-1092', amount: 3500000, type: 'credit' },
      ]
    }
  });
};

export const useCreateJournalEntry = () => {
  return useMutation({
    mutationFn: async (payload: CreateJournalEntryPayload) => {
      // Stub for real API endpoint
      console.log('Submitting Journal Entry:', payload);
      return { success: true };
    }
  });
};
