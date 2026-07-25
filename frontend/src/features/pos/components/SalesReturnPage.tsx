import React, { useState } from 'react';
import {
  Table, Button, Typography, Tag, Drawer, Form, Select, InputNumber, Row, Col, Space, message, Input, DatePicker
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../../lib/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export const SalesReturnPage: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [lines, setLines] = useState<any[]>([]);

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/products').then((r) => r.data),
  });

  const [mockSRs, setMockSRs] = useState([
    {
      id: 'mock-sr-1',
      return_number: 'SR-2026-001',
      reference_number: 'SO-2026-001',
      return_date: '2026-07-26',
      total_amount: 1500000,
      status: 'APPROVED',
    },
  ]);

  const createSR = useMutation({
    mutationFn: (data: any) => api.post(`/sales-orders/${data.so_id}/return`, data).then((r) => r.data.data),
    onSuccess: (newSR) => {
      message.success('Sales Return created');
      setDrawerOpen(false);
      form.resetFields();
      setLines([]);
      setMockSRs(prev => [{
        id: newSR?.id || Date.now().toString(),
        return_number: newSR?.return_number || `SR-NEW-${Date.now()}`,
        reference_number: form.getFieldValue('so_id') || 'Unknown',
        return_date: form.getFieldValue('return_date').format('YYYY-MM-DD'),
        total_amount: lines.reduce((acc, l) => acc + (l.qty * l.unit_price), 0),
        status: 'APPROVED',
      }, ...prev]);
    },
    onError: (err: any) => message.error(err?.response?.data?.error?.message || 'Failed to create Return'),
  });

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (lines.length === 0) return message.error('Add at least one return item');
      
      const payload = {
        so_id: values.so_id,
        return_date: values.return_date.toISOString(),
        reason: values.reason,
        lines: lines.map(l => ({
          product_id: l.product_id,
          qty: l.qty,
          unit_price: l.unit_price,
        })),
      };
      
      createSR.mutate(payload);
    } catch (_) {}
  };

  const columns: ColumnsType<any> = [
    { title: 'Return Number', dataIndex: 'return_number', render: (t) => <Text code style={{ color: '#F43F5E' }}>{t}</Text> },
    { title: 'Ref SO', dataIndex: 'reference_number', render: (t) => <Text type="secondary">{t}</Text> },
    { title: 'Date', dataIndex: 'return_date', render: (d) => new Date(d).toLocaleDateString() },
    { title: 'Total Amount', dataIndex: 'total_amount', align: 'right', render: (v) => `Rp ${v.toLocaleString()}` },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color="green">{s}</Tag> },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Sales Returns</Title>
          <Text className="page-subtitle">Manage customer returns and refunds</Text>
        </div>
        <Button type="primary" danger icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
          New Return
        </Button>
      </div>

      <Table columns={columns} dataSource={mockSRs} rowKey="id" size="small" />

      <Drawer
        title="Create Sales Return"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={700}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" danger onClick={handleSubmit} loading={createSR.isPending}>Submit Return</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={{ return_date: dayjs() }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="so_id" label="Sales Order ID" rules={[{ required: true }]}>
                <Input placeholder="Enter SO ID to return against" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="return_date" label="Return Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="Why is the customer returning this?" />
          </Form.Item>

          <div style={{ marginBottom: 16, marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
            <Text style={{ color: '#E2E8F0', fontWeight: 600 }}>Return Items</Text>
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
                  onChange={(v) => {
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
                <InputNumber placeholder="Unit Price" min={0} style={{ width: '100%' }} value={line.unit_price}
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
              <Title level={4} style={{ color: '#F43F5E' }}>
                Refund: Rp {lines.reduce((acc, l) => acc + (l.qty * l.unit_price), 0).toLocaleString()}
              </Title>
            </div>
          )}
        </Form>
      </Drawer>
    </div>
  );
};
