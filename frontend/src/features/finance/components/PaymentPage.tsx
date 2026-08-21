import React, { useState } from 'react';
import {
  Table, Button, Typography, Tag, Drawer, Form, Select, InputNumber, Row, Col, Space, Input, DatePicker
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import { usePayments, useCreatePayment } from '../../invoicing/hooks/useInvoicing';

const { Title, Text } = Typography;
const { Option } = Select;

export const PaymentPage: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'RECEIPT' | 'PAYMENT'>('RECEIPT');
  const [form] = Form.useForm();

  const { data: paymentsData, isLoading } = usePayments({ type: activeTab });
  const createPayment = useCreatePayment();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const newPayment = {
        type: activeTab,
        payment_date: values.payment_date.toISOString(),
        partner_id: values.partner_id || 'Unknown',
        amount: values.amount,
        payment_method: values.payment_method,
        reference: values.reference,
      };
      
      await createPayment.mutateAsync(newPayment);
      setDrawerOpen(false);
      form.resetFields();
    } catch (_) {}
  };

  const columns: ColumnsType<any> = [
    { title: 'Number', dataIndex: 'payment_number', render: (t) => <Text code style={{ color: '#10B981' }}>{t}</Text> },
    { title: 'Date', dataIndex: 'date', render: (d) => new Date(d).toLocaleDateString() },
    { title: activeTab === 'RECEIPT' ? 'Customer' : 'Supplier', dataIndex: 'partner_name' },
    { title: 'Amount', dataIndex: 'amount', align: 'right', render: (v) => <Text style={{ fontWeight: 600 }}>Rp {v.toLocaleString()}</Text> },
    { title: 'Method', dataIndex: 'method', render: (m) => <Tag color="blue">{m}</Tag> },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color="green">{s}</Tag> },
  ];

  const displayedData = paymentsData?.data || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Payments</Title>
          <Text className="page-subtitle">Manage incoming receipts (AR) and outgoing payments (AP)</Text>
        </div>
        <Space>
          <Button onClick={() => setActiveTab('RECEIPT')} type={activeTab === 'RECEIPT' ? 'primary' : 'default'}>AR Receipts</Button>
          <Button onClick={() => setActiveTab('PAYMENT')} type={activeTab === 'PAYMENT' ? 'primary' : 'default'}>AP Payments</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)} style={{ marginLeft: 16 }}>
            Record {activeTab === 'RECEIPT' ? 'Receipt' : 'Payment'}
          </Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={displayedData} rowKey="id" size="small" loading={isLoading} />

      <Drawer
        title={`Record ${activeTab === 'RECEIPT' ? 'Payment Receipt (AR)' : 'Payment Voucher (AP)'}`}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={500}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit}>Save Payment</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ payment_date: dayjs() }}>
          <Form.Item name="partner_id" label={activeTab === 'RECEIPT' ? 'Customer' : 'Supplier'} rules={[{ required: true }]}>
            <Input placeholder={`Enter ${activeTab === 'RECEIPT' ? 'Customer' : 'Supplier'} name or ID`} />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="payment_date" label="Payment Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="payment_method" label="Method" rules={[{ required: true }]}>
                <Select>
                  <Option value="BANK_TRANSFER">Bank Transfer</Option>
                  <Option value="CASH">Cash</Option>
                  <Option value="CREDIT_CARD">Credit Card</Option>
                  <Option value="CHECK">Check</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="amount" label="Amount (Rp)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>

          <Form.Item name="reference" label="Reference / Notes">
            <Input.TextArea rows={2} placeholder="Transaction ref or notes" />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};
