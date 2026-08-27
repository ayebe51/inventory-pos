import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { FinanceData } from '../types/finance.types';

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
    mutationFn: async (payload: any) => {
      const formatted = {
        entry_date: payload.entry_date || payload.date || new Date().toISOString(),
        period_id: payload.period_id,
        description: payload.description,
        reference_type: payload.reference_type || 'MANUAL',
        lines: (payload.lines || []).map((l: any) => ({
          account_id: l.account_id || l.accountId,
          debit: Number(l.debit || 0),
          credit: Number(l.credit || 0),
          description: l.description || payload.description,
        })),
      };
      const { data } = await api.post('/api/v1/accounting/journal-entries', formatted);
      return data;
    }
  });
};
