import React, { useState } from 'react';
import { Table, Typography, Tag, Space, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';

const { Text } = Typography;

export const StockLedgerPage: React.FC = () => {
  const [productId, setProductId] = useState<string | undefined>();
  const [warehouseId, setWarehouseId] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-ledger', { productId, warehouseId }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (productId) params.append('product_id', productId);
      if (warehouseId) params.append('warehouse_id', warehouseId);
      return api.get(`/api/v1/inventory/ledger?${params.toString()}`).then((r) => r.data);
    },
  });

  const columns: ColumnsType<any> = [
    {
      title: 'Date',
      dataIndex: 'movement_date',
      render: (d) => new Date(d).toLocaleString('id-ID'),
    },
    {
      title: 'Product',
      dataIndex: ['product', 'name'],
    },
    {
      title: 'Warehouse',
      dataIndex: ['warehouse', 'name'],
    },
    {
      title: 'Transaction Type',
      dataIndex: 'transaction_type',
      render: (type) => (
        <Tag color={type === 'SALE' || type === 'ADJUSTMENT_OUT' || type === 'TRANSFER_OUT' ? 'red' : 'green'}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Ref. Number',
      dataIndex: 'reference_number',
      render: (ref) => <Text code>{ref}</Text>
    },
    {
      title: 'In',
      dataIndex: 'qty_in',
      align: 'right',
      render: (val) => val > 0 ? <Text style={{ color: '#52c41a' }}>+{val}</Text> : '-',
    },
    {
      title: 'Out',
      dataIndex: 'qty_out',
      align: 'right',
      render: (val) => val > 0 ? <Text style={{ color: '#ff4d4f' }}>-{val}</Text> : '-',
    },
    {
      title: 'Running Balance',
      dataIndex: 'running_qty',
      align: 'right',
      render: (val) => <strong>{val}</strong>,
    },
  ];

  return (
    <div style={{ padding: '24px 0' }}>
      <Space style={{ marginBottom: 16 }}>
        <Input 
          placeholder="Filter by Product ID (UUID)"
          value={productId}
          onChange={e => setProductId(e.target.value)}
          prefix={<SearchOutlined />}
          style={{ width: 250 }}
          allowClear
        />
        <Input 
          placeholder="Filter by Warehouse ID (UUID)"
          value={warehouseId}
          onChange={e => setWarehouseId(e.target.value)}
          prefix={<SearchOutlined />}
          style={{ width: 250 }}
          allowClear
        />
      </Space>

      <Table
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={isLoading}
        size="small"
        pagination={{ pageSize: 50 }}
      />
    </div>
  );
};
