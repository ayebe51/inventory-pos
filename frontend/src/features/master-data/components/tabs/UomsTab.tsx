import React, { useState } from 'react';
import {
  Table, Typography, Button, Input, Tag, Modal, Form, Space, Popconfirm, message
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  InboxOutlined, PlusOutlined, SearchOutlined, DeleteOutlined
} from '@ant-design/icons';
import { api } from '../../../../lib/api';
import { ActionableEmptyState } from '../../../../components/common/ActionableEmptyState';

const { Text } = Typography;

export const UomsTab: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['uoms'],
    queryFn: () => api.get('/api/v1/master-data/uoms').then(r => r.data)
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => api.post('/api/v1/master-data/uoms', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uoms'] });
      message.success('Unit of Measure created');
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to create UOM');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/master-data/uoms/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uoms'] });
      message.success('UOM deleted');
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Failed to delete UOM');
    }
  });

  const rawList = data?.data || (Array.isArray(data) ? data : []);
  const filteredData = rawList.filter((u: any) =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.code?.toLowerCase().includes(search.toLowerCase()) ||
    u.symbol?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      title: 'UOM CODE',
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
          fontSize: 12
        }}>
          {t}
        </span>
      )
    },
    {
      title: 'UNIT NAME',
      dataIndex: 'name',
      render: (name: string) => <Text style={{ fontWeight: 700, fontSize: 14 }}>{name}</Text>
    },
    {
      title: 'SYMBOL',
      dataIndex: 'symbol',
      width: 120,
      align: 'center' as const,
      render: (sym: string) => (
        <Tag color="purple" style={{ borderRadius: 6, fontWeight: 700 }}>
          {sym || '—'}
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
          <Popconfirm title="Delete this UOM?" onConfirm={() => deleteMutation.mutate(r.id)}>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              style={{ borderRadius: 8 }}
              aria-label={`Hapus satuan ${r.name}`}
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
          placeholder="Search UOM name, code, symbol..."
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)', marginRight: 6 }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280, borderRadius: 10 }}
          allowClear
          aria-label="Cari satuan ukuran"
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
          aria-label="Tambah Satuan Ukuran Baru"
        >
          Add UOM
        </Button>
      </div>

      {filteredData.length === 0 && !isLoading ? (
        <ActionableEmptyState
          title="No Units of Measure Configured"
          description="Define standard units (PCS, BOX, KG, LTR) to manage inventory packaging and POS selling quantities."
          actionLabel="Add UOM"
          onAction={() => { form.resetFields(); setIsModalOpen(true); }}
          icon={<InboxOutlined />}
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
        title="Add Unit of Measure (UOM)"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnHidden
        width={460}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)} style={{ marginTop: 16 }}>
          <Form.Item name="code" label="UOM Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="PCS" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="name" label="UOM Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="Pieces / Buah" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="symbol" label="Symbol" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="pcs" style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
