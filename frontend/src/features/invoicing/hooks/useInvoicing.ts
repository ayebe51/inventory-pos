import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import api from '../../../lib/api';

export const useInvoices = (params?: Record<string, string>) =>
  useQuery({
    queryKey: ['invoices', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return api.get(`/invoices${qs}`).then((r) => r.data);
    },
  });

export const useCreateInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => {
      const type = data.type === 'SALES' ? 'sales' : 'purchase';
      return api.post(`/invoices/${type}`, data).then((r) => r.data.data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Invoice created'); },
    onError: (err: any) => { message.error(err?.response?.data?.error?.message || 'Failed'); },
  });
};

export const usePostInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/post`).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Invoice posted'); },
    onError: (err: any) => { message.error(err?.response?.data?.error?.message || 'Failed to post'); },
  });
};

export const useCancelInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/invoices/${id}/cancel`).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); message.success('Invoice cancelled'); },
    onError: (err: any) => { message.error(err?.response?.data?.error?.message || 'Failed to cancel'); },
  });
};

export const usePayments = (params?: Record<string, string>) =>
  useQuery({
    queryKey: ['payments', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return api.get(`/payments${qs}`).then((r) => r.data);
    },
  });

export const useCreatePayment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post(`/payments`, data).then((r) => r.data.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); message.success('Payment recorded'); },
    onError: (err: any) => { message.error(err?.response?.data?.error?.message || 'Failed to record payment'); },
  });
};
