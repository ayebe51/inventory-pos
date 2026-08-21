import React, { useEffect } from 'react';
import {
  Drawer, Form, Input, InputNumber, Select,
  Switch, Button, Row, Col
} from 'antd';
import type { Product } from '../types/inventory.types';
import { useCreateProduct, useUpdateProduct } from '../hooks/useInventory';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

interface ProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
}

export const ProductDrawer: React.FC<ProductDrawerProps> = ({ isOpen, onClose, product }) => {
  const [form] = Form.useForm();

  const { data: categoriesResponse } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/v1/master-data/categories').then((r) => r.data),
  });
  const categories = categoriesResponse?.data || [];

  const { data: uomsResponse } = useQuery({
    queryKey: ['uoms'],
    queryFn: () => api.get('/api/v1/master-data/uoms').then((r) => r.data),
  });
  const uoms = uomsResponse?.data || [];

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  useEffect(() => {
    if (isOpen) {
      if (product) {
        form.setFieldsValue({
          code: product.code,
          name: product.name,
          selling_price: product.selling_price || 0,
          standard_cost: product.standard_cost || 0,
          reorder_point: product.reorder_point || 0,
          is_active: product.is_active ?? true,
          category_id: product.category_id || categories[0]?.id || '',
          uom_id: product.uom_id || uoms[0]?.id || '',
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          selling_price: 0,
          standard_cost: 0,
          reorder_point: 10,
          is_active: true,
          category_id: categories[0]?.id || '',
          uom_id: uoms[0]?.id || '',
        });
      }
    }
  }, [product, isOpen, categories, uoms, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (product) {
        updateMutation.mutate({ ...values, id: product.id }, {
          onSuccess: () => {
            onClose();
            form.resetFields();
          },
        });
      } else {
        createMutation.mutate({
          ...values,
          cost_method: 'WAC',
          min_selling_price: 0,
          reorder_qty: 0,
          is_serialized: false,
          is_batch_tracked: false,
        }, {
          onSuccess: () => {
            onClose();
            form.resetFields();
          },
        });
      }
    } catch (_) {}
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Drawer
      title={product ? 'Edit Product Catalog' : 'Add New Product'}
      open={isOpen}
      onClose={onClose}
      width={500}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '6px 0' }}>
          <Button onClick={onClose} style={{ borderRadius: 8 }}>
            Cancel
          </Button>
          <Button
            type="primary"
            loading={isPending}
            onClick={handleSubmit}
            style={{
              borderRadius: 8,
              fontWeight: 700,
              height: 38,
              padding: '0 20px',
              boxShadow: '0 4px 12px var(--brand-glow)'
            }}
          >
            {product ? 'Update Product' : 'Save Product'}
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="code" label="SKU / Product Code" rules={[{ required: true, message: 'SKU is required' }]}>
              <Input placeholder="e.g. SKU-1001" style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="is_active" label="Status" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="name" label="Product Name" rules={[{ required: true, message: 'Product name is required' }]}>
          <Input placeholder="Enter full product description..." style={{ borderRadius: 8 }} />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="category_id" label="Category" rules={[{ required: true, message: 'Category is required' }]}>
              <Select placeholder="Select category" style={{ borderRadius: 8 }}>
                {categories.map((cat: any) => (
                  <Select.Option key={cat.id} value={cat.id}>{cat.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="uom_id" label="Unit of Measure (UOM)" rules={[{ required: true, message: 'UOM is required' }]}>
              <Select placeholder="Select UOM" style={{ borderRadius: 8 }}>
                {uoms.map((uom: any) => (
                  <Select.Option key={uom.id} value={uom.id}>{uom.name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="selling_price" label="Selling Price (Rp)" rules={[{ required: true }]}>
              <InputNumber
                min={0}
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={value => value?.replace(/\./g, '') as any}
                style={{ width: '100%', borderRadius: 8 }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="standard_cost" label="Standard Cost (Rp)" rules={[{ required: true }]}>
              <InputNumber
                min={0}
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={value => value?.replace(/\./g, '') as any}
                style={{ width: '100%', borderRadius: 8 }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="reorder_point" label="Reorder Point Threshold (Qty)">
          <InputNumber min={0} style={{ width: '100%', borderRadius: 8 }} placeholder="Minimum stock warning limit" />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default ProductDrawer;
