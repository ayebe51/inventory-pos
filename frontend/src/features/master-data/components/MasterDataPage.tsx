import React, { useState } from 'react';
import {
  Table, Typography, Card, Button, Input, Tag, Modal, Form, InputNumber, Space, Tooltip, Popconfirm, message, Select
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShopOutlined, UserOutlined, AppstoreOutlined, HomeOutlined,
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  LockOutlined, UnlockOutlined, FilterOutlined,
  PhoneOutlined, MailOutlined, EnvironmentOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { api } from '../../../lib/api';
import { ActionableEmptyState } from '../../../components/common/ActionableEmptyState';

const { Title, Text } = Typography;
const { Option } = Select;

// --- CUSTOMERS MANAGER ---
const CustomerManager: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get('/api/v1/master-data/customers').then(r => r.data)
  });

  const mutation = useMutation({
    mutationFn: (values: any) => {
      if (editingCustomer) {
        return api.patch(`/api/v1/master-data/customers/${editingCustomer.id}`, values);
      }
      return api.post('/api/v1/master-data/customers', values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      message.success(editingCustomer ? 'Customer updated successfully' : 'New customer registered');
      setIsModalOpen(false);
      setEditingCustomer(null);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to save customer');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/master-data/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      message.success('Customer deactivated');
    }
  });

  const rawList = data?.data || (Array.isArray(data) ? data : []);
  const filteredData = rawList.filter((c: any) => {
    const matchesSearch =
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.code?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search);
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && c.is_active !== false) ||
      (statusFilter === 'inactive' && c.is_active === false);
    return matchesSearch && matchesStatus;
  });

  const getInitials = (name: string) => {
    if (!name) return 'CU';
    const parts = name.split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const columns = [
    {
      title: 'CUSTOMER CODE',
      dataIndex: 'code',
      width: 140,
      render: (t: string) => (
        <span style={{
          padding: '4px 10px',
          background: 'var(--brand-50)',
          color: 'var(--brand-600)',
          border: '1px solid var(--brand-200)',
          borderRadius: 8,
          fontFamily: 'var(--font-mono, monospace)',
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: '0.04em'
        }}>
          {t}
        </span>
      )
    },
    {
      title: 'CUSTOMER ENTITY',
      dataIndex: 'name',
      render: (name: string, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--brand-500) 0%, #4F46E5 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(99,102,241,0.2)'
          }}>
            {getInitials(name)}
          </div>
          <div>
            <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'block', lineHeight: 1.3 }}>
              {name}
            </Text>
            {r.email && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MailOutlined style={{ fontSize: 10 }} />
                {r.email}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      title: 'CONTACT & ADDRESS',
      dataIndex: 'phone',
      render: (phone: string, r: any) => (
        <div>
          {phone ? (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
              <PhoneOutlined style={{ marginRight: 6, color: 'var(--brand-500)' }} />
              {phone}
            </span>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
          )}
          {r.address && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginTop: 2 }}>
              <EnvironmentOutlined style={{ marginRight: 4 }} />
              {r.address}
            </span>
          )}
        </div>
      )
    },
    {
      title: 'CREDIT LIMIT',
      dataIndex: 'credit_limit',
      align: 'right' as const,
      render: (v: number) => (
        <div style={{ textAlign: 'right' }}>
          <Text style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
            Rp {Number(v || 0).toLocaleString('id-ID')}
          </Text>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Approved Limit
          </div>
        </div>
      )
    },
    {
      title: 'OUTSTANDING',
      dataIndex: 'outstanding_balance',
      align: 'right' as const,
      render: (v: number) => {
        const val = Number(v || 0);
        return (
          <div style={{ textAlign: 'right' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              background: val > 0 ? '#FEF3C7' : 'var(--solid-bg-subtle)',
              color: val > 0 ? '#D97706' : 'var(--text-secondary)',
              border: `1px solid ${val > 0 ? '#FCD34D' : 'var(--solid-border)'}`
            }}>
              Rp {val.toLocaleString('id-ID')}
            </span>
          </div>
        );
      }
    },
    {
      title: 'STATUS',
      dataIndex: 'is_active',
      align: 'center' as const,
      render: (active: boolean) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: active !== false ? '#10B981' : '#EF4444',
            boxShadow: active !== false ? '0 0 6px rgba(16,185,129,0.5)' : 'none'
          }} />
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: active !== false ? '#059669' : '#DC2626'
          }}>
            {active !== false ? 'Active' : 'Inactive'}
          </span>
        </div>
      )
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      align: 'center' as const,
      width: 100,
      render: (_: any, r: any) => (
        <Space size="small">
          <Tooltip title="Edit Customer Details">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: 'var(--brand-600)' }} />}
              onClick={() => {
                setEditingCustomer(r);
                form.setFieldsValue(r);
                setIsModalOpen(true);
              }}
              style={{ borderRadius: 8 }}
            />
          </Tooltip>
          <Popconfirm title="Deactivate customer?" onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* Control Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 20,
        padding: '16px 20px',
        background: 'var(--solid-bg-subtle)',
        borderRadius: 14,
        border: '1px solid var(--solid-border)'
      }}>
        <Space size="middle" wrap style={{ flex: 1 }}>
          <Input
            placeholder="Search code, name, phone..."
            prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)', marginRight: 6 }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, borderRadius: 10 }}
            allowClear
          />
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            style={{ width: 140 }}
            suffixIcon={<FilterOutlined style={{ color: 'var(--text-tertiary)' }} />}
          >
            <Option value="all">All Status</Option>
            <Option value="active">Active Only</Option>
            <Option value="inactive">Inactive</Option>
          </Select>
        </Space>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingCustomer(null);
            form.resetFields();
            setIsModalOpen(true);
          }}
          style={{
            height: 40,
            padding: '0 20px',
            borderRadius: 10,
            fontWeight: 700,
            boxShadow: '0 4px 12px var(--brand-glow)'
          }}
        >
          Add Customer
        </Button>
      </div>

      {/* Table / Empty State */}
      {filteredData.length === 0 && !isLoading ? (
        <ActionableEmptyState
          title="No Customers Found"
          description="Add your business partners to manage sales orders, credit limits, and invoicing."
          actionLabel="Add New Customer"
          onAction={() => {
            setEditingCustomer(null);
            form.resetFields();
            setIsModalOpen(true);
          }}
          icon={<UserOutlined />}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          size="middle"
          style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
        />
      )}

      {/* Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--brand-gradient)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <UserOutlined />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {editingCustomer ? 'Edit Customer' : 'Register New Customer'}
            </span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); setEditingCustomer(null); }}
        onOk={() => form.submit()}
        confirmLoading={mutation.isPending}
        destroyOnClose
        width={520}
        okText={editingCustomer ? 'Save Changes' : 'Create Customer'}
      >
        <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Form.Item name="code" label="Customer Code" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="CUST-005" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="name" label="Full Customer Name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="PT Example Business" style={{ borderRadius: 8 }} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="email" label="Email Address">
              <Input placeholder="finance@company.com" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="phone" label="Phone Number">
              <Input placeholder="081234567890" style={{ borderRadius: 8 }} />
            </Form.Item>
          </div>
          <Form.Item name="credit_limit" label="Approved Credit Limit (Rp)">
            <InputNumber
              style={{ width: '100%', borderRadius: 8 }}
              min={0}
              placeholder="50.000.000"
              formatter={(v) => `Rp ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
            />
          </Form.Item>
          <Form.Item name="address" label="Street Address">
            <Input.TextArea rows={2} placeholder="Office address..." style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// --- SUPPLIERS MANAGER ---
const SupplierManager: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/api/v1/master-data/suppliers').then(r => r.data)
  });

  const mutation = useMutation({
    mutationFn: (values: any) => {
      if (editingSupplier) {
        return api.patch(`/api/v1/master-data/suppliers/${editingSupplier.id}`, values);
      }
      return api.post('/api/v1/master-data/suppliers', values);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      message.success(editingSupplier ? 'Supplier updated' : 'Supplier added');
      setIsModalOpen(false);
      setEditingSupplier(null);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to save supplier');
    }
  });

  const rawList = data?.data || (Array.isArray(data) ? data : []);
  const filteredData = rawList.filter((s: any) =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.code?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name: string) => {
    if (!name) return 'SU';
    const parts = name.split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const columns = [
    {
      title: 'SUPPLIER CODE',
      dataIndex: 'code',
      width: 140,
      render: (t: string) => (
        <span style={{
          padding: '4px 10px',
          background: 'var(--brand-50)',
          color: 'var(--brand-700)',
          border: '1px solid var(--brand-200)',
          borderRadius: 8,
          fontFamily: 'var(--font-mono, monospace)',
          fontWeight: 700,
          fontSize: 12
        }}>
          {t}
        </span>
      )
    },
    {
      title: 'SUPPLIER ENTITY',
      dataIndex: 'name',
      render: (name: string, r: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 13,
            flexShrink: 0
          }}>
            {getInitials(name)}
          </div>
          <div>
            <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'block', lineHeight: 1.3 }}>
              {name}
            </Text>
            {r.email && (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <MailOutlined style={{ fontSize: 10 }} />
                {r.email}
              </span>
            )}
          </div>
        </div>
      )
    },
    {
      title: 'CONTACT & LOCATION',
      dataIndex: 'phone',
      render: (phone: string, r: any) => (
        <div>
          {phone ? (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
              <PhoneOutlined style={{ marginRight: 6, color: '#10B981' }} />
              {phone}
            </span>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
          )}
          {r.address && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'block', marginTop: 2 }}>
              <EnvironmentOutlined style={{ marginRight: 4 }} />
              {r.address}
            </span>
          )}
        </div>
      )
    },
    {
      title: 'PAYMENT TERMS',
      dataIndex: 'payment_terms_days',
      align: 'center' as const,
      render: (days: number) => (
        <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 600 }}>
          {days || 30} Days Net
        </Tag>
      )
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      align: 'center' as const,
      width: 100,
      render: (_: any, r: any) => (
        <Tooltip title="Edit Supplier Details">
          <Button
            type="text"
            icon={<EditOutlined style={{ color: 'var(--brand-600)' }} />}
            onClick={() => {
              setEditingSupplier(r);
              form.setFieldsValue(r);
              setIsModalOpen(true);
            }}
            style={{ borderRadius: 8 }}
          />
        </Tooltip>
      )
    }
  ];

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 20,
        padding: '16px 20px',
        background: 'var(--solid-bg-subtle)',
        borderRadius: 14,
        border: '1px solid var(--solid-border)'
      }}>
        <Input
          placeholder="Search supplier name, code..."
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)', marginRight: 6 }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, borderRadius: 10 }}
          allowClear
        />

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingSupplier(null);
            form.resetFields();
            setIsModalOpen(true);
          }}
          style={{
            height: 40,
            padding: '0 20px',
            borderRadius: 10,
            fontWeight: 700,
            boxShadow: '0 4px 12px var(--brand-glow)'
          }}
        >
          Add Supplier
        </Button>
      </div>

      {filteredData.length === 0 && !isLoading ? (
        <ActionableEmptyState
          title="No Suppliers Found"
          description="Register vendors to generate purchase requests, purchase orders, and track deliveries."
          actionLabel="Add New Supplier"
          onAction={() => {
            setEditingSupplier(null);
            form.resetFields();
            setIsModalOpen(true);
          }}
          icon={<ShopOutlined />}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 8 }}
          size="middle"
          style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
        />
      )}

      <Modal
        title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); setEditingSupplier(null); }}
        onOk={() => form.submit()}
        confirmLoading={mutation.isPending}
        destroyOnClose
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)} style={{ marginTop: 16 }}>
          <Form.Item name="code" label="Supplier Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="SUPP-004" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="name" label="Supplier Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="PT Example Supplier" style={{ borderRadius: 8 }} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="email" label="Email Address">
              <Input placeholder="sales@supplier.co.id" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="phone" label="Phone Number">
              <Input placeholder="021-5550199" style={{ borderRadius: 8 }} />
            </Form.Item>
          </div>
          <Form.Item name="payment_terms_days" label="Payment Terms (Days)">
            <InputNumber style={{ width: '100%', borderRadius: 8 }} min={0} defaultValue={30} />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea rows={2} placeholder="Warehouse / office address..." style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// --- WAREHOUSES MANAGER ---
const WarehouseManager: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/api/v1/warehouses').then(r => r.data)
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => api.post('/api/v1/warehouses', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      message.success('Warehouse created');
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to create warehouse');
    }
  });

  const toggleLock = useMutation({
    mutationFn: ({ id, isLocked }: { id: string; isLocked: boolean }) =>
      api.post(`/api/v1/warehouses/${id}/${isLocked ? 'unlock' : 'lock'}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      message.success('Warehouse lock status updated');
    }
  });

  const rawList = data?.data || (Array.isArray(data) ? data : []);
  const filteredData = rawList.filter((w: any) =>
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.code?.toLowerCase().includes(search.toLowerCase()) ||
    w.address?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      title: 'WAREHOUSE CODE',
      dataIndex: 'code',
      width: 160,
      render: (t: string) => (
        <span style={{
          padding: '4px 10px',
          background: 'var(--brand-50)',
          color: 'var(--brand-600)',
          border: '1px solid var(--brand-200)',
          borderRadius: 8,
          fontFamily: 'var(--font-mono, monospace)',
          fontWeight: 700,
          fontSize: 12
        }}>
          {t}
        </span>
      )
    },
    {
      title: 'LOCATION NAME',
      dataIndex: 'name',
      render: (name: string) => <Text style={{ fontWeight: 700, fontSize: 14 }}>{name}</Text>
    },
    {
      title: 'PHYSICAL ADDRESS',
      dataIndex: 'address',
      render: (addr: string) => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <EnvironmentOutlined style={{ marginRight: 6, color: 'var(--brand-500)' }} />
          {addr || '—'}
        </span>
      )
    },
    {
      title: 'LOCK STATUS',
      dataIndex: 'is_locked',
      align: 'center' as const,
      render: (locked: boolean) => (
        <Tag
          color={locked ? 'red' : 'green'}
          icon={locked ? <LockOutlined /> : <UnlockOutlined />}
          style={{ borderRadius: 6, fontWeight: 600, padding: '2px 8px' }}
        >
          {locked ? 'Locked (Opname)' : 'Active (Open)'}
        </Tag>
      )
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      align: 'center' as const,
      width: 160,
      render: (_: any, r: any) => (
        <Button
          size="small"
          danger={!r.is_locked}
          onClick={() => toggleLock.mutate({ id: r.id, isLocked: r.is_locked })}
          loading={toggleLock.isPending}
          style={{ borderRadius: 6, fontWeight: 600 }}
        >
          {r.is_locked ? 'Unlock Location' : 'Lock Location'}
        </Button>
      )
    }
  ];

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 20,
        padding: '16px 20px',
        background: 'var(--solid-bg-subtle)',
        borderRadius: 14,
        border: '1px solid var(--solid-border)'
      }}>
        <Input
          placeholder="Search warehouse code, location..."
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)', marginRight: 6 }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, borderRadius: 10 }}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { form.resetFields(); setIsModalOpen(true); }}
          style={{
            height: 40,
            padding: '0 20px',
            borderRadius: 10,
            fontWeight: 700,
            boxShadow: '0 4px 12px var(--brand-glow)'
          }}
        >
          Add Warehouse
        </Button>
      </div>

      {filteredData.length === 0 && !isLoading ? (
        <ActionableEmptyState
          title="No Warehouses Configured"
          description="Create warehouse locations to track stock levels, transfers, and opnames."
          actionLabel="Add Warehouse"
          onAction={() => { form.resetFields(); setIsModalOpen(true); }}
          icon={<HomeOutlined />}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 8 }}
          size="middle"
          style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
        />
      )}

      <Modal
        title="Add New Warehouse Location"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)} style={{ marginTop: 16 }}>
          <Form.Item name="code" label="Warehouse Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="WH-SOUTH" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="name" label="Warehouse Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Gudang Utama Bandung" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="address" label="Physical Address">
            <Input.TextArea rows={2} placeholder="Full warehouse location address..." style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// --- CATEGORIES MANAGER ---
const CategoryManager: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/v1/master-data/categories').then(r => r.data)
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => api.post('/api/v1/master-data/categories', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      message.success('Category created');
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to create category');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/master-data/categories/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      message.success('Category deleted');
    }
  });

  const rawList = data?.data || (Array.isArray(data) ? data : []);
  const filteredData = rawList.filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      title: 'CATEGORY CODE',
      dataIndex: 'code',
      width: 160,
      render: (t: string) => (
        <span style={{
          padding: '4px 10px',
          background: 'var(--brand-50)',
          color: 'var(--brand-600)',
          border: '1px solid var(--brand-200)',
          borderRadius: 8,
          fontFamily: 'var(--font-mono, monospace)',
          fontWeight: 700,
          fontSize: 12
        }}>
          {t}
        </span>
      )
    },
    {
      title: 'CATEGORY TAXONOMY NAME',
      dataIndex: 'name',
      render: (name: string) => <Text style={{ fontWeight: 700, fontSize: 14 }}>{name}</Text>
    },
    {
      title: 'STATUS',
      dataIndex: 'is_active',
      align: 'center' as const,
      render: (active: boolean) => (
        <Tag color={active !== false ? 'success' : 'default'} style={{ borderRadius: 6, fontWeight: 600 }}>
          {active !== false ? 'Active' : 'Inactive'}
        </Tag>
      )
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      align: 'center' as const,
      width: 100,
      render: (_: any, r: any) => (
        <Popconfirm title="Delete this category?" onConfirm={() => deleteMutation.mutate(r.id)}>
          <Button type="text" danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }} />
        </Popconfirm>
      )
    }
  ];

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 20,
        padding: '16px 20px',
        background: 'var(--solid-bg-subtle)',
        borderRadius: 14,
        border: '1px solid var(--solid-border)'
      }}>
        <Input
          placeholder="Search category code, name..."
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)', marginRight: 6 }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, borderRadius: 10 }}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { form.resetFields(); setIsModalOpen(true); }}
          style={{
            height: 40,
            padding: '0 20px',
            borderRadius: 10,
            fontWeight: 700,
            boxShadow: '0 4px 12px var(--brand-glow)'
          }}
        >
          Add Category
        </Button>
      </div>

      {filteredData.length === 0 && !isLoading ? (
        <ActionableEmptyState
          title="No Categories Configured"
          description="Group your products into categories for easy inventory tracking."
          actionLabel="Add Category"
          onAction={() => { form.resetFields(); setIsModalOpen(true); }}
          icon={<AppstoreOutlined />}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 8 }}
          size="middle"
          style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
        />
      )}

      <Modal
        title="Add Product Category"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
        width={460}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)} style={{ marginTop: 16 }}>
          <Form.Item name="code" label="Category Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="CAT-ELEC" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="name" label="Category Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Electronics & Gadgets" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// --- MAIN MASTER DATA PAGE ---
export const MasterDataPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('customers');

  const { data: custData } = useQuery({ queryKey: ['customers'], queryFn: () => api.get('/api/v1/master-data/customers').then(r => r.data) });
  const { data: suppData } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/api/v1/master-data/suppliers').then(r => r.data) });
  const { data: whData } = useQuery({ queryKey: ['warehouses'], queryFn: () => api.get('/api/v1/warehouses').then(r => r.data) });
  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/api/v1/master-data/categories').then(r => r.data) });

  const custCount = (custData?.data || (Array.isArray(custData) ? custData : [])).length;
  const suppCount = (suppData?.data || (Array.isArray(suppData) ? suppData : [])).length;
  const whCount = (whData?.data || (Array.isArray(whData) ? whData : [])).length;
  const catCount = (catData?.data || (Array.isArray(catData) ? catData : [])).length;

  const tabItems = [
    { key: 'customers', label: 'Customers', icon: <UserOutlined />, count: custCount },
    { key: 'suppliers', label: 'Suppliers', icon: <ShopOutlined />, count: suppCount },
    { key: 'warehouses', label: 'Warehouses', icon: <HomeOutlined />, count: whCount },
    { key: 'categories', label: 'Categories', icon: <AppstoreOutlined />, count: catCount },
  ];

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
          <SafetyCertificateOutlined />
          <span>Core Infrastructure Registry</span>
        </div>

        <Title level={2} className="page-title" style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>
          Master Data Directory
        </Title>
        <Text className="page-subtitle" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Manage global entities, business partners, product taxonomy, and warehouse infrastructure.
        </Text>
      </div>

      {/* Main Glass Card */}
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
          {tabItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: isActive ? 'var(--solid-bg)' : 'transparent',
                  color: isActive ? 'var(--brand-600)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: isActive ? 'var(--brand-50)' : 'rgba(0,0,0,0.05)',
                  color: isActive ? 'var(--brand-600)' : 'var(--text-tertiary)'
                }}>
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'customers' && <CustomerManager />}
        {activeTab === 'suppliers' && <SupplierManager />}
        {activeTab === 'warehouses' && <WarehouseManager />}
        {activeTab === 'categories' && <CategoryManager />}
      </Card>
    </div>
  );
};

export default MasterDataPage;
