import React, { useState } from 'react';
import {
  Table, Button, Input, Space, Tag, Typography,
  Card, Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, SearchOutlined, CheckOutlined,
  CloseOutlined, FileDoneOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePurchaseOrders, useApprovePO, useRejectPO } from '../hooks/usePurchase';
import type { PurchaseOrder } from '../types/purchase.types';
import { PurchaseDrawer } from './PurchaseDrawer';
import { GoodsReceiptDrawer } from './GoodsReceiptDrawer';

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
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = usePurchaseOrders({ search: search || '' });
  const approvePO = useApprovePO();
  const rejectPO = useRejectPO();

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
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'PENDING_APPROVAL' && (
            <>
              <Tooltip title="Approve">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  style={{ color: '#34D399' }}
                  onClick={() => approvePO.mutate(record.id)}
                  loading={approvePO.isPending}
                />
              </Tooltip>
              <Tooltip title="Reject">
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  danger
                  onClick={() => rejectPO.mutate({ id: record.id, reason: 'Rejected by manager' })}
                />
              </Tooltip>
            </>
          )}
          {(record.status === 'APPROVED' || record.status === 'PARTIALLY_RECEIVED') && (
            <Tooltip title="Create Goods Receipt">
              <Button
                type="text"
                size="small"
                icon={<FileDoneOutlined />}
                style={{ color: 'var(--brand-600)' }}
                onClick={() => { setSelectedPO(record); setGrDrawerOpen(true); }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const activeKey = location.pathname.includes('/receipts') ? 'receipts' : 'orders';
  const handleTabChange = (key: string) => {
    navigate(key === 'receipts' ? '/purchase/receipts' : '/purchase');
  };

  return (
    <div className="page-container" style={{ paddingBottom: 40 }}>
      {/* Eyebrow Header */}
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
          <span>Procurement & Vendor Management</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Title level={2} className="page-title" style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>
              Procurement & Purchase
            </Title>
            <Text className="page-subtitle" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              Manage vendor purchase orders, approval workflows, and receiving goods (GR).
            </Text>
          </div>

          {activeKey === 'orders' && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setDrawerOpen(true)}
              style={{ height: 40, borderRadius: 10, fontWeight: 700, boxShadow: '0 4px 12px var(--brand-glow)' }}
            >
              Create PO
            </Button>
          )}
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
        {/* Custom Pill Navigation Bar */}
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
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: activeKey === 'orders' ? 'var(--solid-bg)' : 'transparent',
              color: activeKey === 'orders' ? 'var(--brand-600)' : 'var(--text-secondary)',
              fontWeight: activeKey === 'orders' ? 700 : 600,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: activeKey === 'orders' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
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
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: activeKey === 'receipts' ? 'var(--solid-bg)' : 'transparent',
              color: activeKey === 'receipts' ? 'var(--brand-600)' : 'var(--text-secondary)',
              fontWeight: activeKey === 'receipts' ? 700 : 600,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: activeKey === 'receipts' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>Goods Receipts</span>
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
        ) : (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <Text style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>
              Goods receipts generated from approved Purchase Orders will appear here.
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              To record a new delivery, click the receipt icon on an Approved PO in the Purchase Orders tab.
            </Text>
          </div>
        )}
      </Card>

      <PurchaseDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <GoodsReceiptDrawer
        open={grDrawerOpen}
        onClose={() => { setGrDrawerOpen(false); setSelectedPO(null); }}
        purchaseOrder={selectedPO}
      />
    </div>
  );
};
