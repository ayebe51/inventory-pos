import React, { useState } from 'react';
import {
  Table, Button, Typography, Tag, Drawer, Form, Select, InputNumber, Row, Col, Space, Input, DatePicker, message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../../lib/api';
import { usePayments, useCreatePayment } from '../../invoicing/hooks/useInvoicing';

const { Title, Text } = Typography;

export const PaymentPage: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'RECEIPT' | 'VOUCHER'>('RECEIPT');
  const [form] = Form.useForm();

  const { data: paymentsData, isLoading, refetch } = usePayments({ payment_type: activeTab });
  const createPayment = useCreatePayment();

  const { data: customerData } = useQuery({
    queryKey: ['customers', 'payment-options'],
    queryFn: () => api.get('/api/v1/master-data/customers?per_page=100').then((r: any) => r.data),
    enabled: drawerOpen && activeTab === 'RECEIPT',
  });

  const { data: supplierData } = useQuery({
    queryKey: ['suppliers', 'payment-options'],
    queryFn: () => api.get('/api/v1/master-data/suppliers?per_page=100').then((r: any) => r.data),
    enabled: drawerOpen && activeTab === 'VOUCHER',
  });

  const { data: branchData } = useQuery({
    queryKey: ['branches', 'payment-options'],
    queryFn: () => api.get('/api/v1/organization/branches').then((r: any) => r.data),
  });

  const customers = customerData?.data || [];
  const suppliers = supplierData?.data || [];
  const branches = branchData?.data || [];

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const newPayment = {
        payment_type: activeTab,
        payment_date: values.payment_date.toISOString(),
        ...(activeTab === 'RECEIPT' ? { customer_id: values.partner_id } : { supplier_id: values.partner_id }),
        branch_id: values.branch_id || branches?.[0]?.id,
        amount: values.amount,
        reference: values.reference,
      };
      
      await createPayment.mutateAsync(newPayment);
      message.success('Payment recorded successfully');
      setDrawerOpen(false);
      form.resetFields();
      refetch();
    } catch (_) {}
  };

  const columns: ColumnsType<any> = [
    { title: 'Number', dataIndex: 'payment_number', render: (t) => <Text code style={{ color: '#10B981' }}>{t}</Text> },
    { title: 'Date', dataIndex: 'payment_date', render: (d) => d ? new Date(d).toLocaleDateString('id-ID') : '—' },
    {
      title: activeTab === 'RECEIPT' ? 'Customer' : 'Supplier',
      dataIndex: activeTab === 'RECEIPT' ? ['customer', 'name'] : ['supplier', 'name'],
      render: (v, r) => v || r.partner_name || '—',
    },
    { title: 'Amount', dataIndex: 'amount', align: 'right', render: (v) => <Text style={{ fontWeight: 600 }}>Rp {Number(v).toLocaleString('id-ID')}</Text> },
    { title: 'Type', dataIndex: 'payment_type', render: (m) => <Tag color="blue">{m}</Tag> },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={s === 'POSTED' ? 'green' : s === 'APPROVED' ? 'cyan' : 'orange'}>{s}</Tag> },
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
          <Button onClick={() => setActiveTab('VOUCHER')} type={activeTab === 'VOUCHER' ? 'primary' : 'default'}>AP Payments</Button>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)} style={{ marginLeft: 8 }}>
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
            <Button type="primary" onClick={handleSubmit} loading={createPayment.isPending}>Save Payment</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ payment_date: dayjs() }}>
          <Form.Item name="partner_id" label={activeTab === 'RECEIPT' ? 'Customer' : 'Supplier'} rules={[{ required: true }]}>
            <Select
              placeholder={`Select ${activeTab === 'RECEIPT' ? 'customer' : 'supplier'}`}
              showSearch
              allowClear
              optionFilterProp="label"
              options={(activeTab === 'RECEIPT' ? customers : suppliers).map((p: any) => ({
                value: p.id,
                label: `${p.code ? p.code + ' — ' : ''}${p.name}`,
              }))}
            />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="payment_date" label="Payment Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="branch_id" label="Branch" initialValue={branches?.[0]?.id}>
                <Select placeholder="Select Branch" options={branches.map((b: any) => ({ value: b.id, label: b.name }))} />
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
