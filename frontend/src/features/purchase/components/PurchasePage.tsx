import React, { useState } from 'react';
import {
  Table, Button, Input, Space, Tag, Typography,
  Card, Tooltip, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, SearchOutlined, CheckOutlined,
  CloseOutlined, FileDoneOutlined, ReloadOutlined, RollbackOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { usePurchaseOrders, useApprovePO, useRejectPO } from '../hooks/usePurchase';
import type { PurchaseOrder } from '../types/purchase.types';
import { PurchaseDrawer } from './PurchaseDrawer';
import { GoodsReceiptDrawer } from './GoodsReceiptDrawer';
import { PurchaseReturnDrawer } from './PurchaseReturnDrawer';

const { Title, Text } = Typography;

const PO_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94A3B8',
  PENDING_APPROVAL: '#FBBF24',
  APPROVED: 'var(--brand-600)',
  PARTIALLY_RECEIVED: '#F97316',
  FULLY_RECEIVED: '#34D399',
  CANCELLED: '#F43F5E',
  CLOSED: '#64748B',
};

export const PurchasePage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [grDrawerOpen, setGrDrawerOpen] = useState(false);
  const [returnDrawerOpen, setReturnDrawerOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [search, setSearch] = useState('');

  const activeKey = location.pathname.includes('/receipts')
    ? 'receipts'
    : location.pathname.includes('/returns')
    ? 'returns'
    : 'orders';

  const { data, isLoading, refetch } = usePurchaseOrders({ search: search || '' });
  const { data: returnsData, isLoading: isReturnsLoading, refetch: refetchReturns } = useQuery({
    queryKey: ['purchase-returns'],
    queryFn: () => api.get('/api/v1/purchase-returns').then((r: any) => r.data),
    enabled: activeKey === 'returns',
  });

  const { data: grData, isLoading: isGrLoading, refetch: refetchGR } = useQuery({
    queryKey: ['goods-receipts'],
    queryFn: () => api.get('/api/v1/goods-receipts').then((r: any) => r.data),
    enabled: activeKey === 'receipts',
  });

  const grColumns: ColumnsType<any> = [
    {
      title: 'GR Number',
      dataIndex: 'gr_number',
      width: 180,
      render: (num) => <Text code style={{ color: 'var(--brand-600)' }}>{num}</Text>,
    },
    {
      title: 'PO Number',
      dataIndex: ['purchase_order', 'po_number'],
      render: (num) => <Text code>{num || '—'}</Text>,
    },
    {
      title: 'Supplier',
      dataIndex: ['purchase_order', 'supplier', 'name'],
      ellipsis: true,
      render: (s, r) => s || r.supplier?.name || '—',
    },
    {
      title: 'Receipt Date',
      dataIndex: 'receipt_date',
      width: 130,
      render: (d) => d ? new Date(d).toLocaleDateString('id-ID') : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 140,
      render: (status) => (
        <Tag color={status === 'CONFIRMED' ? 'green' : status === 'DRAFT' ? 'orange' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          {record.status === 'DRAFT' && (
            <Button
              size="small"
              type="primary"
              onClick={async () => {
                try {
                  await api.put(`/api/v1/goods-receipts/${record.id}/confirm`);
                  message.success('Goods receipt confirmed and stock updated');
                  refetchGR();
                } catch (err: any) {
                  message.error(err?.response?.data?.message || 'Failed to confirm');
                }
              }}
            >
              Confirm
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const approvePO = useApprovePO();
  const rejectPO = useRejectPO();

  const handleTabChange = (key: 'orders' | 'receipts' | 'returns') => {
    if (key === 'receipts') navigate('/purchase/receipts');
    else if (key === 'returns') navigate('/purchase/returns');
    else navigate('/purchase');
  };

  const columns: ColumnsType<PurchaseOrder> = [
    {
      title: 'PO Number',
      dataIndex: 'po_number',
      width: 180,
      render: (num) => <Text code style={{ color: 'var(--brand-600)' }}>{num}</Text>,
    },
    {
      title: 'Supplier',
      dataIndex: ['supplier', 'name'],
      ellipsis: true,
    },
    {
      title: 'Order Date',
      dataIndex: 'order_date',
      width: 130,
      render: (d) => new Date(d).toLocaleDateString('id-ID'),
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      align: 'right',
      width: 180,
      render: (val) => (
        <Text className="number-display" style={{ fontWeight: 600 }}>
          Rp {val?.toLocaleString('id-ID') ?? '—'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 180,
      render: (status) => (
        <Tag style={{
          color: PO_STATUS_COLORS[status],
          background: `${PO_STATUS_COLORS[status]}18`,
          borderColor: `${PO_STATUS_COLORS[status]}30`,
        }}>
          {status?.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      align: 'center',
      render: (_, record) => (
        <Space size={8}>
          {record.status === 'PENDING_APPROVAL' && (
            <>
              <Tooltip title="Approve PO">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined style={{ color: '#34D399' }} />}
                  loading={approvePO.isPending}
                  onClick={() => approvePO.mutate(record.id)}
                />
              </Tooltip>
              <Tooltip title="Reject PO">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  loading={rejectPO.isPending}
                  onClick={() => rejectPO.mutate({ id: record.id, reason: 'Rejected by manager' })}
                />
              </Tooltip>
            </>
          )}
          {['APPROVED', 'PARTIALLY_RECEIVED'].includes(record.status) && (
            <Tooltip title="Receive Goods (GR)">
              <Button
                type="text"
                size="small"
                icon={<FileDoneOutlined style={{ color: 'var(--brand-600)' }} />}
                onClick={() => { setSelectedPO(record); setGrDrawerOpen(true); }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const returnColumns: ColumnsType<any> = [
    {
      title: 'Return #',
      dataIndex: 'return_number',
      width: 180,
      render: (v) => <Text code style={{ color: '#F43F5E' }}>{v}</Text>,
    },
    {
      title: 'Supplier',
      dataIndex: ['supplier', 'name'],
      ellipsis: true,
    },
    {
      title: 'Warehouse',
      dataIndex: ['warehouse', 'name'],
    },
    {
      title: 'Date',
      dataIndex: 'return_date',
      width: 130,
      render: (d) => new Date(d).toLocaleDateString('id-ID'),
    },
    {
      title: 'Total Amount',
      dataIndex: 'total_amount',
      align: 'right',
      width: 180,
      render: (v) => <Text className="number-display" style={{ fontWeight: 600 }}>Rp {v?.toLocaleString('id-ID') ?? '—'}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (s) => <Tag color="error">{s}</Tag>,
    },
  ];

  return (
    <div className="page-container" style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 999,
          background: 'var(--brand-50)',
          border: '1px solid var(--brand-200)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--brand-600)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 8
        }}>
          <span>Procurement & Supply Chain</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} className="page-title" style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>
              Purchasing Management
            </Title>
            <Text style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Manage purchase orders, receiving, and vendor returns.
            </Text>
          </div>

          <Space>
            {activeKey === 'returns' ? (
              <Button
                type="primary"
                danger
                icon={<RollbackOutlined />}
                onClick={() => setReturnDrawerOpen(true)}
                style={{ height: 40, borderRadius: 10, fontWeight: 700 }}
              >
                Buat Retur Pembelian
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setDrawerOpen(true)}
                style={{ height: 40, borderRadius: 10, fontWeight: 700, boxShadow: '0 4px 12px var(--brand-glow)' }}
              >
                Create PO
              </Button>
            )}
          </Space>
        </div>
      </div>

      <Card
        bodyStyle={{ padding: 24 }}
        style={{
          borderRadius: 20,
          border: '1px solid var(--solid-border)',
          boxShadow: 'var(--shadow-sm)',
          background: 'var(--solid-bg)'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 6,
          background: 'var(--solid-bg-subtle)',
          border: '1px solid var(--solid-border)',
          borderRadius: 14,
          marginBottom: 24,
          overflowX: 'auto'
        }}>
          <button
            onClick={() => handleTabChange('orders')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 20px',
              borderRadius: 9999,
              border: 'none',
              background: activeKey === 'orders' ? '#18181B' : 'transparent',
              color: activeKey === 'orders' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: activeKey === 'orders' ? 600 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              boxShadow: activeKey === 'orders' ? '0 4px 12px rgba(24, 24, 27, 0.25)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>Purchase Orders</span>
          </button>

          <button
            onClick={() => handleTabChange('receipts')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 20px',
              borderRadius: 9999,
              border: 'none',
              background: activeKey === 'receipts' ? '#18181B' : 'transparent',
              color: activeKey === 'receipts' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: activeKey === 'receipts' ? 600 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              boxShadow: activeKey === 'receipts' ? '0 4px 12px rgba(24, 24, 27, 0.25)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>Goods Receipts</span>
          </button>

          <button
            onClick={() => handleTabChange('returns')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 20px',
              borderRadius: 9999,
              border: 'none',
              background: activeKey === 'returns' ? '#18181B' : 'transparent',
              color: activeKey === 'returns' ? '#FFFFFF' : 'var(--text-secondary)',
              fontWeight: activeKey === 'returns' ? 600 : 500,
              fontSize: 13.5,
              cursor: 'pointer',
              boxShadow: activeKey === 'returns' ? '0 4px 12px rgba(24, 24, 27, 0.25)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>Purchase Returns (Retur Beli)</span>
          </button>
        </div>

        {activeKey === 'orders' ? (
          <>
            <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
              <Input
                placeholder="Search PO number or supplier..."
                prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                style={{ maxWidth: 360, borderRadius: 10 }}
              />
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ borderRadius: 8 }}>
                Refresh
              </Button>
            </div>
            <Table
              columns={columns}
              dataSource={data?.data}
              loading={isLoading}
              rowKey="id"
              scroll={{ x: 900 }}
              pagination={{ pageSize: 10, showTotal: (t) => `${t} total purchase orders` }}
              size="middle"
              style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
            />
          </>
        ) : activeKey === 'returns' ? (
          <>
            <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button icon={<ReloadOutlined />} onClick={() => refetchReturns()} style={{ borderRadius: 8 }}>
                Refresh
              </Button>
            </div>
            <Table
              columns={returnColumns}
              dataSource={returnsData?.data || []}
              loading={isReturnsLoading}
              rowKey="id"
              scroll={{ x: 800 }}
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          </>
        ) : (
          <>
            <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button icon={<ReloadOutlined />} onClick={() => refetchGR()} style={{ borderRadius: 8 }}>
                Refresh
              </Button>
            </div>
            <Table
              columns={grColumns}
              dataSource={grData?.data || []}
              loading={isGrLoading}
              rowKey="id"
              scroll={{ x: 800 }}
              pagination={{ pageSize: 10, showTotal: (t) => `${t} total goods receipts` }}
              size="middle"
              style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
            />
          </>
        )}
      </Card>

      <PurchaseDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <GoodsReceiptDrawer
        open={grDrawerOpen}
        onClose={() => { setGrDrawerOpen(false); setSelectedPO(null); }}
        purchaseOrder={selectedPO}
      />
      <PurchaseReturnDrawer
        open={returnDrawerOpen}
        onClose={() => setReturnDrawerOpen(false)}
      />
    </div>
  );
};
