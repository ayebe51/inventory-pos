import React, { useState } from 'react';
import {
  Drawer, Form, Table, Button, Input, InputNumber,
  Select, Space, Typography, Divider, message,
  Row, Col, Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PurchaseOrder } from '../types/purchase.types';
import { useConfirmGoodsReceipt } from '../hooks/usePurchase';

const { Text } = Typography;

interface GoodsReceiptLine {
  key: string;
  product_id: string;
  product_name: string;
  qty_ordered: number;
  qty_received_before: number;
  qty_to_receive: number;
  unit_cost: number;
  uom_id: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  purchaseOrder: PurchaseOrder | null;
}

export const GoodsReceiptDrawer: React.FC<Props> = ({ open, onClose, purchaseOrder }) => {
  const [form] = Form.useForm();
  const confirmGR = useConfirmGoodsReceipt();

  if (!purchaseOrder) return null;

  const initialLines: GoodsReceiptLine[] = (purchaseOrder.lines || []).map((line: any, idx: number) => ({
    key: String(idx),
    product_id: line.product_id,
    product_name: line.product?.name || line.product_id,
    qty_ordered: line.qty_ordered,
    qty_received_before: line.qty_received || 0,
    qty_to_receive: line.qty_ordered - (line.qty_received || 0),
    unit_cost: line.unit_price,
    uom_id: line.uom_id,
  }));

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await confirmGR.mutateAsync({
        po_id: purchaseOrder.id,
        receipt_date: values.receipt_date || new Date().toISOString().split('T')[0],
        notes: values.notes,
        lines: initialLines.map((line) => ({
          product_id: line.product_id,
          qty_received: values[`qty_${line.key}`] || 0,
          unit_cost: line.unit_cost,
          uom_id: line.uom_id,
        })),
      });
      message.success('Goods Receipt created and confirmed!');
      onClose();
    } catch (err) {
      // validation inline
    }
  };

  const columns: ColumnsType<GoodsReceiptLine> = [
    {
      title: 'Product',
      dataIndex: 'product_name',
      ellipsis: true,
    },
    {
      title: 'Ordered',
      dataIndex: 'qty_ordered',
      align: 'right',
      width: 90,
      render: (v) => <Text className="number-display">{v}</Text>,
    },
    {
      title: 'Prev. Received',
      dataIndex: 'qty_received_before',
      align: 'right',
      width: 110,
      render: (v) => <Text className="number-display" style={{ color: '#64748B' }}>{v}</Text>,
    },
    {
      title: 'Qty to Receive',
      key: 'qty',
      align: 'right',
      width: 140,
      render: (_, record) => (
        <Form.Item
          name={`qty_${record.key}`}
          initialValue={record.qty_to_receive}
          rules={[
            { required: true },
            {
              validator: (_, val) => {
                const max = (record.qty_ordered - record.qty_received_before) * 1.05;
                if (val > max) return Promise.reject(new Error(`Max: ${max.toFixed(0)} (over-receipt limit)`));
                if (val < 0) return Promise.reject(new Error('Must be >= 0'));
                return Promise.resolve();
              },
            },
          ]}
          style={{ marginBottom: 0 }}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
      ),
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unit_cost',
      align: 'right',
      width: 140,
      render: (v) => <Text className="number-display">Rp {v?.toLocaleString('id-ID')}</Text>,
    },
  ];

  return (
    <Drawer
      title={`Goods Receipt — ${purchaseOrder.po_number}`}
      open={open}
      onClose={onClose}
      width={700}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={confirmGR.isPending}>
            Confirm Receipt
          </Button>
        </Space>
      }
    >
      <Alert
        message="Stock will be updated immediately upon confirmation."
        description="WAC (Weighted Average Cost) will be recalculated. An auto journal entry will be created."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form form={form} layout="vertical">
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="receipt_date" label="Receipt Date">
              <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="notes" label="Notes">
          <Input.TextArea rows={2} placeholder="Condition notes, delivery reference..." />
        </Form.Item>

        <Divider style={{ borderColor: '#2D2D3F' }}>
          <Text style={{ color: '#64748B', fontSize: 12 }}>ITEMS RECEIVED</Text>
        </Divider>

        <Table
          columns={columns}
          dataSource={initialLines}
          pagination={false}
          size="small"
          scroll={{ x: 600 }}
          style={{ marginBottom: 16 }}
        />
      </Form>
    </Drawer>
  );
};
