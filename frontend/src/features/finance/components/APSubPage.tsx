import React from 'react';
import { Card, Table, Tag, Button, Typography, Statistic, Row, Col, Alert } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';

const { Text } = Typography;

export const APSubPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: outstandingPayables, isLoading } = useQuery({
    queryKey: ['finance', 'ap', 'outstanding'],
    queryFn: async () => {
      const res = await api.get('/api/v1/finance/ap/outstanding');
      return res.data.data || [];
    },
  });

  const totalOutstanding = (outstandingPayables || []).reduce((s: number, i: any) => s + (i.outstanding_amount || 0), 0);
  const overdueCount = (outstandingPayables || []).filter((i: any) => i.days_overdue > 0).length;

  const columns = [
    {
      title: 'INVOICE #',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
      render: (text: string) => <Text style={{ fontWeight: 700 }}>{text}</Text>,
    },
    {
      title: 'SUPPLIER',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
    },
    {
      title: 'DUE DATE',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (d: string) => (d ? new Date(d).toLocaleDateString('id-ID') : '—'),
    },
    {
      title: 'STATUS',
      dataIndex: 'days_overdue',
      key: 'days_overdue',
      render: (days: number) => (
        <Tag color={days > 0 ? 'volcano' : 'blue'}>
          {days > 0 ? `${days} days overdue` : 'Due Soon'}
        </Tag>
      ),
    },
    {
      title: 'OUTSTANDING (RP)',
      dataIndex: 'outstanding_amount',
      key: 'outstanding_amount',
      align: 'right' as const,
      render: (val: number) => (
        <Text style={{ fontFamily: 'monospace', fontWeight: 700, color: '#3B82F6' }}>
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
              title={<Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>TOTAL OUTSTANDING PAYABLES (AP)</Text>}
              value={totalOutstanding}
              precision={0}
              prefix="Rp"
              valueStyle={{ color: '#3B82F6', fontWeight: 800 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card bodyStyle={{ padding: 20 }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>OVERDUE PAYABLES</Text>}
              value={overdueCount}
              valueStyle={{ color: overdueCount > 0 ? '#EF4444' : '#10B981', fontWeight: 800 }}
            />
          </Card>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        message="Untuk mencatat pembayaran ke supplier (AP) atau voucher pembayaran, gunakan halaman Pembayaran."
        action={
          <Button size="small" type="primary" onClick={() => navigate('/finance/payments')}>
            Buka Pembayaran (AR/AP) →
          </Button>
        }
        style={{ marginBottom: 20, borderRadius: 10 }}
      />

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOutlined style={{ color: 'var(--brand-500)' }} />
            <span style={{ fontWeight: 700 }}>Accounts Payable Outstanding Invoices</span>
          </div>
        }
        bodyStyle={{ padding: 20 }}
      >
        <Table
          dataSource={outstandingPayables}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};
