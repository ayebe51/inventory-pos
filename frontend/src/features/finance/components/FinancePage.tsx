import React, { useState } from 'react';
import { 
  Row, Col, Card, Typography, Button, Space, 
  Table, Statistic 
} from 'antd';
import { 
  FileTextOutlined, PlusOutlined, BookOutlined 
} from '@ant-design/icons';
import { useFinanceData } from '../hooks/useFinance';
import { JournalEntryModal } from './JournalEntryModal';

const { Title, Text } = Typography;

export const FinancePage: React.FC = () => {
  const { data, isLoading } = useFinanceData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (d: string) => new Date(d).toLocaleDateString('id-ID'),
    },
    {
      title: 'Description',
      dataIndex: 'desc',
      key: 'desc',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      render: (amount: number, record: any) => (
        <Text style={{ color: record.type === 'credit' ? '#34d399' : '#f43f5e', fontWeight: 500 }}>
          {record.type === 'credit' ? '+' : '-'} Rp {amount.toLocaleString('id-ID')}
        </Text>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>
            Finance & Accounting
          </Title>
          <Text className="page-subtitle">Track ledger, invoices, and journal entries.</Text>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card 
            title="Recent Transactions" 
            extra={<Button type="link">View Full Ledger</Button>}
            className="stat-card"
          >
            <Table
              dataSource={data?.recentTransactions}
              columns={columns}
              rowKey="id"
              pagination={false}
              loading={isLoading}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card className="stat-card">
              <Statistic
                title="Current Cash Balance"
                value={data?.currentCashBalance || 0}
                precision={0}
                prefix="Rp"
                loading={isLoading}
                valueStyle={{ color: '#8B5CF6', fontWeight: 600 }}
              />
            </Card>

            <Card title="Quick Actions" className="stat-card">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button block icon={<PlusOutlined />} style={{ textAlign: 'left' }}>
                  Create Invoice
                </Button>
                <Button block icon={<FileTextOutlined />} style={{ textAlign: 'left' }}>
                  Record Expense
                </Button>
                <Button 
                  block 
                  type="primary" 
                  icon={<BookOutlined />} 
                  onClick={() => setIsModalOpen(true)}
                  style={{ textAlign: 'left' }}
                >
                  Manual Journal
                </Button>
              </Space>
            </Card>
          </Space>
        </Col>
      </Row>

      <JournalEntryModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
