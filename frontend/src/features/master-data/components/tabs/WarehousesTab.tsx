import React, { useState } from 'react';
import {
  Table, Typography, Button, Input, Tag, Modal, Form, Tooltip, message, Popconfirm
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  HomeOutlined, PlusOutlined, SearchOutlined, LockOutlined, UnlockOutlined, EnvironmentOutlined
} from '@ant-design/icons';
import { api } from '../../../../lib/api';
import { ActionableEmptyState } from '../../../../components/common/ActionableEmptyState';

const { Text } = Typography;

export const WarehousesTab: React.FC = () => {
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
          color={locked ? 'error' : 'success'}
          icon={locked ? <LockOutlined /> : <UnlockOutlined />}
          style={{ borderRadius: 6, padding: '2px 8px', fontWeight: 600, fontSize: 11 }}
        >
          {locked ? 'LOCKED (OPNAME)' : 'OPERATIONAL'}
        </Tag>
      )
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      align: 'center' as const,
      width: 120,
      render: (_: any, r: any) => (
        <Popconfirm
          title={r.is_locked ? "Unlock warehouse?" : "Lock warehouse for stock opname?"}
          onConfirm={() => toggleLock.mutate({ id: r.id, isLocked: r.is_locked })}
        >
          <Tooltip title={r.is_locked ? "Unlock Warehouse" : "Lock for Inventory Audit"}>
            <Button
              type="text"
              icon={r.is_locked ? <UnlockOutlined style={{ color: '#10B981' }} /> : <LockOutlined style={{ color: '#EF4444' }} />}
              style={{ borderRadius: 8 }}
              aria-label={r.is_locked ? `Buka kunci gudang ${r.name}` : `Kunci gudang ${r.name}`}
            />
          </Tooltip>
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
          placeholder="Search location name, code, address..."
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)', marginRight: 6 }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300, borderRadius: 10 }}
          allowClear
          aria-label="Cari gudang"
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
          aria-label="Tambah Lokasi Gudang Baru"
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
        destroyOnHidden
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
