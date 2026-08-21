import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { api } from '../../../lib/api';

export const useInvoices = (params?: Record<string, string>) =>
  useQuery({
    queryKey: ['invoices', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return api.get(`/api/v1/invoices${qs}`).then((r) => r.data);
    },
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => {
      const type = data.type === 'SALES' ? 'sales' : 'purchase';
      return api.post(`/api/v1/invoices/${type}`, data).then((r) => r.data.data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Invoice created'); },
    onError: (err: any) => { message.error(err?.response?.data?.error?.message || 'Failed'); },
  });
};

export const usePostInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/invoices/${id}/post`).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Invoice posted'); },
    onError: (err: any) => { message.error(err?.response?.data?.error?.message || 'Failed to post'); },
  });
};

export const useCancelInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/invoices/${id}/cancel`).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Invoice cancelled'); },
    onError: (err: any) => { message.error(err?.response?.data?.error?.message || 'Failed to cancel'); },
  });
};

export const usePayments = (params?: Record<string, string>) =>
  useQuery({
    queryKey: ['payments', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return api.get(`/api/v1/payments${qs}`).then((r) => r.data);
    },
  });

export const useCreatePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/api/v1/payments`, data).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); message.success('Payment recorded'); },
    onError: (err: any) => { message.error(err?.response?.data?.error?.message || 'Failed to record payment'); },
  });
};

export const useDisputeInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/api/v1/invoices/${id}/dispute`, { reason }).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Invoice disputed'); },
    onError: (err: any) => { message.error(err?.response?.data?.error?.message || 'Failed to dispute'); },
  });
};

export const useWriteOffInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.post(`/api/v1/invoices/${id}/write-off`, { reason }).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Invoice written off'); },
    onError: (err: any) => { message.error(err?.response?.data?.error?.message || 'Failed to write off'); },
  });
};
