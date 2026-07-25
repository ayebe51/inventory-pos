import React, { useState } from 'react';
import {
  Table, Button, Input, Space, Tag, Drawer, Form,
  InputNumber, Select, Popconfirm, Tooltip,
  Row, Col, Card,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, SearchOutlined, EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useInventory';
import type { Product } from '../types/inventory.types';
import { Typography } from 'antd';

const { Text } = Typography;
const { Option } = Select;

export const ProductManagement: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();

  const { data, isLoading } = useProducts({ name: search || undefined });
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const handleOpenCreate = () => {
    setEditingProduct(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    form.setFieldsValue({
      ...product,
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingProduct) {
        await updateProduct.mutateAsync({ id: editingProduct.id, data: values });
      } else {
        await createProduct.mutateAsync(values);
      }
      setDrawerOpen(false);
    } catch (_) {
      // validation errors shown inline
    }
  };

  const columns: ColumnsType<Product> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 120,
      render: (code) => <Text code style={{ color: '#A78BFA' }}>{code}</Text>,
    },
    {
      title: 'Product Name',
      dataIndex: 'name',
      ellipsis: true,
    },
    {
      title: 'Selling Price',
      dataIndex: 'selling_price',
      align: 'right',
      width: 160,
      render: (price) => (
        <Text className="number-display" style={{ color: '#34D399', fontWeight: 600 }}>
          {price ? `Rp ${price.toLocaleString('id-ID')}` : '—'}
        </Text>
      ),
    },
    {
      title: 'Cost',
      dataIndex: 'standard_cost',
      align: 'right',
      width: 140,
      render: (cost) => (
        <Text className="number-display" style={{ color: '#94A3B8' }}>
          {cost ? `Rp ${cost.toLocaleString('id-ID')}` : '—'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      width: 100,
      render: (active) => (
        <Tag className={active ? 'status-approved' : 'status-closed'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenEdit(record)}
              style={{ color: '#8B5CF6' }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete product?"
            description="This action cannot be undone."
            onConfirm={() => deleteProduct.mutate(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button type="text" size="small" icon={<DeleteOutlined />} danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Input
          placeholder="Search by name or SKU..."
          prefix={<SearchOutlined style={{ color: '#64748B' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 400 }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
          Add Product
        </Button>
      </div>

      <Card className="stat-card">
        <Table
          columns={columns}
          dataSource={data?.data}
          loading={isLoading}
          rowKey="id"
          scroll={{ x: 800 }}
          size="small"
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) => `${total} products`,
          }}
        />
      </Card>

      <Drawer
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={480}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              loading={createProduct.isPending || updateProduct.isPending}
              onClick={handleSubmit}
            >
              {editingProduct ? 'Save Changes' : 'Create Product'}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="code" label="Product Code" rules={[{ required: true }, { max: 50 }]}>
                <Input placeholder="e.g. PRD-001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="barcode" label="Barcode">
                <Input placeholder="EAN-13" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="name" label="Product Name" rules={[{ required: true }, { max: 200 }]}>
            <Input placeholder="Full product name" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="standard_cost" label="Standard Cost (Rp)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="selling_price" label="Selling Price (Rp)" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} min={0} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="min_selling_price" label="Floor Price (Rp)">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reorder_point" label="Reorder Point">
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="cost_method" label="Cost Method" initialValue="WAC">
            <Select>
              <Option value="WAC">WAC (Weighted Average)</Option>
              <Option value="FIFO">FIFO</Option>
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="Status" initialValue={true}>
            <Select>
              <Option value={true}>Active</Option>
              <Option value={false}>Inactive</Option>
            </Select>
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Additional notes..." />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};
