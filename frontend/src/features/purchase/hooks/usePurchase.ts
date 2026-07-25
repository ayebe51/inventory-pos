import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import api from '../../../lib/api';

export const usePurchaseOrders = (params?: Record<string, string>) =>
  useQuery({
    queryKey: ['purchase-orders', params],
    queryFn: () => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return api.get(`/purchase-orders${qs}`).then((r) => r.data);
    },
  });

export const useCreatePurchaseOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/purchase-orders', data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      message.success('Purchase Order created');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || 'Failed to create PO');
    },
  });
};

export const useApprovePO = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/purchase-orders/${id}/approve`).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      message.success('Purchase Order approved');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || 'Approval failed');
    },
  });
};

export const useRejectPO = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/purchase-orders/${id}/reject`, { reason }).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      message.success('Purchase Order rejected');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || 'Failed to reject');
    },
  });
};

export const useConfirmGoodsReceipt = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      po_id: string;
      receipt_date: string;
      notes?: string;
      lines: { product_id: string; qty_received: number; unit_cost: number; uom_id: string }[];
    }) => api.post('/goods-receipts', data).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      message.success('Goods Receipt confirmed. Stock updated.');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || 'Failed to confirm receipt');
    },
  });
};
