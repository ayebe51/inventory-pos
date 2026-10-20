import React, { useState } from 'react';
import {
  Table, Typography, Button, Input, Tag, Modal, Form, InputNumber, Tooltip, message
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShopOutlined, PlusOutlined, SearchOutlined, EditOutlined,
  PhoneOutlined, MailOutlined, EnvironmentOutlined
} from '@ant-design/icons';
import { api } from '../../../../lib/api';
import { ActionableEmptyState } from '../../../../components/common/ActionableEmptyState';

const { Text } = Typography;

export const SuppliersTab: React.FC = () => {
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
      const cleaned = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v === '' ? undefined : v])
      );
      if (editingSupplier) {
        return api.patch(`/api/v1/master-data/suppliers/${editingSupplier.id}`, cleaned);
      }
      return api.post('/api/v1/master-data/suppliers', cleaned);
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
      title: 'VENDOR / SUPPLIER NAME',
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
            color: 'var(--brand-800)',
            fontWeight: 800,
            fontSize: 13
          }}>
            {getInitials(name)}
          </div>
          <div>
            <Text style={{ fontWeight: 700, fontSize: 14, display: 'block' }}>{name}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>Authorized Sourcing Partner</Text>
          </div>
        </div>
      )
    },
    {
      title: 'CONTACT & LOCATION',
      key: 'contact',
      render: (_: any, r: any) => {
        const phone = r.phone || r.phone_number;
        return (
          <div>
            {r.email && (
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', fontWeight: 500 }}>
                <MailOutlined style={{ marginRight: 6, color: 'var(--brand-500)' }} />
                {r.email}
              </span>
            )}
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
        );
      }
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
            aria-label={`Edit supplier ${r.name}`}
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
          aria-label="Cari supplier"
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
          aria-label="Tambah Supplier Baru"
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

      {/* Add / Edit Modal */}
      <Modal
        title={editingSupplier ? "Edit Sourcing Partner" : "Register Procurement Vendor"}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingSupplier(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={mutation.isPending}
        destroyOnHidden
        width={540}
      >
        <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Form.Item name="code" label="Vendor Code" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="VND-001" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="name" label="Legal Vendor Entity" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="PT Indofood Sukses Makmur" style={{ borderRadius: 8 }} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="email" label="Contact Email">
              <Input placeholder="sales@vendor.com" style={{ borderRadius: 8 }} />
            </Form.Item>
            <Form.Item name="phone" label="Phone / WhatsApp">
              <Input placeholder="021-5551234" style={{ borderRadius: 8 }} />
            </Form.Item>
          </div>
          <Form.Item name="payment_terms_days" label="Default Net Terms (Days)">
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
