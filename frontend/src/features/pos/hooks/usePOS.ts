import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import api from '../../../lib/api';

export const useActiveShift = () =>
  useQuery({
    queryKey: ['pos', 'shift', 'active'],
    queryFn: async () => {
      const res = await api.get('/pos/shifts?status=OPEN&limit=1');
      const shifts = res.data?.data;
      return shifts?.[0] ?? null;
    },
    staleTime: 30_000,
  });

export const useShiftTransactions = (shiftId?: string) =>
  useQuery({
    queryKey: ['pos', 'transactions', shiftId],
    queryFn: () => api.get(`/pos/transactions?shift_id=${shiftId}`).then((r) => r.data),
    enabled: !!shiftId,
  });

export const useOpenShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { opening_balance: number }) =>
      api.post('/pos/shifts', data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos', 'shift', 'active'] });
      message.success('Shift opened successfully');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || 'Failed to open shift');
    },
  });
};

export const useCloseShift = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shift_id, closing_balance }: { shift_id: string; closing_balance: number }) =>
      api.post(`/pos/shifts/${shift_id}/close`, { closing_balance }).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos'] });
      message.success('Shift closed successfully');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || 'Failed to close shift');
    },
  });
};

export const useCheckout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      shift_id: string;
      items: { product_id: string; quantity: number; unit_price: number }[];
      payments: { method: string; amount: number }[];
    }) => api.post('/pos/transactions', data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || 'Checkout failed');
    },
  });
};
