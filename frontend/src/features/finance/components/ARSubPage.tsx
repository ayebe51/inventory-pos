import React from 'react';
import { Card, Table, Tag, Button, Typography, Space, Statistic, Row, Col, Modal, Input, message } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

const { Text } = Typography;

export const ARSubPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = React.useState<any>(null);
  const [isWriteOffOpen, setIsWriteOffOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');

  const { data: outstandingInvoices, isLoading } = useQuery({
    queryKey: ['finance', 'ar', 'outstanding'],
    queryFn: async () => {
      const res = await api.get('/api/v1/finance/ar/outstanding');
      return res.data.data || [];
    },
  });

  const writeOffMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await api.post(`/api/v1/finance/ar/invoices/${id}/write-off`, { reason });
      return res.data;
    },
    onSuccess: () => {
      message.success('Bad debt written off successfully');
      queryClient.invalidateQueries({ queryKey: ['finance', 'ar', 'outstanding'] });
      setIsWriteOffOpen(false);
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to write off bad debt');
    },
  });

  const totalOutstanding = (outstandingInvoices || []).reduce((s: number, i: any) => s + (i.outstanding_amount || 0), 0);
  const overdueCount = (outstandingInvoices || []).filter((i: any) => i.days_overdue > 0).length;

  const columns = [
    {
      title: 'INVOICE #',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (text: string) => <Text style={{ fontWeight: 700 }}>{text}</Text>,
    },
    {
      title: 'CUSTOMER',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: 'DUE DATE',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (d: string) => (d ? new Date(d).toLocaleDateString('id-ID') : '—'),
    },
    {
      title: 'DAYS OVERDUE',
      dataIndex: 'days_overdue',
      key: 'days_overdue',
      render: (days: number) => (
        <Tag color={days > 90 ? 'red' : days > 30 ? 'orange' : days > 0 ? 'gold' : 'green'}>
          {days > 0 ? `${days} days` : 'Current'}
        </Tag>
      ),
    },
    {
      title: 'OUTSTANDING (RP)',
      dataIndex: 'outstanding_amount',
      key: 'outstanding_amount',
      align: 'right' as const,
      render: (val: number) => (
        <Text style={{ fontFamily: 'monospace', fontWeight: 700, color: '#EF4444' }}>
          Rp {(val || 0).toLocaleString('id-ID')}
        </Text>
      ),
    },
    {
      title: 'ACTION',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button
          danger
          size="small"
          onClick={() => {
            setSelectedInvoice(record);
            setIsWriteOffOpen(true);
          }}
        >
          Write Off
        </Button>
      ),
    },
  ];

  return (
    <div style={{ paddingTop: 12 }}>
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12}>
          <Card bodyStyle={{ padding: 20 }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>TOTAL OUTSTANDING RECEIVABLES (AR)</Text>}
              value={totalOutstanding}
              precision={0}
              prefix="Rp"
              valueStyle={{ color: '#EF4444', fontWeight: 800 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card bodyStyle={{ padding: 20 }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>OVERDUE INVOICES</Text>}
              value={overdueCount}
              valueStyle={{ color: overdueCount > 0 ? '#F59E0B' : '#10B981', fontWeight: 800 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SafetyCertificateOutlined style={{ color: 'var(--brand-500)' }} />
            <span style={{ fontWeight: 700 }}>Accounts Receivable Outstanding Invoices</span>
          </div>
        }
        bodyStyle={{ padding: 20 }}
      >
        <Table
          dataSource={outstandingInvoices}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Write Off Bad Debt (AR)"
        open={isWriteOffOpen}
        onCancel={() => setIsWriteOffOpen(false)}
        onOk={() => {
          if (selectedInvoice) {
            writeOffMutation.mutate({ id: selectedInvoice.id, reason });
          }
        }}
        confirmLoading={writeOffMutation.isPending}
      >
        <Space direction="vertical" style={{ width: '100%', padding: '12px 0' }}>
          <Text>Are you sure you want to write off invoice <strong>{selectedInvoice?.invoice_number}</strong> of <strong>Rp {(selectedInvoice?.outstanding_amount || 0).toLocaleString('id-ID')}</strong>?</Text>
          <Text type="secondary">This will post a `WRITE_OFF_AR` journal entry to General Ledger.</Text>
          <Input.TextArea
            rows={3}
            placeholder="Reason for write off..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Space>
      </Modal>
    </div>
  );
};
