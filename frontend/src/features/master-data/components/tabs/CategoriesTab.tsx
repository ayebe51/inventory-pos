import React, { useState } from 'react';
import {
  Table, Typography, Button, Input, Tag, Modal, Form, Space, Popconfirm, message
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AppstoreOutlined, PlusOutlined, SearchOutlined, DeleteOutlined
} from '@ant-design/icons';
import { api } from '../../../../lib/api';
import { ActionableEmptyState } from '../../../../components/common/ActionableEmptyState';

const { Text } = Typography;

export const CategoriesTab: React.FC = () => {
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
        <Space size="small">
          <Popconfirm title="Delete taxonomy category?" onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              style={{ borderRadius: 8 }}
              aria-label={`Hapus kategori ${r.name}`}
            />
          </Popconfirm>
        </Space>
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
          placeholder="Search category code or name..."
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)', marginRight: 6 }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, borderRadius: 10 }}
          allowClear
          aria-label="Cari kategori"
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
          aria-label="Tambah Kategori Produk Baru"
        >
          Add Category
        </Button>
      </div>

      {filteredData.length === 0 && !isLoading ? (
        <ActionableEmptyState
          title="No Categories Configured"
          description="Build catalog hierarchies to streamline product search, sales reporting, and inventory categorization."
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
        destroyOnHidden
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
