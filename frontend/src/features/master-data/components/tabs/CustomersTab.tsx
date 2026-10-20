import React, { useState } from 'react';
import {
  Table, Typography, Button, Input, Tag, Modal, Form, InputNumber, Space, Tooltip, Popconfirm, message, Select
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserOutlined, PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  FilterOutlined, PhoneOutlined, MailOutlined
} from '@ant-design/icons';
import { api } from '../../../../lib/api';
import { ActionableEmptyState } from '../../../../components/common/ActionableEmptyState';

const { Text } = Typography;
const { Option } = Select;

export const CustomersTab: React.FC = () => {
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
      const cleaned = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v === '' ? undefined : v])
      );
      if (editingCustomer) {
        return api.patch(`/api/v1/master-data/customers/${editingCustomer.id}`, cleaned);
      }
      return api.post('/api/v1/master-data/customers', cleaned);
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
      title: 'CUSTOMER NAME',
      dataIndex: 'name',
      render: (name: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--brand-100) 0%, var(--brand-50) 100%)',
            border: '1px solid var(--brand-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand-700)',
            fontWeight: 800,
            fontSize: 13
          }}>
            {getInitials(name)}
          </div>
          <div>
            <Text style={{ fontWeight: 700, fontSize: 14, display: 'block' }}>{name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>Verified Commercial Client</Text>
          </div>
        </div>
      )
    },
    {
      title: 'COMMUNICATION',
      key: 'contact',
      render: (_: any, r: any) => (
        <div>
          {r.email && (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
              <MailOutlined style={{ marginRight: 6, color: 'var(--brand-500)' }} />
              {r.email}
            </span>
          )}
          {r.phone && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginTop: 2 }}>
              <PhoneOutlined style={{ marginRight: 6, color: '#10B981' }} />
              {r.phone}
            </span>
          )}
          {!r.email && !r.phone && <Text type="secondary" style={{ fontSize: 12 }}>—</Text>}
        </div>
      )
    },
    {
      title: 'APPROVED CREDIT LIMIT',
      dataIndex: 'credit_limit',
      align: 'right' as const,
      render: (limit: number) => (
        <div>
          <Text className="number-display" style={{ fontWeight: 700, fontSize: 14 }}>
            {limit ? `Rp ${Number(limit).toLocaleString('id-ID')}` : 'Rp 0'}
          </Text>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Net 30 Days</div>
        </div>
      )
    },
    {
      title: 'ACCOUNT STATUS',
      dataIndex: 'is_active',
      align: 'center' as const,
      render: (active: boolean) => (
        <Tag
          color={active !== false ? 'success' : 'default'}
          style={{ borderRadius: 6, padding: '2px 8px', fontWeight: 600, fontSize: 11 }}
        >
          {active !== false ? 'ACTIVE' : 'INACTIVE'}
        </Tag>
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
              aria-label={`Edit customer ${r.name}`}
            />
          </Tooltip>
          <Popconfirm title="Deactivate customer?" onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              style={{ borderRadius: 8 }}
              aria-label={`Deactivate customer ${r.name}`}
            />
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
            aria-label="Cari pelanggan"
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
          aria-label="Tambah Pelanggan Baru"
        >
          Add Customer
        </Button>
      </div>

      {filteredData.length === 0 && !isLoading ? (
        <ActionableEmptyState
          title="No Customers Registered"
          description="Register B2B wholesale buyers or retail customers to assign custom pricing and credit limits."
          actionLabel="Add Customer"
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
          pagination={{ pageSize: 8 }}
          size="middle"
          style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        title={editingCustomer ? "Edit Customer Record" : "Register Enterprise Customer"}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingCustomer(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={mutation.isPending}
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Form.Item name="code" label="Customer Code" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="CUST-001" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="name" label="Business / Customer Name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="PT Nusantara Abadi" style={{ borderRadius: 8 }} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="email" label="Billing Email">
              <Input placeholder="finance@client.com" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="phone" label="WhatsApp / Phone">
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
