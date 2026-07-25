import React, { useState } from 'react';
import {
  Table, Button, Typography, Tag, Space, Upload, message, Card
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UploadOutlined, CheckCircleOutlined, SyncOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export const BankReconciliationPage: React.FC = () => {
  const [matches, setMatches] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleUpload = async (info: any) => {
    if (info.file.status === 'uploading') {
      setUploading(true);
      return;
    }
    if (info.file.status === 'done') {
      setUploading(false);
      const res = info.file.response;
      if (res.success) {
        setMatches(res.data);
        message.success(`${info.file.name} parsed and matched successfully`);
      } else {
        message.error(`Failed: ${res.message}`);
      }
    } else if (info.file.status === 'error') {
      setUploading(false);
      message.error(`${info.file.name} upload failed.`);
    }
  };

  const handleConfirm = async () => {
    const matchedIds = matches.filter(m => m.status === 'MATCHED' && m.payment_id).map(m => m.payment_id);
    if (matchedIds.length === 0) {
      return message.warning('No matched payments to confirm');
    }

    try {
      setConfirming(true);
      const res = await api.post('/bank-reconciliation/confirm', { payment_ids: matchedIds });
      message.success('Reconciliation confirmed successfully');
      setMatches([]);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || 'Failed to confirm reconciliation');
    } finally {
      setConfirming(false);
    }
  };

  const columns: ColumnsType<any> = [
    { title: 'Date', dataIndex: ['statement_row', 'date'] },
    { title: 'Description', dataIndex: ['statement_row', 'description'] },
    { title: 'Statement Amount', dataIndex: ['statement_row', 'amount'], align: 'right', render: (v) => `Rp ${Number(v).toLocaleString()}` },
    { title: 'Sys Payment', dataIndex: 'payment_number', render: (t) => t ? <Text code>{t}</Text> : '-' },
    { title: 'Match Score', dataIndex: 'match_score', align: 'center', render: (v) => (
        <Tag color={v === 100 ? 'green' : v >= 50 ? 'orange' : 'red'}>{v}%</Tag>
      )
    },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={s === 'MATCHED' ? 'green' : 'default'}>{s}</Tag> },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Bank Reconciliation</Title>
          <Text className="page-subtitle">Match bank statements against system records</Text>
        </div>
        <Space>
          <Upload
            name="file"
            action={`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/v1/bank-reconciliation/upload`}
            headers={{ Authorization: `Bearer ${localStorage.getItem('access_token')}` }}
            onChange={handleUpload}
            showUploadList={false}
          >
            <Button type="primary" icon={<UploadOutlined />} loading={uploading}>Upload Statement (CSV)</Button>
          </Upload>
          {matches.length > 0 && (
            <Button type="primary" icon={<CheckCircleOutlined />} style={{ backgroundColor: '#10B981' }} onClick={handleConfirm} loading={confirming}>
              Confirm Matches
            </Button>
          )}
        </Space>
      </div>

      <Card className="stat-card">
        {matches.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
            <UploadOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
            <p>Upload a CSV bank statement to start reconciliation</p>
          </div>
        ) : (
          <Table columns={columns} dataSource={matches} rowKey={(r, i) => r.payment_id || i} size="small" pagination={false} />
        )}
      </Card>
    </div>
  );
};
