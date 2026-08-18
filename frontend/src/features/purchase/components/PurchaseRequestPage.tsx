import React, { useState } from 'react';
import {
  Table, Button, Input, Space, Tag, Typography
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined, SearchOutlined
} from '@ant-design/icons';
import { usePurchaseRequests } from '../hooks/usePurchase';

const { Title, Text } = Typography;

const PR_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94A3B8',
  PENDING_APPROVAL: '#FBBF24',
  APPROVED: '#34D399',
  REJECTED: '#F43F5E',
  CLOSED: '#64748B',
};

export const PurchaseRequestPage: React.FC = () => {
  const [search, setSearch] = useState('');
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
          Rp {val?.toLocaleString('id-ID') ?? '—'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 150,
      render: (status) => (
        <Tag style={{
          color: PR_STATUS_COLORS[status],
          background: `${PR_STATUS_COLORS[status]}18`,
          borderColor: `${PR_STATUS_COLORS[status]}30`,
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
      render: () => (
        <Space size={4}>
          <Button type="link" size="small">View</Button>
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
            onClick={() => {}}
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
    </div>
  );
};
