import React, { useState } from 'react';
import {
  Tabs, Table, Typography, Card, Button, Input, Space, Tag, Modal, Form, InputNumber
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShopOutlined, UserOutlined, AppstoreOutlined, HomeOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined
} from '@ant-design/icons';
import api from '../../../lib/api';

const { Title, Text } = Typography;

// --- Sub-components for each Master Data ---

const CustomerManager: React.FC = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['customers'], queryFn: () => api.get('/customers').then(r => r.data) });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const mutation = useMutation({
    mutationFn: (values: any) => api.post('/customers', values),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setIsModalOpen(false); form.resetFields(); }
  });

  const columns = [
    { title: 'Code', dataIndex: 'code', render: (t: string) => <Text code>{t}</Text> },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Credit Limit', dataIndex: 'credit_limit', render: (v: number) => `Rp ${v?.toLocaleString()}` },
    { title: 'Outstanding', dataIndex: 'outstanding_balance', render: (v: number) => `Rp ${v?.toLocaleString()}` },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="Search customers..." style={{ maxWidth: 300 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>Add Customer</Button>
      </div>
      <Table columns={columns} dataSource={data?.data} rowKey="id" size="small" loading={isLoading} />
      <Modal title="Add Customer" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="credit_limit" label="Credit Limit" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const SupplierManager: React.FC = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers').then(r => r.data) });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const mutation = useMutation({
    mutationFn: (values: any) => api.post('/suppliers', values),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); setIsModalOpen(false); form.resetFields(); }
  });

  const columns = [
    { title: 'Code', dataIndex: 'code', render: (t: string) => <Text code>{t}</Text> },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Contact Person', dataIndex: 'contact_person' },
    { title: 'Phone', dataIndex: 'phone' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="Search suppliers..." style={{ maxWidth: 300 }} />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>Add Supplier</Button>
      </div>
      <Table columns={columns} dataSource={data?.data} rowKey="id" size="small" loading={isLoading} />
      <Modal title="Add Supplier" open={isModalOpen} onCancel={() => setIsModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={(v) => mutation.mutate(v)}>
          <Form.Item name="code" label="Code" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contact_person" label="Contact Person"><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const WarehouseManager: React.FC = () => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['warehouses'], queryFn: () => api.get('/warehouses').then(r => r.data) });
  
  const toggleLock = useMutation({
    mutationFn: (id: string) => api.post(`/warehouses/${id}/lock`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] })
  });

  const columns = [
    { title: 'Code', dataIndex: 'code', render: (t: string) => <Text code>{t}</Text> },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Status', dataIndex: 'is_locked', render: (l: boolean) => <Tag color={l ? 'red' : 'green'}>{l ? 'Locked' : 'Active'}</Tag> },
    { title: 'Actions', render: (_, r: any) => (
      <Button size="small" danger={!r.is_locked} onClick={() => toggleLock.mutate(r.id)}>
        {r.is_locked ? 'Unlock' : 'Lock'}
      </Button>
    )}
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Input.Search placeholder="Search warehouses..." style={{ maxWidth: 300 }} />
        <Button type="primary" icon={<PlusOutlined />}>Add Warehouse</Button>
      </div>
      <Table columns={columns} dataSource={data?.data} rowKey="id" size="small" loading={isLoading} />
    </div>
  );
};

export const MasterDataPage: React.FC = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Master Data</Title>
          <Text className="page-subtitle">Manage global entities, business partners, and parameters</Text>
        </div>
      </div>

      <Card className="stat-card" bodyStyle={{ padding: '0 24px 24px 24px' }}>
        <Tabs
          tabPosition="left"
          defaultActiveKey="customers"
          items={[
            {
              key: 'customers',
              label: <span><UserOutlined /> Customers</span>,
              children: <div style={{ paddingTop: 24, paddingLeft: 16 }}><CustomerManager /></div>,
            },
            {
              key: 'suppliers',
              label: <span><ShopOutlined /> Suppliers</span>,
              children: <div style={{ paddingTop: 24, paddingLeft: 16 }}><SupplierManager /></div>,
            },
            {
              key: 'warehouses',
              label: <span><HomeOutlined /> Warehouses</span>,
              children: <div style={{ paddingTop: 24, paddingLeft: 16 }}><WarehouseManager /></div>,
            },
            {
              key: 'categories',
              label: <span><AppstoreOutlined /> Categories</span>,
              children: <div style={{ paddingTop: 24, paddingLeft: 16 }}><Text>Category Management coming soon.</Text></div>,
            }
          ]}
        />
      </Card>
    </div>
  );
};
