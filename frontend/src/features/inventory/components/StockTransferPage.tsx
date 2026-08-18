import React, { useState } from 'react';
import {
  Table, Button, Space, Typography, Card, Drawer, Form,
  Select, InputNumber, Row, Col, DatePicker, message, Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export const StockTransferPage: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [lines, setLines] = useState<any[]>([]);
  const qc = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/v1/master-data/products').then((r) => r.data),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/api/v1/master-data/warehouses').then((r) => r.data),
  });

  const { data: transfers, isLoading } = useQuery({
    queryKey: ['stock-transfers'],
    queryFn: () => api.get('/api/v1/inventory/stock-transfers').then((r) => r.data),
  });

  const createTransfer = useMutation({
    mutationFn: (data: any) => api.post('/api/v1/inventory/stock-transfers', data).then((r) => r.data),
    onSuccess: () => {
      message.success('Stock transferred successfully');
      setDrawerOpen(false);
      form.resetFields();
      setLines([]);
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || 'Transfer failed');
    },
  });

  const handleAddLine = () => {
    setLines([...lines, { id: Date.now().toString(), product_id: null, qty: 1 }]);
  };

  const handleRemoveLine = (id: string) => {
    setLines(lines.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: string, value: any) => {
    setLines(lines.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (lines.length === 0) return message.error('Add at least one product');
      
      const payload = {
        ...values,
        transfer_date: values.transfer_date.format('YYYY-MM-DD'),
        lines: lines.map((l) => {
          const product = products?.data?.find((p: any) => p.id === l.product_id);
          return {
            product_id: l.product_id,
            qty: l.qty,
            uom_id: product?.uom_id || '00000000-0000-0000-0000-000000000000',
            unit_cost: product?.standard_cost || 0,
          };
        }),
      };
      
      await createTransfer.mutateAsync(payload);
    } catch (_) {}
  };

  const columns: ColumnsType<any> = [
    {
      title: 'Transfer #',
      dataIndex: 'transfer_number',
      render: (v) => <Text code style={{ color: '#A78BFA' }}>{v}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'transfer_date',
      render: (d) => new Date(d).toLocaleDateString('id-ID'),
    },
    {
      title: 'From Warehouse',
      dataIndex: ['from_warehouse', 'name'],
    },
    {
      title: 'To Warehouse',
      dataIndex: ['to_warehouse', 'name'],
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s) => <Badge status={s === 'COMPLETED' ? 'success' : 'processing'} text={s} />,
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Stock Transfers</Title>
          <Text className="page-subtitle">Move inventory between warehouses</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
          New Transfer
        </Button>
      </div>

      <Card className="stat-card" bodyStyle={{ padding: '24px' }}>
        <Table
          columns={columns}
          dataSource={transfers?.data || []}
          loading={isLoading}
          rowKey="id"
          size="small"
        />
      </Card>

      <Drawer
        title="Create Stock Transfer"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={600}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit} loading={createTransfer.isPending}>
              Execute Transfer
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ transfer_date: dayjs() }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="from_warehouse_id" label="Source Warehouse" rules={[{ required: true }]}>
                <Select placeholder="Select source">
                  {warehouses?.data?.map((w: any) => (
                    <Option key={w.id} value={w.id}>{w.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="to_warehouse_id" label="Destination Warehouse" rules={[{ required: true }]}>
                <Select placeholder="Select destination">
                  {warehouses?.data?.map((w: any) => (
                    <Option key={w.id} value={w.id}>{w.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="transfer_date" label="Transfer Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <div style={{ marginBottom: 16, marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 600 }}>Items to Transfer</Text>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleAddLine}>Add Item</Button>
          </div>
          
          {lines.map((line) => (
            <Row gutter={8} key={line.id} style={{ marginBottom: 8 }}>
              <Col span={15}>
                <Select
                  showSearch
                  placeholder="Select product"
                  style={{ width: '100%' }}
                  value={line.product_id}
                  onChange={(v) => updateLine(line.id, 'product_id', v)}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                  }
                  options={products?.data?.map((p: any) => ({ label: p.name, value: p.id })) || []}
                />
              </Col>
              <Col span={7}>
                <InputNumber
                  min={1}
                  placeholder="Qty"
                  style={{ width: '100%' }}
                  value={line.qty}
                  onChange={(v) => updateLine(line.id, 'qty', v)}
                />
              </Col>
              <Col span={2}>
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveLine(line.id)} />
              </Col>
            </Row>
          ))}
        </Form>
      </Drawer>
    </div>
  );
};
