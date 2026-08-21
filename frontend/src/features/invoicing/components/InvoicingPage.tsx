import React, { useState } from 'react';
import {
  Table, Tag, Button, Space, Typography, Card,
  Drawer, Form, Input, Select,
  Row, Col, Tooltip, message, Modal,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, SendOutlined, StopOutlined,
  ReloadOutlined, WarningOutlined, FallOutlined
} from '@ant-design/icons';
import { 
  useInvoices, useCreateInvoice, usePostInvoice, useCancelInvoice,
  useDisputeInvoice, useWriteOffInvoice 
} from '../hooks/useInvoicing';

const { Title, Text } = Typography;

const INVOICE_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  DRAFT:     { color: '#94A3B8', label: 'Draft' },
  OPEN:      { color: 'var(--brand-600)', label: 'Open' },
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
  const disputeInvoice = useDisputeInvoice();
  const writeOffInvoice = useWriteOffInvoice();

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
      render: (v) => <Text code style={{ color: 'var(--brand-600)' }}>{v}</Text>,
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
      render: (v) => <Text className="number-display" style={{ fontWeight: 600, }}>Rp {v?.toLocaleString('id-ID') ?? '—'}</Text>,
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
              <Button type="text" size="small" icon={<SendOutlined />} style={{ color: 'var(--brand-600)' }}
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
          {record.status === 'OVERDUE' && (
            <Tooltip title="Write Off">
              <Button type="text" size="small" icon={<FallOutlined />} style={{ color: '#475569' }}
                onClick={() => Modal.confirm({
                  title: 'Write Off Invoice?',
                  content: 'Are you sure you want to write off this bad debt?',
                  onOk: () => writeOffInvoice.mutate({ id: record.id, reason: 'Bad debt' }),
                  okButtonProps: { danger: true },
                })} />
            </Tooltip>
          )}
          {['OPEN', 'PARTIAL', 'OVERDUE'].includes(record.status) && (
            <Tooltip title="Dispute">
              <Button type="text" size="small" icon={<WarningOutlined />} style={{ color: '#FBBF24' }}
                onClick={() => Modal.confirm({
                  title: 'Dispute Invoice?',
                  content: 'Mark this invoice as disputed by the customer?',
                  onOk: () => disputeInvoice.mutate({ id: record.id, reason: 'Customer dispute' }),
                })} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const overdueCount = data?.data?.filter((i: any) => i.status === 'OVERDUE').length || 0;

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
          <span>Financial Billing & Invoicing</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} className="page-title" style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>
              Invoicing & Billing
            </Title>
            <Text className="page-subtitle" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Manage accounts receivable (AR) invoices, accounts payable (AP) vendor bills, and status tracking.
            </Text>
          </div>

          <Space size="middle">
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ borderRadius: 8 }}>
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setDrawerOpen(true)}
              style={{ height: 40, borderRadius: 10, fontWeight: 700, boxShadow: '0 4px 12px var(--brand-glow)' }}
            >
              Create Invoice
            </Button>
          </Space>
        </div>
      </div>

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
            onClick={() => setActiveTab('sales')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'sales' ? 'var(--solid-bg)' : 'transparent',
              color: activeTab === 'sales' ? 'var(--brand-600)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'sales' ? 700 : 600,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: activeTab === 'sales' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>Sales Invoices (AR)</span>
            {overdueCount > 0 && (
              <span style={{
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background: '#FEF2F2',
                color: '#EF4444'
              }}>
                {overdueCount} Overdue
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('purchase')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: activeTab === 'purchase' ? 'var(--solid-bg)' : 'transparent',
              color: activeTab === 'purchase' ? 'var(--brand-600)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'purchase' ? 700 : 600,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: activeTab === 'purchase' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>Purchase Bills (AP)</span>
          </button>
        </div>

        <Table
          columns={columns}
          dataSource={data?.data}
          loading={isLoading}
          rowKey="id"
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 10, showTotal: (t) => `${t} total invoices` }}
          size="middle"
          style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
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
