import React, { useState } from 'react';
import {
  Table, Button, Typography, Drawer, Form, InputNumber, Row, Col, Space, message, Badge, DatePicker, Select
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, SendOutlined } from '@ant-design/icons';
import api from '../../../lib/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export const SalesOrderPage: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [lines, setLines] = useState<any[]>([]);
  const qc = useQueryClient();

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get('/api/v1/master-data/customers').then((r) => r.data),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/v1/master-data/products').then((r) => r.data),
  });

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/api/v1/master-data/warehouses').then((r) => r.data),
  });

  const { data: salesOrdersData, isLoading } = useQuery({
    queryKey: ['sales-orders'],
    queryFn: () => api.get('/api/v1/sales-orders').then((r) => r.data),
  });

  const salesOrders = salesOrdersData?.data || [];

  const createSO = useMutation({
    mutationFn: (data: any) => api.post('/api/v1/sales-orders', data).then((r) => r.data.data),
    onSuccess: () => {
      message.success('Sales Order created');
      setDrawerOpen(false);
      form.resetFields();
      setLines([]);
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (err: any) => message.error(err?.response?.data?.error?.message || 'Failed to create SO'),
  });

  const approveSO = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/sales-orders/${id}/approve`).then((r) => r.data),
    onSuccess: () => {
      message.success('Sales Order approved');
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
    },
  });

  const fulfillSO = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/sales-orders/${id}/fulfill`, {
      warehouse_id: warehouses?.data?.[0]?.id || '00000000-0000-0000-0000-000000000000',
      delivery_date: new Date().toISOString(),
      lines: [] // simplified
    }).then((r) => r.data),
    onSuccess: () => {
      message.success('Sales Order fulfilled');
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
    },
  });

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (lines.length === 0) return message.error('Add at least one item');
      
      const payload = {
        customer_id: values.customer_id,
        branch_id: warehouses?.data?.[0]?.branch_id || '00000000-0000-0000-0000-000000000000',
        order_date: values.order_date.toISOString(),
        lines: lines.map(l => {
          const p = products?.data?.find((x: any) => x.id === l.product_id);
          return {
            product_id: l.product_id,
            qty: l.qty,
            unit_price: l.unit_price,
            uom_id: p?.uom_id || '00000000-0000-0000-0000-000000000000',
          };
        }),
      };
      
      createSO.mutate(payload);
    } catch (_) {}
  };

  const columns: ColumnsType<any> = [
    { title: 'SO Number', dataIndex: 'so_number', render: (t) => <Text code style={{ color: '#38BDF8' }}>{t}</Text> },
    { title: 'Customer', dataIndex: ['customer', 'name'] },
    { title: 'Order Date', dataIndex: 'order_date', render: (d) => new Date(d).toLocaleDateString() },
    { title: 'Total Amount', dataIndex: 'total_amount', align: 'right', render: (v) => `Rp ${v.toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', render: (s) => (
        <Badge status={
          s === 'PENDING_APPROVAL' ? 'warning' :
          s === 'APPROVED' ? 'processing' :
          s === 'FULFILLED' ? 'success' : 'default'
        } text={s} />
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space>
          {record.status === 'PENDING_APPROVAL' && (
            <Button size="small" type="primary" onClick={() => approveSO.mutate(record.id)} icon={<CheckCircleOutlined />}>Approve</Button>
          )}
          {record.status === 'APPROVED' && (
            <Button size="small" onClick={() => fulfillSO.mutate(record.id)} icon={<SendOutlined />}>Fulfill (DO)</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Sales Orders</Title>
          <Text className="page-subtitle">B2B Wholesale & Deliveries</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
          Create Sales Order
        </Button>
      </div>

      <Table columns={columns} dataSource={salesOrders} rowKey="id" size="small" loading={isLoading} />

      <Drawer
        title="Create Sales Order"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={700}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSubmit} loading={createSO.isPending}>Save</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ order_date: dayjs() }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customer_id" label="Customer" rules={[{ required: true }]}>
                <Select placeholder="Select B2B Customer">
                  {customers?.data?.map((c: any) => (
                    <Option key={c.id} value={c.id}>{c.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="order_date" label="Order Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginBottom: 16, marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 600 }}>Order Lines</Text>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => setLines([...lines, { id: Date.now(), product_id: null, qty: 1, unit_price: 0 }])}>
              Add Item
            </Button>
          </div>
          
          {lines.map((line) => (
            <Row gutter={8} key={line.id} style={{ marginBottom: 8 }}>
              <Col span={10}>
                <Select
                  showSearch
                  placeholder="Product"
                  style={{ width: '100%' }}
                  value={line.product_id}
                  onChange={(v: string) => {
                    const p = products?.data?.find((x: any) => x.id === v);
                    setLines(lines.map(l => l.id === line.id ? { ...l, product_id: v, unit_price: p?.selling_price || 0 } : l));
                  }}
                  options={products?.data?.map((p: any) => ({ label: p.name, value: p.id }))}
                />
              </Col>
              <Col span={5}>
                <InputNumber placeholder="Qty" min={1} style={{ width: '100%' }} value={line.qty}
                  onChange={(v) => setLines(lines.map(l => l.id === line.id ? { ...l, qty: v } : l))} />
              </Col>
              <Col span={7}>
                <InputNumber placeholder="Price" min={0} style={{ width: '100%' }} value={line.unit_price}
                  onChange={(v) => setLines(lines.map(l => l.id === line.id ? { ...l, unit_price: v } : l))}
                  formatter={(v) => `Rp ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Col>
              <Col span={2}>
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setLines(lines.filter(l => l.id !== line.id))} />
              </Col>
            </Row>
          ))}
          
          {lines.length > 0 && (
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Title level={4} style={{ color: '#10B981' }}>
                Total: Rp {lines.reduce((acc, l) => acc + (l.qty * l.unit_price), 0).toLocaleString()}
              </Title>
            </div>
          )}
        </Form>
      </Drawer>
    </div>
  );
};
