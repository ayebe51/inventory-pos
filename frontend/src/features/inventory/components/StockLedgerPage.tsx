import React, { useState } from 'react';
import { Table, Typography, Tag, Select, Card, Row, Col, Statistic, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, DatabaseOutlined, ArrowUpOutlined, ArrowDownOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { ActionableEmptyState } from '../../../components/common/ActionableEmptyState';

const { Title, Text } = Typography;

export const StockLedgerPage: React.FC = () => {
  const [productId, setProductId] = useState<string | undefined>();
  const [warehouseId, setWarehouseId] = useState<string | undefined>();

  // Fetch product list for dropdown selector
  const { data: productsData } = useQuery({
    queryKey: ['master-products-lookup'],
    queryFn: () => api.get('/api/v1/master-data/products?per_page=100').then((r) => r.data),
  });

  // Fetch warehouse list for dropdown selector
  const { data: warehousesData } = useQuery({
    queryKey: ['master-warehouses-lookup'],
    queryFn: () => api.get('/api/v1/warehouses').then((r) => r.data),
  });

  const productList: any[] = Array.isArray(productsData?.data) ? productsData.data : Array.isArray(productsData) ? productsData : [];
  const warehouseList: any[] = Array.isArray(warehousesData?.data) ? warehousesData.data : Array.isArray(warehousesData) ? warehousesData : [];

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inventory-ledger', { productId, warehouseId }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (productId) params.append('product_id', productId);
      if (warehouseId) params.append('warehouse_id', warehouseId);
      return api.get(`/api/v1/inventory/ledger?${params.toString()}`).then((r) => r.data);
    },
  });

  const rawEntries: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

  const totalIn = rawEntries.reduce((sum, item) => sum + (Number(item.qty_in) || 0), 0);
  const totalOut = rawEntries.reduce((sum, item) => sum + (Number(item.qty_out) || 0), 0);
  const netFlow = totalIn - totalOut;

  const columns: ColumnsType<any> = [
    {
      title: 'Date / Time',
      dataIndex: 'movement_date',
      width: 160,
      render: (d) => new Date(d).toLocaleString('id-ID'),
    },
    {
      title: 'Product',
      dataIndex: ['product', 'name'],
      width: 220,
      render: (name, record) => (
        <div>
          <Text strong style={{ display: 'block' }}>{name || record.product_id}</Text>
          {record.product?.code && (
            <Text code style={{ fontSize: 11, color: '#F05328' }}>{record.product.code}</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Warehouse',
      dataIndex: ['warehouse', 'name'],
      width: 170,
      render: (name, record) => (
        <Tag color="geekblue" style={{ borderRadius: 6, fontWeight: 500 }}>
          {name || record.warehouse_id}
        </Tag>
      ),
    },
    {
      title: 'Transaction Type',
      dataIndex: 'transaction_type',
      width: 150,
      render: (type) => {
        const isNegative = type === 'SALE' || type === 'ADJUSTMENT_OUT' || type === 'TRANSFER_OUT';
        return (
          <Tag color={isNegative ? 'volcano' : 'green'} style={{ borderRadius: 6, fontWeight: 600 }}>
            {type}
          </Tag>
        );
      },
    },
    {
      title: 'Ref. Number',
      dataIndex: 'reference_number',
      width: 180,
      render: (ref) => <Text code style={{ color: '#F05328' }}>{ref}</Text>,
    },
    {
      title: 'In (+)',
      dataIndex: 'qty_in',
      align: 'right',
      width: 90,
      render: (val) => val > 0 ? <Text style={{ color: '#34D399', fontWeight: 600 }}>+{val}</Text> : <span style={{ color: '#64748B' }}>-</span>,
    },
    {
      title: 'Out (-)',
      dataIndex: 'qty_out',
      align: 'right',
      width: 90,
      render: (val) => val > 0 ? <Text style={{ color: '#F43F5E', fontWeight: 600 }}>-{val}</Text> : <span style={{ color: '#64748B' }}>-</span>,
    },
    {
      title: 'Running Balance',
      dataIndex: 'running_qty',
      align: 'right',
      width: 130,
      render: (val) => <strong className="number-display" style={{ color: '#F05328', fontSize: 13 }}>{val}</strong>,
    },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>
            Stock Ledger & Audit Trail
          </Title>
          <Text className="page-subtitle">
            Catatan pergerakan mutasi stok barang dan running balance per gudang secara realtime
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
          Refresh
        </Button>
      </div>

      {/* KPI Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Total Mutasi Terdata"
              value={rawEntries.length}
              prefix={<DatabaseOutlined style={{ color: '#F05328' }} />}
              suffix="entri"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Total Masuk (Inflow)"
              value={totalIn}
              prefix={<ArrowUpOutlined style={{ color: '#34D399' }} />}
              styles={{ content: { color: '#34D399', fontWeight: 600 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Total Keluar (Outflow)"
              value={totalOut}
              prefix={<ArrowDownOutlined style={{ color: '#F43F5E' }} />}
              styles={{ content: { color: '#F43F5E', fontWeight: 600 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="Net Inventory Movement"
              value={netFlow}
              prefix={<AppstoreOutlined style={{ color: '#3B82F6' }} />}
              styles={{ content: { color: netFlow >= 0 ? '#34D399' : '#F43F5E', fontWeight: 700 } }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters and Table */}
      <Card className="stat-card">
        <div style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Select
            showSearch
            allowClear
            placeholder="Cari & Filter Produk..."
            value={productId}
            onChange={(val) => setProductId(val)}
            style={{ width: 280 }}
            optionFilterProp="children"
            filterOption={(input, option) =>
              String(option?.children || '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {productList.map((p: any) => (
              <Select.Option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </Select.Option>
            ))}
          </Select>

          <Select
            showSearch
            allowClear
            placeholder="Pilih Lokasi Gudang..."
            value={warehouseId}
            onChange={(val) => setWarehouseId(val)}
            style={{ width: 240 }}
            optionFilterProp="children"
            filterOption={(input, option) =>
              String(option?.children || '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {warehouseList.map((w: any) => (
              <Select.Option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </Select.Option>
            ))}
          </Select>

          {(productId || warehouseId) && (
            <Button
              type="link"
              onClick={() => {
                setProductId(undefined);
                setWarehouseId(undefined);
              }}
            >
              Reset Filter
            </Button>
          )}
        </div>

        <Table
          columns={columns}
          dataSource={rawEntries}
          rowKey="id"
          loading={isLoading}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} riwayat mutasi` }}
          scroll={{ x: 900 }}
          locale={{
            emptyText: (
              <ActionableEmptyState
                title="Belum Ada Catatan Mutasi"
                description={
                  productId || warehouseId
                    ? 'Tidak ditemukan riwayat mutasi untuk filter produk atau gudang yang dipilih.'
                    : 'Belum ada transaksi keluar-masuk barang yang tercatat pada buku besar persediaan.'
                }
              />
            ),
          }}
        />
      </Card>
    </div>
  );
};

