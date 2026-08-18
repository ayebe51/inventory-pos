import React, { useState } from 'react';
import {
  Table, Button, Input, Space, Tag, Tabs, Typography,
  Card, Tooltip, Badge,
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
  APPROVED: '#8B5CF6',
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
      render: (num) => <Text code style={{ color: '#A78BFA' }}>{num}</Text>,
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
                style={{ color: '#8B5CF6' }}
                onClick={() => { setSelectedPO(record); setGrDrawerOpen(true); }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const tabs = [
    {
      key: 'orders',
      label: 'Purchase Orders',
      children: (
        <>
          <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
            <Input
              placeholder="Search PO number or supplier..."
              prefix={<SearchOutlined style={{ }} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ maxWidth: 400 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} style={{ color: '#94A3B8' }}>Refresh</Button>
          </div>
          <Table
            columns={columns}
            dataSource={data?.data}
            loading={isLoading}
            rowKey="id"
            scroll={{ x: 900 }}
            pagination={{ pageSize: 15, showTotal: (t) => `${t} purchase orders` }}
          />
        </>
      ),
    },
    {
      key: 'receipts',
      label: (
        <span>
          Goods Receipts
          <Badge count={3} size="small" style={{ marginLeft: 8, background: '#8B5CF6' }} />
        </span>
      ),
      children: (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          Goods Receipts will be shown here.
          <br />
          <Text style={{ color: '#475569', fontSize: 12 }}>
            Create a GR by clicking the receipt icon on an Approved PO.
          </Text>
        </div>
      ),
    },
  ];

  const activeKey = location.pathname.includes('/receipts') ? 'receipts' : 'orders';
  const handleTabChange = (key: string) => {
    navigate(key === 'receipts' ? '/purchase/receipts' : '/purchase');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>
            Purchasing
          </Title>
          <Text className="page-subtitle">Manage purchase orders, approvals, and goods receipts</Text>
        </div>
        {activeKey === 'orders' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>
            Create PO
          </Button>
        )}
      </div>

      <Card className="stat-card">
        <Tabs items={tabs} activeKey={activeKey} onChange={handleTabChange} />
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
