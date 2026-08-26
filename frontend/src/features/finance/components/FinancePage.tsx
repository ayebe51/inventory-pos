import React, { useState } from 'react';
import {
  Row, Col, Card, Typography, Button, Space,
  Table, Statistic, Tabs
} from 'antd';
import {
  FileTextOutlined, PlusOutlined, BookOutlined,
  SafetyCertificateOutlined, DollarOutlined,
  BankOutlined, AuditOutlined, ShoppingCartOutlined, TeamOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useFinanceData } from '../hooks/useFinance';
import { JournalEntryModal } from './JournalEntryModal';
import { RecordExpenseModal } from './RecordExpenseModal';
import { ARSubPage } from './ARSubPage';
import { APSubPage } from './APSubPage';
import { CashBankSubPage } from './CashBankSubPage';
import { TaxSubPage } from './TaxSubPage';

const { Title, Text } = Typography;

export const FinancePage: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useFinanceData();
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const columns = [
    {
      title: 'DATE',
      dataIndex: 'date',
      key: 'date',
      width: 140,
      render: (d: string) => (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {d ? new Date(d).toLocaleDateString('id-ID') : '—'}
        </span>
      ),
    },
    {
      title: 'DESCRIPTION / MEMO',
      dataIndex: 'desc',
      key: 'desc',
      render: (desc: string) => <Text style={{ fontWeight: 600, fontSize: 13 }}>{desc || '—'}</Text>,
    },
    {
      title: 'AMOUNT (RP)',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right' as const,
      width: 180,
      render: (amount: number, record: any) => (
        <Text style={{
          color: record.type === 'credit' ? '#10B981' : '#EF4444',
          fontWeight: 700,
          fontFamily: 'var(--font-mono, monospace)'
        }}>
          {record.type === 'credit' ? '+' : '-'} Rp {(amount || 0).toLocaleString('id-ID')}
        </Text>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'overview',
      label: (
        <span>
          <DollarOutlined /> Overview & Ledger
        </span>
      ),
      children: (
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DollarOutlined style={{ color: 'var(--brand-500)' }} />
                  <span style={{ fontWeight: 700, fontSize: 16 }}>Recent Journal Transactions</span>
                </div>
              }
              bodyStyle={{ padding: 20 }}
              style={{
                borderRadius: 20,
                border: '1px solid var(--solid-border)',
                boxShadow: 'var(--shadow-sm)',
                background: 'var(--solid-bg)'
              }}
            >
              <Table
                dataSource={data?.recentTransactions}
                columns={columns}
                rowKey="id"
                scroll={{ x: 'max-content' }}
          pagination={false}
                loading={isLoading}
                size="middle"
                style={{ background: 'var(--solid-bg)', borderRadius: 12, overflow: 'hidden' }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Cash Position Card */}
              <Card
                bodyStyle={{ padding: 24 }}
                style={{
                  borderRadius: 20,
                  border: '1px solid var(--solid-border)',
                  boxShadow: 'var(--shadow-sm)',
                  background: 'var(--solid-bg)'
                }}
              >
                <Statistic
                  title={<Text style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>CURRENT CASH BALANCE</Text>}
                  value={data?.currentCashBalance || 0}
                  precision={0}
                  prefix="Rp"
                  loading={isLoading}
                  valueStyle={{ color: 'var(--brand-600)', fontWeight: 800, fontSize: 28 }}
                />
              </Card>

              {/* Quick Actions Card */}
              <Card
                title={<span style={{ fontWeight: 700, fontSize: 15 }}>Quick Actions</span>}
                bodyStyle={{ padding: 20 }}
                style={{
                  borderRadius: 20,
                  border: '1px solid var(--solid-border)',
                  boxShadow: 'var(--shadow-sm)',
                  background: 'var(--solid-bg)'
                }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Button
                    block
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/invoicing')}
                    style={{
                      height: 42,
                      borderRadius: 10,
                      fontWeight: 600,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start'
                    }}
                  >
                    Create Invoice
                  </Button>

                  <Button
                    block
                    icon={<FileTextOutlined />}
                    onClick={() => setIsExpenseModalOpen(true)}
                    style={{
                      height: 42,
                      borderRadius: 10,
                      fontWeight: 600,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start'
                    }}
                  >
                    Record Expense
                  </Button>

                  <Button
                    block
                    type="primary"
                    icon={<BookOutlined />}
                    onClick={() => setIsJournalModalOpen(true)}
                    style={{
                      height: 42,
                      borderRadius: 10,
                      fontWeight: 700,
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      boxShadow: '0 4px 12px var(--brand-glow)'
                    }}
                  >
                    Manual Journal
                  </Button>
                </Space>
              </Card>
            </Space>
          </Col>
        </Row>
      )
    },
    {
      key: 'ar',
      label: (
        <span>
          <TeamOutlined /> Accounts Receivable (AR)
        </span>
      ),
      children: <ARSubPage />,
    },
    {
      key: 'ap',
      label: (
        <span>
          <ShoppingCartOutlined /> Accounts Payable (AP)
        </span>
      ),
      children: <APSubPage />,
    },
    {
      key: 'cash-bank',
      label: (
        <span>
          <BankOutlined /> Cash & Bank Management
        </span>
      ),
      children: <CashBankSubPage />,
    },
    {
      key: 'tax',
      label: (
        <span>
          <AuditOutlined /> Tax Management (PPN)
        </span>
      ),
      children: <TaxSubPage />,
    },
  ];

  return (
    <div className="page-container" style={{ paddingBottom: 40 }}>
      {/* Eyebrow Header */}
      <div style={{ marginBottom: 20 }}>
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
          <span>Financial Engine & Control Platform</span>
        </div>

        <Title level={2} className="page-title" style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>
          Finance & Accounting Platform
        </Title>
        <Text className="page-subtitle" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Autonomous Financial Engine — General Ledger, Accounts Receivable, Accounts Payable, Cash/Bank & Tax Control.
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        style={{ marginBottom: 20 }}
      />

      {/* Modals */}
      <JournalEntryModal isOpen={isJournalModalOpen} onClose={() => setIsJournalModalOpen(false)} />
      <RecordExpenseModal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} />
    </div>
  );
};

export default FinancePage;
