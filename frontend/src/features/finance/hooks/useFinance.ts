import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { FinanceData, CreateJournalEntryPayload } from '../types/finance.types';

export const useFinanceData = () => {
  return useQuery<FinanceData>({
    queryKey: ['finance', 'overview'],
    queryFn: async () => {
      const [dbRes, jeRes] = await Promise.all([
        api.get('/api/v1/reporting/executive-dashboard'),
        api.get('/api/v1/accounting/journal-entries')
      ]);
      
      const transactions = jeRes.data.data.map((je: any) => ({
        id: je.id,
        date: je.entry_date.split('T')[0],
        desc: je.description || je.reference_type,
        amount: je.total_debit, // Simplified
        type: 'credit' // Simplified
      }));

      return {
        currentCashBalance: dbRes.data.data.cash_position || 0,
        recentTransactions: transactions
      };
    }
  });
};

export const useCreateJournalEntry = () => {
  return useMutation({
    mutationFn: async (payload: CreateJournalEntryPayload) => {
      const { data } = await api.post('/api/v1/accounting/journal-entries', payload);
      return data;
    }
  });
};
