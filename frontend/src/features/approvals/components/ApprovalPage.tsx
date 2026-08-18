import React, { useState } from 'react';
import { Table, Button, Typography, Tag, Space, Card, Modal, Input, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircleOutlined, CloseCircleOutlined, HistoryOutlined } from '@ant-design/icons';
import { api } from '../../../lib/api';

const { Title, Text } = Typography;

export const ApprovalPage: React.FC = () => {
  const qc = useQueryClient();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const { data: pendingData, isLoading: pendingLoading } = useQuery({
    queryKey: ['approvals', 'pending'],
    queryFn: () => api.get('/api/v1/approvals/pending').then(r => r.data),
  });

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['approvals', 'history'],
    queryFn: () => api.get('/api/v1/approvals/history').then(r => r.data),
    enabled: activeTab === 'history',
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/approvals/${id}/approve`, { notes: 'Approved via UI' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] })
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => api.post(`/api/v1/approvals/${id}/reject`, { reason }),
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

  const getStatusTag = (status: string) => {
    switch(status) {
      case 'PENDING': return <Tag color="warning">Pending</Tag>;
      case 'APPROVED': return <Tag color="success">Approved</Tag>;
      case 'REJECTED': return <Tag color="error">Rejected</Tag>;
      default: return <Tag>{status}</Tag>;
    }
  };

  const pendingColumns: ColumnsType<any> = [
    { title: 'Date Request', dataIndex: 'created_at', render: (d) => new Date(d).toLocaleDateString() },
    { title: 'Document Type', dataIndex: 'document_type', render: (t) => <Tag color="blue">{t?.replace('_', ' ')}</Tag> },
    { title: 'Reference', dataIndex: 'reference_id', render: (t) => <Text code>{t?.substring(0, 8)}...</Text> },
    { title: 'Status', dataIndex: 'status', render: getStatusTag },
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

  const historyColumns: ColumnsType<any> = [
    { title: 'Date Decision', dataIndex: 'updated_at', render: (d) => new Date(d).toLocaleDateString() },
    { title: 'Document Type', dataIndex: 'document_type', render: (t) => <Tag color="blue">{t?.replace('_', ' ')}</Tag> },
    { title: 'Reference', dataIndex: 'reference_id', render: (t) => <Text code>{t?.substring(0, 8)}...</Text> },
    { title: 'Final Status', dataIndex: 'status', render: getStatusTag },
    { title: 'My Decision', key: 'my_decision', render: (_, record) => {
        // Find the step for the current user (if we had the user ID we could filter properly, 
        // but for now we just show the first non-pending step or something)
        const decidedStep = record.steps?.find((s: any) => s.status !== 'PENDING');
        if (decidedStep) {
           return (
             <div>
               {getStatusTag(decidedStep.status)}
               {decidedStep.notes && <div style={{ fontSize: 12, color: '#888' }}>{decidedStep.notes}</div>}
             </div>
           )
        }
        return '-';
    }},
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Approval Center</Title>
          <Text className="page-subtitle">Review and approve pending documents (PO, Adjustments, etc.)</Text>
        </div>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={[
          {
            key: 'pending',
            label: 'Pending Approvals',
            children: (
               <Card className="stat-card">
                <Table columns={pendingColumns} dataSource={pendingData?.data || []} rowKey="id" size="small" loading={pendingLoading} pagination={{ pageSize: 20 }} />
              </Card>
            )
          },
          {
            key: 'history',
            label: <span><HistoryOutlined /> History</span>,
            children: (
               <Card className="stat-card">
                <Table columns={historyColumns} dataSource={historyData?.data || []} rowKey="id" size="small" loading={historyLoading} pagination={{ pageSize: 20 }} />
              </Card>
            )
          }
        ]}
      />

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
