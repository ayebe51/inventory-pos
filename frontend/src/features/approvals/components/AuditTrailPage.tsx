import React from 'react';
import { Table, Typography, Card, Tag, Input, Space, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { SearchOutlined } from '@ant-design/icons';
import api from '../../../lib/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const AuditTrailPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/api/v1/audit-logs').then(r => r.data),
  });

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'green';
      case 'UPDATE': return 'blue';
      case 'DELETE': return 'red';
      case 'APPROVE': return 'purple';
      case 'REJECT': return 'volcano';
      case 'LOGIN': return 'cyan';
      default: return 'default';
    }
  };

  const columns: ColumnsType<any> = [
    { title: 'Timestamp', dataIndex: 'timestamp', render: (d) => new Date(d).toLocaleString() },
    { title: 'User', dataIndex: 'user' },
    { title: 'Action', dataIndex: 'action', render: (a) => <Tag color={getActionColor(a)}>{a}</Tag> },
    { title: 'Entity', dataIndex: 'entity' },
    { title: 'Record ID', dataIndex: 'record_id', render: (t) => <Text code>{t}</Text> },
    { title: 'IP Address', dataIndex: 'ip', render: (t) => <Text type="secondary">{t}</Text> },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Audit Trail</Title>
          <Text className="page-subtitle">System-wide activity logging and security monitoring</Text>
        </div>
      </div>

      <Card className="stat-card" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Input placeholder="Search user or entity..." prefix={<SearchOutlined />} style={{ width: 250 }} />
          <RangePicker />
        </Space>
        <Table columns={columns} dataSource={data?.data || data} rowKey="id" size="small" loading={isLoading} />
      </Card>
    </div>
  );
};
