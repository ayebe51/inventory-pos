import React, { useState } from 'react';
import {
  Tabs, Table, Tag, Button, Space, Typography, Card,
  Drawer, Form, Input, Select, InputNumber, Divider,
  Row, Col, Tooltip, Badge, Statistic, message, Modal,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, SendOutlined, StopOutlined, CheckCircleOutlined,
  SearchOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useInvoices, useCreateInvoice, usePostInvoice, useCancelInvoice } from '../hooks/useInvoicing';

const { Title, Text } = Typography;
const { Option } = Select;

const INVOICE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  DRAFT:     { color: '#94A3B8', label: 'Draft' },
  OPEN:      { color: '#8B5CF6', label: 'Open' },
  PARTIAL:   { color: '#F97316', label: 'Partial' },
  PAID:      { color: '#34D399', label: 'Paid' },
  OVERDUE:   { color: '#F43F5E', label: 'Overdue' },
  DISPUTED:  { color: '#FBBF24', label: 'Disputed' },
  CANCELLED: { color: '#64748B', label: 'Cancelled' },
  WRITTEN_OFF: { color: '#475569', label: 'Written Off' },
};

export const InvoicingPage: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'sales' | 'purchase'>('sales');
  const [form] = Form.useForm();

  const { data, isLoading, refetch } = useInvoices({ type: activeTab.toUpperCase() });
  const createInvoice = useCreateInvoice();
  const postInvoice = usePostInvoice();
  const cancelInvoice = useCancelInvoice();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await createInvoice.mutateAsync({ ...values, type: activeTab.toUpperCase() });
      message.success('Invoice created!');
      setDrawerOpen(false);
      form.resetFields();
    } catch (_) {}
  };

  const columns: ColumnsType<any> = [
    {
      title: 'Invoice #',
      dataIndex: 'invoice_number',
      width: 180,
      render: (v) => <Text code style={{ color: '#A78BFA' }}>{v}</Text>,
    },
    {
      title: activeTab === 'sales' ? 'Customer' : 'Supplier',
      dataIndex: activeTab === 'sales' ? ['customer', 'name'] : ['supplier', 'name'],
      ellipsis: true,
    },
    {
      title: 'Invoice Date',
      dataIndex: 'invoice_date',
      width: 130,
      render: (d) => d ? new Date(d).toLocaleDateString('id-ID') : '—',
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      width: 130,
      render: (d) => {
        if (!d) return '—';
        const isOverdue = new Date(d) < new Date();
        return <Text style={{ color: isOverdue ? '#F43F5E' : '#94A3B8' }}>{new Date(d).toLocaleDateString('id-ID')}</Text>;
      },
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      align: 'right',
      width: 180,
      render: (v) => <Text className="number-display" style={{ fontWeight: 600, color: '#E2E8F0' }}>Rp {v?.toLocaleString('id-ID') ?? '—'}</Text>,
    },
    {
      title: 'Outstanding',
      dataIndex: 'outstanding_amount',
      align: 'right',
      width: 160,
      render: (v) => <Text className="number-display" style={{ color: '#FBBF24' }}>Rp {v?.toLocaleString('id-ID') ?? '—'}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (status) => {
        const cfg = INVOICE_STATUS_CONFIG[status] || { color: '#94A3B8', label: status };
        return <Tag style={{ color: cfg.color, background: `${cfg.color}18`, borderColor: `${cfg.color}30` }}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'DRAFT' && (
            <Tooltip title="Post Invoice">
              <Button type="text" size="small" icon={<SendOutlined />} style={{ color: '#8B5CF6' }}
                onClick={() => postInvoice.mutate(record.id)} />
            </Tooltip>
          )}
          {['DRAFT', 'OPEN'].includes(record.status) && (
            <Tooltip title="Cancel">
              <Button type="text" size="small" icon={<StopOutlined />} danger
                onClick={() => Modal.confirm({
                  title: 'Cancel Invoice?',
                  content: 'This cannot be undone.',
                  onOk: () => cancelInvoice.mutate(record.id),
                  okButtonProps: { danger: true },
                })} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const tabs = [
    {
      key: 'sales',
      label: (
        <span>
          Sales Invoices (AR)
          <Badge count={data?.data?.filter((i: any) => i.status === 'OVERDUE').length} size="small" style={{ marginLeft: 8, background: '#F43F5E' }} />
        </span>
      ),
    },
    {
      key: 'purchase',
      label: 'Purchase Invoices (AP)',
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Invoicing</Title>
          <Text className="page-subtitle">Manage accounts receivable and accounts payable</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ color: '#94A3B8' }}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            Create Invoice
          </Button>
        </Space>
      </div>

      <Card className="stat-card">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as any)}
          items={tabs.map((tab) => ({
            ...tab,
            children: (
              <Table
                columns={columns}
                dataSource={data?.data}
                loading={isLoading}
                rowKey="id"
                scroll={{ x: 1000 }}
                pagination={{ pageSize: 15, showTotal: (t) => `${t} invoices` }}
                size="small"
              />
            ),
          }))}
        />
      </Card>

      <Drawer
        title={`Create ${activeTab === 'sales' ? 'Sales' : 'Purchase'} Invoice`}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={createInvoice.isPending} onClick={handleCreate}>Create Invoice</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name={activeTab === 'sales' ? 'customer_id' : 'supplier_id'} label={activeTab === 'sales' ? 'Customer' : 'Supplier'} rules={[{ required: true }]}>
            <Select placeholder={`Select ${activeTab === 'sales' ? 'customer' : 'supplier'}`} showSearch optionFilterProp="label" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="invoice_date" label="Invoice Date" rules={[{ required: true }]}>
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="due_date" label="Due Date">
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};
