import React, { useState } from 'react';
import { Table, Typography, Card, Tag, Input, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery } from '@tanstack/react-query';
import { SearchOutlined, SafetyCertificateOutlined, FileTextOutlined } from '@ant-design/icons';
import api from '../../../lib/api';
import { ActionableEmptyState } from '../../../components/common/ActionableEmptyState';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const AuditTrailPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/api/v1/audit-logs').then(r => r.data),
  });

  const getActionTag = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <Tag color="green" style={{ borderRadius: 6, fontWeight: 600 }}>CREATE</Tag>;
      case 'UPDATE':
        return <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>UPDATE</Tag>;
      case 'DELETE':
        return <Tag color="red" style={{ borderRadius: 6, fontWeight: 600 }}>DELETE</Tag>;
      case 'APPROVE':
        return <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600 }}>APPROVE</Tag>;
      case 'REJECT':
        return <Tag color="volcano" style={{ borderRadius: 6, fontWeight: 600 }}>REJECT</Tag>;
      case 'LOGIN':
        return <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 600 }}>LOGIN</Tag>;
      default:
        return <Tag style={{ borderRadius: 6 }}>{action}</Tag>;
    }
  };

  const rawLogs: any[] = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
    : [];

  const filteredLogs = rawLogs.filter((log: any) => {
    if (dateRange && dateRange[0] && dateRange[1]) {
      const logDate = new Date(log.created_at || log.timestamp).getTime();
      const start = dateRange[0].startOf('day').valueOf();
      const end = dateRange[1].endOf('day').valueOf();
      if (logDate < start || logDate > end) return false;
    }
    if (!search) return true;
    const term = search.toLowerCase();
    const userStr = String(log.user_id || log.user || '').toLowerCase();
    const entityStr = String(log.entity_type || log.entity || '').toLowerCase();
    const actionStr = String(log.action || '').toLowerCase();
    const idStr = String(log.entity_id || log.record_id || '').toLowerCase();
    return userStr.includes(term) || entityStr.includes(term) || actionStr.includes(term) || idStr.includes(term);
  });

  const columns: ColumnsType<any> = [
    {
      title: 'TIMESTAMP',
      dataIndex: 'created_at',
      width: 170,
      render: (d, r) => {
        const val = d || r.timestamp;
        return (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, monospace)' }}>
            {val ? new Date(val).toLocaleString('id-ID') : '—'}
          </span>
        );
      }
    },
    {
      title: 'USER',
      dataIndex: 'user_id',
      render: (u, r) => <Text style={{ fontWeight: 600, fontSize: 13 }}>{u || r.user || 'System'}</Text>
    },
    {
      title: 'ACTION',
      dataIndex: 'action',
      width: 120,
      render: getActionTag
    },
    {
      title: 'ENTITY',
      dataIndex: 'entity_type',
      width: 140,
      render: (e, r) => <Text style={{ fontSize: 13, fontWeight: 500 }}>{e || r.entity || '—'}</Text>
    },
    {
      title: 'RECORD ID',
      dataIndex: 'entity_id',
      render: (t, r) => {
        const id = t || r.record_id;
        return (
          <span style={{
            padding: '2px 8px',
            background: 'var(--solid-bg-subtle)',
            border: '1px solid var(--solid-border)',
            borderRadius: 6,
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 12,
            color: 'var(--brand-600)'
          }}>
            {id || '—'}
          </span>
        );
      }
    },
    {
      title: 'IP ADDRESS',
      dataIndex: 'ip_address',
      width: 140,
      render: (t, r) => <Text type="secondary" style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)' }}>{t || r.ip || '127.0.0.1'}</Text>
    },
  ];

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
          <SafetyCertificateOutlined />
          <span>Security & Compliance Audit</span>
        </div>

        <Title level={2} className="page-title" style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>
          Audit Trail & Activity Log
        </Title>
        <Text className="page-subtitle" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          System-wide immutable activity logs, user action tracking, and security monitoring.
        </Text>
      </div>

      <Card
        styles={{ body: { padding: 24 } }}
        style={{
          borderRadius: 20,
          border: '1px solid var(--solid-border)',
          boxShadow: 'var(--shadow-sm)',
          background: 'var(--solid-bg)'
        }}
      >
        <div style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <Input
            placeholder="Search user, action, or entity..."
            prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ maxWidth: 360, borderRadius: 10 }}
            aria-label="Cari log audit"
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as any)}
            style={{ borderRadius: 10 }}
            aria-label="Filter rentang tanggal audit"
          />
        </div>

        {filteredLogs.length === 0 && !isLoading ? (
          <ActionableEmptyState
            title="No Activity Logs Recorded"
            description="System activity logs and audit entries will automatically appear here."
            icon={<FileTextOutlined />}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredLogs}
            rowKey="id"
            size="middle"
            loading={isLoading}
            pagination={{ pageSize: 12 }}
            scroll={{ x: 'max-content' }}
            style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
          />
        )}
      </Card>
    </div>
  );
};

export default AuditTrailPage;
