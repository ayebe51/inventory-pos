import React, { useState } from 'react';
import {
  Table, Button, Typography, Tag, Drawer, Form, Select, InputNumber, Row, Col, Space, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlayCircleOutlined, SaveOutlined, CheckCircleOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../../lib/api';

const { Title, Text } = Typography;
const { Option } = Select;

export const StockOpnamePage: React.FC = () => {
  const [initDrawerOpen, setInitDrawerOpen] = useState(false);
  const [recordDrawerOpen, setRecordDrawerOpen] = useState(false);
  const [selectedOpname, setSelectedOpname] = useState<any>(null);
  const [form] = Form.useForm();
  const [lines, setLines] = useState<any[]>([]);
  const qc = useQueryClient();

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((r) => r.data),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then((r) => r.data),
  });

  // Mocked list, normally we'd fetch from an endpoint that returns all stock opnames
  const opnames = [
    ...(selectedOpname ? [selectedOpname] : [])
  ];

  const initiate = useMutation({
    mutationFn: (warehouse_id: string) => api.post('/inventory/stock-opname/initiate', { warehouse_id }).then((r) => r.data.data),
    onSuccess: (data) => {
      message.success('Stock Opname initiated');
      setSelectedOpname(data);
      setInitDrawerOpen(false);
      form.resetFields();
    },
  });

  const record = useMutation({
    mutationFn: (data: { id: string; items: any[] }) => api.post(`/inventory/stock-opname/${data.id}/record`, { items: data.items }),
    onSuccess: () => {
      message.success('Counts recorded');
      setRecordDrawerOpen(false);
      setLines([]);
    },
  });

  const finalize = useMutation({
    mutationFn: (id: string) => api.post(`/inventory/stock-opname/${id}/finalize`).then((r) => r.data.data),
    onSuccess: (data) => {
      message.success('Stock Opname finalized');
      setSelectedOpname(data.opname); // Refresh with final status
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const handleInitSubmit = async () => {
    try {
      const values = await form.validateFields();
      initiate.mutate(values.warehouse_id);
    } catch (_) {}
  };

  const handleRecordSubmit = () => {
    if (lines.length === 0) return message.error('Add at least one product count');
    record.mutate({ id: selectedOpname.id, items: lines });
  };

  const columns: ColumnsType<any> = [
    { title: 'Opname Number', dataIndex: 'opname_number', render: (t) => <Text code>{t}</Text> },
    { title: 'Warehouse', dataIndex: 'warehouse_id' },
    { title: 'Start Date', dataIndex: 'start_date', render: (d) => new Date(d).toLocaleDateString() },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={s === 'COMPLETED' ? 'green' : 'orange'}>{s}</Tag> },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'IN_PROGRESS' && (
            <>
              <Button size="small" onClick={() => setRecordDrawerOpen(true)} icon={<SaveOutlined />}>Record</Button>
              <Button size="small" type="primary" onClick={() => finalize.mutate(record.id)} icon={<CheckCircleOutlined />}>Finalize</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ color: '#E2E8F0', margin: 0 }}>Stock Opname</Title>
          <Text style={{ color: '#64748B' }}>Physical stock counting and reconciliation</Text>
        </div>
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setInitDrawerOpen(true)}>
          Initiate Opname
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={opnames}
        rowKey="id"
        size="small"
      />

      <Drawer
        title="Initiate Stock Opname"
        open={initDrawerOpen}
        onClose={() => setInitDrawerOpen(false)}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setInitDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleInitSubmit} loading={initiate.isPending}>Start</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="warehouse_id" label="Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse to lock and count">
              {warehouses?.data?.map((w: any) => (
                <Option key={w.id} value={w.id}>{w.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Text type="warning">Note: This will lock the warehouse, preventing further transactions until finalized.</Text>
        </Form>
      </Drawer>

      <Drawer
        title="Record Physical Count"
        width={500}
        open={recordDrawerOpen}
        onClose={() => setRecordDrawerOpen(false)}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setRecordDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleRecordSubmit} loading={record.isPending}>Save Counts</Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => setLines([...lines, { id: Date.now(), product_id: null, qty_counted: 0 }])}>
            Add Count Line
          </Button>
        </div>
        {lines.map((line) => (
          <Row gutter={8} key={line.id} style={{ marginBottom: 8 }}>
            <Col span={14}>
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder="Product"
                value={line.product_id}
                onChange={(v) => setLines(lines.map(l => l.id === line.id ? { ...l, product_id: v } : l))}
                options={products?.data?.map((p: any) => ({ label: p.name, value: p.id }))}
              />
            </Col>
            <Col span={8}>
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Count"
                value={line.qty_counted}
                onChange={(v) => setLines(lines.map(l => l.id === line.id ? { ...l, qty_counted: v } : l))}
              />
            </Col>
            <Col span={2}>
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setLines(lines.filter(l => l.id !== line.id))} />
            </Col>
          </Row>
        ))}
      </Drawer>
    </div>
  );
};
