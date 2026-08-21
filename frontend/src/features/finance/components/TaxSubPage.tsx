import React from 'react';
import { Card, Typography, Statistic, Row, Col, Button, Modal, Form, InputNumber, Select, message } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

const { Text } = Typography;

export const TaxSubPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);
  const [form] = Form.useForm();

  const { data: taxSummary } = useQuery({
    queryKey: ['finance', 'tax', 'summary'],
    queryFn: async () => {
      const res = await api.get('/api/v1/finance/tax/summary');
      return res.data.data;
    },
  });

  const { data: cashPosition } = useQuery({
    queryKey: ['finance', 'cash-bank', 'position'],
    queryFn: async () => {
      const res = await api.get('/api/v1/finance/cash-bank/position');
      return res.data.data;
    },
  });

  const paymentMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await api.post('/api/v1/finance/tax/payment', values);
      return res.data;
    },
    onSuccess: () => {
      message.success('Tax payment recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['finance', 'tax', 'summary'] });
      setIsPaymentOpen(false);
      form.resetFields();
    },
  });

  return (
    <div style={{ paddingTop: 12 }}>
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: 20 }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>PPN KELUARAN (OUTPUT TAX)</Text>}
              value={taxSummary?.output_tax || 0}
              precision={0}
              prefix="Rp"
              valueStyle={{ color: '#EF4444', fontWeight: 800 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: 20 }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>PPN MASUKAN (INPUT TAX)</Text>}
              value={taxSummary?.input_tax || 0}
              precision={0}
              prefix="Rp"
              valueStyle={{ color: '#10B981', fontWeight: 800 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card bodyStyle={{ padding: 20 }}>
            <Statistic
              title={<Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>NET PPN PAYABLE TO STATE</Text>}
              value={taxSummary?.net_tax_payable || 0}
              precision={0}
              prefix="Rp"
              valueStyle={{ color: taxSummary?.net_tax_payable > 0 ? '#F59E0B' : '#10B981', fontWeight: 800 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileTextOutlined style={{ color: 'var(--brand-500)' }} />
              <span style={{ fontWeight: 700 }}>Tax Position & Settlement</span>
            </div>
            {taxSummary?.net_tax_payable > 0 && (
              <Button type="primary" onClick={() => setIsPaymentOpen(true)}>
                Record Tax Payment
              </Button>
            )}
          </div>
        }
        bodyStyle={{ padding: 20 }}
      >
        <Text>Period: <strong>{taxSummary?.period_name || 'Active Fiscal Period'}</strong></Text>
        <div style={{ marginTop: 16, padding: 16, background: 'var(--brand-50)', borderRadius: 12 }}>
          <Text style={{ display: 'block', marginBottom: 8 }}>
            PPN Keluaran represents value-added tax collected from customer sales, while PPN Masukan represents tax paid on business purchases.
          </Text>
          <Text type="secondary">
            Net Tax Payable = Output Tax - Input Tax. When net tax payable is positive, it must be remitted to Kas Negara.
          </Text>
        </div>
      </Card>

      <Modal
        title="Record PPN Tax Remittance"
        open={isPaymentOpen}
        onCancel={() => setIsPaymentOpen(false)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ amount: taxSummary?.net_tax_payable }}
          onFinish={(values) => paymentMutation.mutate(values)}
        >
          <Form.Item name="amount" label="Remittance Amount (Rp)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="bank_account_id" label="Paid From Bank Account" rules={[{ required: true }]}>
            <Select placeholder="Select bank account">
              {(cashPosition?.accounts || []).map((acc: any) => (
                <Select.Option key={acc.account_id} value={acc.account_id}>
                  {acc.account_code} - {acc.account_name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
