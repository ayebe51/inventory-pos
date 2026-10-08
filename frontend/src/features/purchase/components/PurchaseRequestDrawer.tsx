import React, { useState } from 'react';
import {
  Drawer, Form, Table, Button, InputNumber,
  Space, Typography, Row, Col, Select, Input, message
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useCreatePurchaseRequest } from '../hooks/usePurchase';

const { Text } = Typography;

interface PurchaseRequestDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PRLineState {
  product_id: string;
  qty_requested: number;
  uom_id: string;
  estimated_price: number;
  notes?: string;
}

export const PurchaseRequestDrawer: React.FC<PurchaseRequestDrawerProps> = ({ isOpen, onClose }) => {
  const [form] = Form.useForm();
  const createPR = useCreatePurchaseRequest();

  const [lines, setLines] = useState<PRLineState[]>([
    { product_id: '', qty_requested: 1, uom_id: '', estimated_price: 0 }
  ]);

  const { data: branchesResponse } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/api/v1/organization/branches').then((r) => r.data),
    enabled: isOpen,
  });
  const branches = branchesResponse?.data || [];

  const { data: warehousesResponse } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/api/v1/warehouses').then((r) => r.data),
    enabled: isOpen,
  });
  const warehouses = warehousesResponse?.data || [];

  const { data: productsResponse } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/v1/master-data/products?is_active=true').then((r) => r.data),
    enabled: isOpen,
  });
  const products = productsResponse?.data || [];

  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = products.find((p: any) => p.id === productId);
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      product_id: productId,
      uom_id: selectedProd?.uom_id || selectedProd?.uom?.id || '',
      estimated_price: Number(selectedProd?.purchase_price || selectedProd?.cost_price || 0),
    };
    setLines(updated);
  };

  const handleQtyChange = (index: number, qty: number | null) => {
    const updated = [...lines];
    updated[index].qty_requested = qty || 1;
    setLines(updated);
  };

  const handlePriceChange = (index: number, price: number | null) => {
    const updated = [...lines];
    updated[index].estimated_price = price || 0;
    setLines(updated);
  };

  const addLine = () => {
    setLines([...lines, { product_id: '', qty_requested: 1, uom_id: '', estimated_price: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const totalEst = lines.reduce((sum, l) => sum + (l.qty_requested * l.estimated_price), 0);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const validLines = lines.filter(l => l.product_id && l.uom_id);

      if (validLines.length === 0) {
        message.error('Please add at least one valid product line with UOM');
        return;
      }

      await createPR.mutateAsync({
        branch_id: values.branch_id,
        warehouse_id: values.warehouse_id,
        notes: values.notes || undefined,
        lines: validLines.map(l => ({
          product_id: l.product_id,
          qty_requested: Number(l.qty_requested),
          uom_id: l.uom_id,
          estimated_price: Number(l.estimated_price) || 0,
          notes: l.notes || undefined,
        })),
      });

      message.success('Purchase Request created successfully');
      form.resetFields();
      setLines([{ product_id: '', qty_requested: 1, uom_id: '', estimated_price: 0 }]);
      onClose();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Failed to create Purchase Request');
    }
  };

  const columns: ColumnsType<PRLineState> = [
    {
      title: 'Product',
      key: 'product',
      render: (_, record, idx) => (
        <Select
          showSearch
          placeholder="Select product"
          style={{ width: '100%' }}
          value={record.product_id || undefined}
          onChange={(val) => handleProductChange(idx, val)}
          filterOption={(input, opt) =>
            (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())
          }
          options={products.map((p: any) => ({
            value: p.id,
            label: `${p.code} - ${p.name}`,
          }))}
        />
      ),
    },
    {
      title: 'Qty',
      key: 'qty',
      width: 100,
      render: (_, record, idx) => (
        <InputNumber
          min={1}
          value={record.qty_requested}
          onChange={(val) => handleQtyChange(idx, val)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Est. Price',
      key: 'price',
      width: 140,
      render: (_, record, idx) => (
        <InputNumber
          min={0}
          value={record.estimated_price}
          onChange={(val) => handlePriceChange(idx, val)}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Subtotal',
      key: 'subtotal',
      width: 130,
      align: 'right',
      render: (_, record) => (
        <Text strong>
          Rp {((record.qty_requested || 0) * (record.estimated_price || 0)).toLocaleString('id-ID')}
        </Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, __, idx) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          disabled={lines.length <= 1}
          onClick={() => removeLine(idx)}
        />
      ),
    },
  ];

  return (
    <Drawer
      title="Create Purchase Request"
      width={720}
      open={isOpen}
      onClose={onClose}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={createPR.isPending} onClick={handleSubmit}>
            Submit Request
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="branch_id"
              label="Branch"
              rules={[{ required: true, message: 'Please select a branch' }]}
            >
              <Select
                placeholder="Select Branch"
                options={branches.map((b: any) => ({ value: b.id, label: b.name }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="warehouse_id"
              label="Destination Warehouse"
              rules={[{ required: true, message: 'Please select destination warehouse' }]}
            >
              <Select
                placeholder="Select Warehouse"
                options={warehouses.map((w: any) => ({ value: w.id, label: w.name }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="notes" label="Request Notes / Justification">
          <Input.TextArea rows={2} placeholder="Reason for purchase request..." />
        </Form.Item>

        <div style={{ marginTop: 16, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>Requested Items</Text>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addLine} size="small">
            Add Item
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={lines}
          rowKey={(_, idx) => `${idx}`}
          pagination={false}
          size="small"
        />

        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Text type="secondary">Total Estimated Value: </Text>
          <Text strong style={{ fontSize: 16, color: '#8B5CF6' }}>
            Rp {totalEst.toLocaleString('id-ID')}
          </Text>
        </div>
      </Form>
    </Drawer>
  );
};
