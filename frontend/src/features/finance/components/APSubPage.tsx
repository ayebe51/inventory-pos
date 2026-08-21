import React from 'react';
import { Card, Table, Tag, Button, Typography, Space, Statistic, Row, Col, Modal, Form, InputNumber, message } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

const { Text } = Typography;

export const APSubPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedInvoice, setSelectedInvoice] = React.useState<any>(null);
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState<number>(0);

  const { data: outstandingPayables, isLoading } = useQuery({
    queryKey: ['finance', 'ap', 'outstanding'],
    queryFn: async () => {
      const res = await api.get('/api/v1/finance/ap/outstanding');
      return res.data.data || [];
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const res = await api.post(`/api/v1/finance/ap/invoices/${id}/payment`, {
        amount,
        payment_method_id: '11111111-1111-1111-1111-111111111111', // default payment method
      });
      return res.data;
    },
    onSuccess: () => {
      message.success('Supplier payment recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['finance', 'ap', 'outstanding'] });
      setIsPaymentOpen(false);
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to record supplier payment');
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
    {
      title: 'ACTION',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button
          type="primary"
          size="small"
          onClick={() => {
            setSelectedInvoice(record);
            setPayAmount(record.outstanding_amount);
            setIsPaymentOpen(true);
          }}
        >
          Pay Supplier
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

      <Modal
        title="Record Supplier Payment"
        open={isPaymentOpen}
        onCancel={() => setIsPaymentOpen(false)}
        onOk={() => {
          if (selectedInvoice && payAmount > 0) {
            paymentMutation.mutate({ id: selectedInvoice.id, amount: payAmount });
          }
        }}
        confirmLoading={paymentMutation.isPending}
      >
        <Space direction="vertical" style={{ width: '100%', padding: '12px 0' }}>
          <Text>Pay supplier <strong>{selectedInvoice?.supplier_name}</strong> for invoice <strong>{selectedInvoice?.invoice_number}</strong></Text>
          <Text type="secondary">Outstanding balance: Rp {(selectedInvoice?.outstanding_amount || 0).toLocaleString('id-ID')}</Text>
          <Form layout="vertical">
            <Form.Item label="Payment Amount (Rp)">
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                max={selectedInvoice?.outstanding_amount}
                value={payAmount}
                onChange={(val) => setPayAmount(val || 0)}
              />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  );
};
