import React from 'react';
import { Card, Table, Typography, Statistic, Row, Col, Button, Modal, Form, InputNumber, Input, Select, message } from 'antd';
import { BankOutlined, PlusOutlined, MinusOutlined, SwapOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

const { Text } = Typography;

export const CashBankSubPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalType, setModalType] = React.useState<'IN' | 'OUT' | 'TRANSFER' | null>(null);
  const [form] = Form.useForm();

  const { data: cashPosition, isLoading } = useQuery({
    queryKey: ['finance', 'cash-bank', 'position'],
    queryFn: async () => {
      const res = await api.get('/api/v1/finance/cash-bank/position');
      return res.data.data;
    },
  });

  const cashInMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await api.post('/api/v1/finance/cash-bank/cash-in', values);
      return res.data;
    },
    onSuccess: () => {
      message.success('Cash In recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['finance', 'cash-bank', 'position'] });
      setModalType(null);
      form.resetFields();
    },
  });

  const cashOutMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await api.post('/api/v1/finance/cash-bank/cash-out', values);
      return res.data;
    },
    onSuccess: () => {
      message.success('Cash Out recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['finance', 'cash-bank', 'position'] });
      setModalType(null);
      form.resetFields();
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await api.post('/api/v1/finance/cash-bank/transfer', values);
      return res.data;
    },
    onSuccess: () => {
      message.success('Inter-account transfer recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['finance', 'cash-bank', 'position'] });
      setModalType(null);
      form.resetFields();
    },
  });

  const columns = [
    {
      title: 'ACCOUNT CODE',
      dataIndex: 'account_code',
      key: 'account_code',
      render: (code: string) => <Text style={{ fontFamily: 'monospace', fontWeight: 600 }}>{code}</Text>,
    },
    {
      title: 'ACCOUNT NAME',
      dataIndex: 'account_name',
      key: 'account_name',
      render: (name: string) => <Text style={{ fontWeight: 700 }}>{name}</Text>,
    },
    {
      title: 'CATEGORY',
      dataIndex: 'account_category',
      key: 'account_category',
    },
    {
      title: 'BALANCE (RP)',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right' as const,
      render: (bal: number) => (
        <Text style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--brand-600)' }}>
          Rp {(bal || 0).toLocaleString('id-ID')}
        </Text>
      ),
    },
  ];

  return (
    <div style={{ paddingTop: 12 }}>
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={16}>
          <Card bodyStyle={{ padding: 20 }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>TOTAL LIQUID CASH & BANK POSITION</Text>}
              value={cashPosition?.total_cash_balance || 0}
              precision={0}
              prefix="Rp"
              valueStyle={{ color: 'var(--brand-600)', fontWeight: 800, fontSize: 32 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Quick Cash Controls" bodyStyle={{ padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button icon={<PlusOutlined />} type="primary" onClick={() => setModalType('IN')}>
                Record Cash In
              </Button>
              <Button icon={<MinusOutlined />} onClick={() => setModalType('OUT')}>
                Record Cash Out
              </Button>
              <Button icon={<SwapOutlined />} onClick={() => setModalType('TRANSFER')}>
                Inter-Account Transfer
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BankOutlined style={{ color: 'var(--brand-500)' }} />
            <span style={{ fontWeight: 700 }}>Cash & Bank Accounts Ledger</span>
          </div>
        }
        bodyStyle={{ padding: 20 }}
      >
        <Table
          dataSource={cashPosition?.accounts}
          columns={columns}
          rowKey="account_id"
          loading={isLoading}
          pagination={false}
        />
      </Card>

      <Modal
        title={modalType === 'IN' ? 'Record Cash In' : modalType === 'OUT' ? 'Record Cash Out' : 'Inter-Account Transfer'}
        open={!!modalType}
        onCancel={() => setModalType(null)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            if (modalType === 'IN') cashInMutation.mutate(values);
            else if (modalType === 'OUT') cashOutMutation.mutate(values);
            else if (modalType === 'TRANSFER') transferMutation.mutate(values);
          }}
        >
          {modalType !== 'TRANSFER' ? (
            <Form.Item name="account_id" label="Account" rules={[{ required: true }]}>
              <Select placeholder="Select cash/bank account">
                {(cashPosition?.accounts || []).map((acc: any) => (
                  <Select.Option key={acc.account_id} value={acc.account_id}>
                    {acc.account_code} - {acc.account_name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <>
              <Form.Item name="from_account_id" label="From Account" rules={[{ required: true }]}>
                <Select placeholder="Select source account">
                  {(cashPosition?.accounts || []).map((acc: any) => (
                    <Select.Option key={acc.account_id} value={acc.account_id}>
                      {acc.account_code} - {acc.account_name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="to_account_id" label="To Account" rules={[{ required: true }]}>
                <Select placeholder="Select destination account">
                  {(cashPosition?.accounts || []).map((acc: any) => (
                    <Select.Option key={acc.account_id} value={acc.account_id}>
                      {acc.account_code} - {acc.account_name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
          <Form.Item name="amount" label="Amount (Rp)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="description" label="Description / Memo" rules={[{ required: true }]}>
            <Input placeholder="Enter details..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
