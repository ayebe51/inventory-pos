import React, { useState } from 'react';
import { Table, Button, Typography, Tag, Space, Card, Modal, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../../../lib/api';

const { Title, Text } = Typography;

export const ApprovalPage: React.FC = () => {
  const qc = useQueryClient();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => api.get('/approvals/pending').then(r => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/approvals/${id}/approve`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] })
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => api.post(`/approvals/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      setRejectModalOpen(false);
      setRejectReason('');
    }
  });

  const handleReject = () => {
    if (selectedId && rejectReason) {
      rejectMutation.mutate({ id: selectedId, reason: rejectReason });
    }
  };

  const columns: ColumnsType<any> = [
    { title: 'Date', dataIndex: 'date', render: (d) => new Date(d).toLocaleDateString() },
    { title: 'Document', dataIndex: 'document_number', render: (t) => <Text code>{t}</Text> },
    { title: 'Type', dataIndex: 'document_type', render: (t) => <Tag color="blue">{t.replace('_', ' ')}</Tag> },
    { title: 'Requester', dataIndex: 'requester' },
    { title: 'Amount', dataIndex: 'amount', align: 'right', render: (v) => `Rp ${v.toLocaleString()}` },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => approveMutation.mutate(record.id)}>Approve</Button>
          <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => { setSelectedId(record.id); setRejectModalOpen(true); }}>Reject</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Approval Center</Title>
          <Text className="page-subtitle">Review and approve pending documents (PO, SO, Adjustments)</Text>
        </div>
      </div>

      <Card className="stat-card">
        <Table columns={columns} dataSource={data?.data || data} rowKey="id" size="small" loading={isLoading} />
      </Card>

      <Modal
        title="Reject Document"
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={() => setRejectModalOpen(false)}
        okButtonProps={{ danger: true, disabled: !rejectReason }}
        okText="Reject"
      >
        <p>Please provide a reason for rejecting this document:</p>
        <Input.TextArea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..." />
      </Modal>
    </div>
  );
};
