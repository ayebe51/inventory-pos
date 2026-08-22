import React from 'react';
import { Card, Table, Tag, Button, Typography, Statistic, Row, Col, Alert } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';

const { Text } = Typography;

export const ARSubPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: outstandingInvoices, isLoading } = useQuery({
    queryKey: ['finance', 'ar', 'outstanding'],
    queryFn: async () => {
      const res = await api.get('/api/v1/finance/ar/outstanding');
      return res.data.data || [];
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

      <Alert
        type="info"
        showIcon
        message="Untuk mengelola invoice, melunasi tagihan, atau melakukan write-off, gunakan halaman Invoicing & Billing."
        action={
          <Button size="small" type="primary" onClick={() => navigate('/invoicing')}>
            Buka Invoicing & Billing →
          </Button>
        }
        style={{ marginBottom: 20, borderRadius: 10 }}
      />

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
    </div>
  );
};
