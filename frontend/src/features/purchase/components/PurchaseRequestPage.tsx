import React, { useState } from 'react';
import {
  Table, Button, Input, Space, Tag, Typography, Modal, Descriptions
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, SearchOutlined, EyeOutlined
} from '@ant-design/icons';
import { usePurchaseRequests } from '../hooks/usePurchase';
import { PurchaseRequestDrawer } from './PurchaseRequestDrawer';

const { Title, Text } = Typography;

const PR_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94A3B8',
  SUBMITTED: '#38BDF8',
  PENDING_APPROVAL: '#FBBF24',
  APPROVED: '#34D399',
  REJECTED: '#F43F5E',
  CANCELLED: '#64748B',
  CLOSED: '#64748B',
};

export const PurchaseRequestPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<any | null>(null);
  const { data, isLoading } = usePurchaseRequests({ search: search || '' });

  const columns: ColumnsType<any> = [
    {
      title: 'PR Number',
      dataIndex: 'pr_number',
      width: 180,
      render: (num) => <Text code style={{ color: '#8B5CF6' }}>{num}</Text>,
    },
    {
      title: 'Branch / Warehouse',
      key: 'location',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.branch?.name || 'HQ'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.warehouse?.name}</Text>
        </Space>
      ),
    },
    {
      title: 'Request Date',
      dataIndex: 'request_date',
      width: 130,
      render: (d) => new Date(d).toLocaleDateString('id-ID'),
    },
    {
      title: 'Total Est. Value',
      dataIndex: 'total_estimated_value',
      align: 'right',
      width: 180,
      render: (val) => (
        <Text style={{ fontWeight: 600 }}>
          Rp {Number(val || 0).toLocaleString('id-ID')}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 150,
      render: (status) => (
        <Tag style={{
          color: PR_STATUS_COLORS[status] || '#94A3B8',
          background: `${PR_STATUS_COLORS[status] || '#94A3B8'}18`,
          borderColor: `${PR_STATUS_COLORS[status] || '#94A3B8'}30`,
        }}>
          {status?.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setViewRecord(record)}
          >
            View
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>
            Purchase Requests
          </Title>
          <Text className="page-subtitle">
            Manage internal requests for goods or services
          </Text>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateOpen(true)}
          >
            New Request
          </Button>
        </Space>
      </div>

      <div className="toolbar" style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by PR number..."
          prefix={<SearchOutlined style={{ color: '#64748B' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={data?.data || []}
        rowKey="id"
        loading={isLoading}
        pagination={{
          total: data?.meta?.total || 0,
          pageSize: 20,
          showSizeChanger: true,
        }}
        scroll={{ x: 1000 }}
      />

      <PurchaseRequestDrawer
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      <Modal
        title={`Purchase Request: ${viewRecord?.pr_number || ''}`}
        open={!!viewRecord}
        onCancel={() => setViewRecord(null)}
        footer={<Button onClick={() => setViewRecord(null)}>Close</Button>}
        width={650}
      >
        {viewRecord && (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="PR Number">{viewRecord.pr_number}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={PR_STATUS_COLORS[viewRecord.status]}>{viewRecord.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Branch">{viewRecord.branch?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Warehouse">{viewRecord.warehouse?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Request Date">
                {new Date(viewRecord.request_date).toLocaleDateString('id-ID')}
              </Descriptions.Item>
              <Descriptions.Item label="Total Est. Value">
                Rp {Number(viewRecord.total_estimated_value || 0).toLocaleString('id-ID')}
              </Descriptions.Item>
              {viewRecord.notes && (
                <Descriptions.Item label="Notes" span={2}>{viewRecord.notes}</Descriptions.Item>
              )}
            </Descriptions>

            <Title level={5} style={{ marginTop: 16 }}>Line Items</Title>
            <Table
              dataSource={viewRecord.lines || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: 'Product', dataIndex: ['product', 'name'], render: (name, r: any) => name || r.product_id },
                { title: 'Qty', dataIndex: 'qty_requested', width: 90, align: 'right' },
                {
                  title: 'Est. Price',
                  dataIndex: 'estimated_price',
                  width: 140,
                  align: 'right',
                  render: (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`
                },
                {
                  title: 'Subtotal',
                  key: 'subtotal',
                  width: 140,
                  align: 'right',
                  render: (_, r: any) => `Rp ${(Number(r.qty_requested || 0) * Number(r.estimated_price || 0)).toLocaleString('id-ID')}`
                },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
