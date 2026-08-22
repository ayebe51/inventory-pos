import React, { useState, useMemo } from 'react';
import {
  Drawer, Form, Table, Button, InputNumber,
  Space, Typography, Row, Col, Select, DatePicker, Tag
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, DeleteOutlined, ShopOutlined,
  ShoppingOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import api from '../../../lib/api';
import { useCreatePurchaseOrder } from '../hooks/usePurchase';
import type { PurchaseOrderLine } from '../types/purchase.types';

const { Text } = Typography;

interface PurchaseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PurchaseDrawer: React.FC<PurchaseDrawerProps> = ({ isOpen, onClose }) => {
  const [form] = Form.useForm();
  const [orderDate, setOrderDate] = useState<dayjs.Dayjs>(dayjs());
  const [supplierId, setSupplierId] = useState<string>('');
  const [lines, setLines] = useState<PurchaseOrderLine[]>([
    { product_id: '', qty_ordered: 1, uom_id: '', unit_price: 0 }
  ]);

  const { data: suppliersResponse } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/api/v1/master-data/suppliers').then((r) => r.data),
  });
  const suppliers = suppliersResponse?.data || [];

  const { data: productsResponse } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/v1/master-data/products').then((r) => r.data),
  });
  const products = productsResponse?.data || [];

  const { data: branchesResponse } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/api/v1/organization/branches').then((r) => r.data),
  });
  const branches = branchesResponse?.data || [];

  const { data: warehousesResponse } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/api/v1/warehouses').then((r) => r.data),
  });
  const warehouses = warehousesResponse?.data || [];

  const { mutate, isPending } = useCreatePurchaseOrder();

  const handleLineChange = (index: number, field: keyof PurchaseOrderLine, value: any) => {
    const newLines = [...lines];
    if (field === 'qty_ordered' || field === 'unit_price') {
      newLines[index][field] = Number(value) || 0;
    } else {
      (newLines[index] as any)[field] = value;
    }
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { product_id: '', qty_ordered: 1, uom_id: '', unit_price: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, line) => sum + ((line.qty_ordered || 0) * (line.unit_price || 0)), 0);
  }, [lines]);

  const handleSubmit = () => {
    if (!supplierId) return;
    mutate({
      supplier_id: supplierId,
      branch_id: branches[0]?.id || '00000000-0000-0000-0000-000000000000',
      warehouse_id: warehouses[0]?.id || '00000000-0000-0000-0000-000000000000',
      order_date: orderDate ? orderDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
      lines: lines.filter(l => l.product_id)
    }, {
      onSuccess: () => {
        onClose();
        setSupplierId('');
        setLines([{ product_id: '', qty_ordered: 1, uom_id: '', unit_price: 0 }]);
      }
    });
  };

  const columns: ColumnsType<PurchaseOrderLine & { key: number }> = [
    {
      title: 'PRODUCT',
      dataIndex: 'product_id',
      render: (_, record, index) => (
        <Select
          value={record.product_id || undefined}
          onChange={(value) => {
            const product = products.find((p: any) => p.id === value);
            handleLineChange(index, 'product_id', value);
            if (product) {
              handleLineChange(index, 'uom_id', product.uom_id);
              handleLineChange(index, 'unit_price', product.standard_cost || 0);
            }
          }}
          style={{ width: '100%', borderRadius: 8 }}
          placeholder="Select product..."
          showSearch
          optionFilterProp="children"
        >
          {products.map((p: any) => (
            <Select.Option key={p.id} value={p.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <Tag style={{ fontSize: 10, borderRadius: 4 }}>SKU: {p.sku || '—'}</Tag>
              </div>
            </Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: 'QTY',
      dataIndex: 'qty_ordered',
      width: 100,
      render: (_, record, index) => (
        <InputNumber
          min={1}
          value={record.qty_ordered}
          onChange={(val) => handleLineChange(index, 'qty_ordered', val)}
          style={{ width: '100%', borderRadius: 8 }}
        />
      )
    },
    {
      title: 'UNIT PRICE (RP)',
      dataIndex: 'unit_price',
      width: 150,
      render: (_, record, index) => (
        <InputNumber
          min={0}
          value={record.unit_price}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
          parser={value => value?.replace(/\./g, '') as any}
          onChange={(val) => handleLineChange(index, 'unit_price', val)}
          style={{ width: '100%', borderRadius: 8 }}
        />
      )
    },
    {
      title: 'SUBTOTAL',
      key: 'subtotal',
      width: 150,
      align: 'right',
      render: (_, record) => (
        <Text style={{ fontWeight: 700, fontSize: 13, color: 'var(--brand-600)' }}>
          Rp {((record.qty_ordered || 0) * (record.unit_price || 0)).toLocaleString('id-ID')}
        </Text>
      )
    },
    {
      title: '',
      key: 'action',
      width: 44,
      align: 'center',
      render: (_, __, index) => (
        <Button
          type="text"
          danger
          disabled={lines.length <= 1}
          icon={<DeleteOutlined />}
          onClick={() => removeLine(index)}
        />
      )
    }
  ];

  const tableData = lines.map((line, idx) => ({ ...line, key: idx }));

  return (
    <Drawer
      title="Create Purchase Order"
      open={isOpen}
      onClose={onClose}
      width={720}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
          <div>
            <Text style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block' }}>Total PO Value</Text>
            <Text style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-600)' }}>
              Rp {totalAmount.toLocaleString('id-ID')}
            </Text>
          </div>
          <Space size="middle">
            <Button onClick={onClose} style={{ borderRadius: 8 }}>
              Cancel
            </Button>
            <Button
              type="primary"
              loading={isPending}
              disabled={!supplierId || totalAmount <= 0}
              onClick={handleSubmit}
              style={{
                borderRadius: 8,
                fontWeight: 700,
                height: 38,
                padding: '0 20px',
                boxShadow: '0 4px 12px var(--brand-glow)'
              }}
            >
              Create Purchase Order
            </Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Order Date" required>
              <DatePicker
                value={orderDate}
                onChange={(date) => date && setOrderDate(date)}
                format="DD/MM/YYYY"
                style={{ width: '100%', borderRadius: 8 }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Supplier" required>
              <Select
                value={supplierId || undefined}
                onChange={(val) => setSupplierId(val)}
                placeholder="Select a vendor / supplier..."
                style={{ width: '100%', borderRadius: 8 }}
                showSearch
                optionFilterProp="children"
              >
                {suppliers.map((s: any) => (
                  <Select.Option key={s.id} value={s.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShopOutlined style={{ color: 'var(--brand-500)' }} />
                      <span>{s.name}</span>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16,
          marginBottom: 12
        }}>
          <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
            <ShoppingOutlined style={{ marginRight: 6, color: 'var(--brand-500)' }} />
            Order Line Items ({lines.length})
          </Text>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addLine}
            style={{ borderRadius: 8, fontSize: 13, fontWeight: 600 }}
          >
            Add Product Line
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={tableData}
          pagination={false}
          size="middle"
          rowKey="key"
          style={{ background: 'var(--solid-bg)', borderRadius: 12, overflow: 'hidden' }}
        />
      </Form>
    </Drawer>
  );
};

export default PurchaseDrawer;
