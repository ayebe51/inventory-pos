import React, { useState } from 'react';
import { Table, Button, Typography, Tag, Space, Card, Modal, Input, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { api } from '../../../lib/api';
import { ActionableEmptyState } from '../../../components/common/ActionableEmptyState';

const { Title, Text } = Typography;

export const ApprovalPage: React.FC = () => {
  const qc = useQueryClient();
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

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
    onSuccess: () => {
      message.success('Permintaan disetujui');
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Gagal menyetujui permintaan');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => api.post(`/api/v1/approvals/${id}/reject`, { reason }),
    onSuccess: () => {
      message.success('Permintaan ditolak');
      qc.invalidateQueries({ queryKey: ['approvals'] });
      setRejectModalOpen(false);
      setRejectReason('');
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Gagal menolak permintaan');
      setRejectModalOpen(false);
    }
  });

  const handleReject = () => {
    if (selectedId && rejectReason) {
      rejectMutation.mutate({ id: selectedId, reason: rejectReason });
    }
  };

  const getStatusTag = (status: string) => {
    switch(status) {
      case 'PENDING':
        return (
          <Tag style={{ color: '#F59E0B', background: '#FEF3C7', borderColor: '#FDE68A', borderRadius: 6, fontWeight: 600 }}>
            Pending
          </Tag>
        );
      case 'APPROVED':
        return (
          <Tag style={{ color: '#10B981', background: '#D1FAE5', borderColor: '#A7F3D0', borderRadius: 6, fontWeight: 600 }}>
            Approved
          </Tag>
        );
      case 'REJECTED':
        return (
          <Tag style={{ color: '#EF4444', background: '#FEF2F2', borderColor: '#FECACA', borderRadius: 6, fontWeight: 600 }}>
            Rejected
          </Tag>
        );
      default:
        return <Tag style={{ borderRadius: 6 }}>{status}</Tag>;
    }
  };

  const pendingList = pendingData?.data || [];
  const historyList = historyData?.data || [];

  const pendingColumns: ColumnsType<any> = [
    {
      title: 'REQUEST DATE',
      dataIndex: 'created_at',
      width: 140,
      render: (d) => (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {d ? new Date(d).toLocaleDateString('id-ID') : '—'}
        </span>
      )
    },
    {
      title: 'DOCUMENT TYPE',
      dataIndex: 'document_type',
      width: 180,
      render: (t) => (
        <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
          {t?.replace(/_/g, ' ')}
        </Tag>
      )
    },
    {
      title: 'REFERENCE ID',
      dataIndex: 'reference_id',
      render: (t) => (
        <span style={{
          padding: '2px 8px',
          background: 'var(--solid-bg-subtle)',
          border: '1px solid var(--solid-border)',
          borderRadius: 6,
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 12,
          color: 'var(--brand-600)',
          fontWeight: 600
        }}>
          {t ? `${t.substring(0, 12)}...` : '—'}
        </span>
      )
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      width: 120,
      render: getStatusTag
    },
    {
      title: 'ACTION',
      key: 'action',
      width: 180,
      align: 'right',
      render: (_, record) => (
        <Space size={8}>
          <Button
            size="small"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => approveMutation.mutate(record.id)}
            loading={approveMutation.isPending}
            style={{ borderRadius: 6, fontWeight: 600, background: '#10B981', borderColor: '#10B981' }}
          >
            Approve
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => { setSelectedId(record.id); setRejectModalOpen(true); }}
            style={{ borderRadius: 6, fontWeight: 600 }}
          >
            Reject
          </Button>
        </Space>
      ),
    },
  ];

  const historyColumns: ColumnsType<any> = [
    {
      title: 'DECISION DATE',
      dataIndex: 'updated_at',
      width: 140,
      render: (d) => (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {d ? new Date(d).toLocaleDateString('id-ID') : '—'}
        </span>
      )
    },
    {
      title: 'DOCUMENT TYPE',
      dataIndex: 'document_type',
      width: 180,
      render: (t) => (
        <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600, fontSize: 12 }}>
          {t?.replace(/_/g, ' ')}
        </Tag>
      )
    },
    {
      title: 'REFERENCE ID',
      dataIndex: 'reference_id',
      render: (t) => (
        <span style={{
          padding: '2px 8px',
          background: 'var(--solid-bg-subtle)',
          border: '1px solid var(--solid-border)',
          borderRadius: 6,
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: 12,
          color: 'var(--brand-600)',
          fontWeight: 600
        }}>
          {t ? `${t.substring(0, 12)}...` : '—'}
        </span>
      )
    },
    {
      title: 'FINAL STATUS',
      dataIndex: 'status',
      width: 130,
      render: getStatusTag
    },
    {
      title: 'NOTES / DECISION',
      key: 'my_decision',
      render: (_, record) => {
        const decidedStep = record.steps?.find((s: any) => s.status !== 'PENDING');
        if (decidedStep) {
          return (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {decidedStep.notes || '—'}
            </span>
          );
        }
        return '—';
      }
    },
  ];

  return (
    <div className="page-container" style={{ paddingBottom: 40 }}>
      {/* Eyebrow Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 999,
          background: 'var(--brand-50)',
          border: '1px solid var(--brand-200)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--brand-600)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 8
        }}>
          <SafetyCertificateOutlined />
          <span>Workflow & Governance Control</span>
        </div>

        <Title level={2} className="page-title" style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>
          Approval Center
        </Title>
        <Text className="page-subtitle" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Review, authorize, or reject pending operational documents, purchase orders, and inventory adjustments.
        </Text>
      </div>

      {/* Main Glass Card */}
      <Card
        bodyStyle={{ padding: 24 }}
        style={{
          borderRadius: 20,
          border: '1px solid var(--solid-border)',
          boxShadow: 'var(--shadow-sm)',
          background: 'var(--solid-bg)'
        }}
      >
        {/* Custom Pill Navigation Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 6,
          background: 'var(--solid-bg-subtle)',
          border: '1px solid var(--solid-border)',
          borderRadius: 14,
          marginBottom: 24,
          overflowX: 'auto'
        }}>
          <button
            onClick={() => setActiveTab('pending')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'pending' ? 'var(--solid-bg)' : 'transparent',
              color: activeTab === 'pending' ? 'var(--brand-600)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'pending' ? 700 : 600,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: activeTab === 'pending' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <ClockCircleOutlined />
            <span>Pending Approvals</span>
            <span style={{
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: activeTab === 'pending' ? 'var(--brand-50)' : 'var(--solid-border)',
              color: activeTab === 'pending' ? 'var(--brand-600)' : 'var(--text-tertiary)'
            }}>
              {pendingList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'history' ? 'var(--solid-bg)' : 'transparent',
              color: activeTab === 'history' ? 'var(--brand-600)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'history' ? 700 : 600,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: activeTab === 'history' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <HistoryOutlined />
            <span>Approval History</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'pending' && (
          pendingList.length === 0 && !pendingLoading ? (
            <ActionableEmptyState
              title="No Pending Approvals"
              description="All submitted purchase orders, stock opnames, and financial documents have been reviewed."
              icon={<FileTextOutlined />}
            />
          ) : (
            <Table
              columns={pendingColumns}
              dataSource={pendingList}
              rowKey="id"
              size="middle"
              loading={pendingLoading}
              pagination={{ pageSize: 10 }}
              style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
            />
          )
        )}

        {activeTab === 'history' && (
          historyList.length === 0 && !historyLoading ? (
            <ActionableEmptyState
              title="No Approval History"
              description="Past approval decisions and document audit logs will appear here."
              icon={<HistoryOutlined />}
            />
          ) : (
            <Table
              columns={historyColumns}
              dataSource={historyList}
              rowKey="id"
              size="middle"
              loading={historyLoading}
              pagination={{ pageSize: 10 }}
              style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
            />
          )
        )}
      </Card>

      {/* Reject Reason Modal */}
      <Modal
        title="Reject Document Request"
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={() => { setRejectModalOpen(false); setRejectReason(''); }}
        confirmLoading={rejectMutation.isPending}
        okButtonProps={{ danger: true, disabled: !rejectReason.trim() }}
        okText="Reject Document"
        width={440}
        destroyOnClose
      >
        <div style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
            Please enter a reason for rejecting this document request. This note will be recorded in the audit trail.
          </Text>
          <Input.TextArea
            rows={3}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (required)..."
            style={{ borderRadius: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default ApprovalPage;
