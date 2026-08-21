import React, { useState } from 'react';
import { Card, Typography } from 'antd';
import {
  InboxOutlined,
  BookOutlined,
  SwapOutlined,
  FormOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { ProductManagement } from './ProductManagement';
import { StockTransferPage } from './StockTransferPage';
import { StockOpnamePage } from './StockOpnamePage';
import { StockLedgerPage } from './StockLedgerPage';

const { Title, Text } = Typography;

export const InventoryPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('products');

  const tabItems = [
    { key: 'products', label: 'Products & Stock', icon: <InboxOutlined /> },
    { key: 'ledger', label: 'Stock Ledger', icon: <BookOutlined /> },
    { key: 'transfers', label: 'Stock Transfers', icon: <SwapOutlined /> },
    { key: 'opname', label: 'Stock Opname', icon: <FormOutlined /> },
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
          <span>Warehouse & Logistics Hub</span>
        </div>

        <Title level={2} className="page-title" style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>
          Inventory Management
        </Title>
        <Text className="page-subtitle" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Track real-time stock balances, product catalog, warehouse transfers, and stock opname adjustments.
        </Text>
      </div>

      {/* Main Glass Card */}
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
          {tabItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 20px',
                  borderRadius: 9999,
                  border: 'none',
                  background: isActive ? '#18181B' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 4px 12px rgba(24, 24, 27, 0.25)' : 'none',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'products' && <ProductManagement />}
        {activeTab === 'ledger' && <StockLedgerPage />}
        {activeTab === 'transfers' && <StockTransferPage />}
        {activeTab === 'opname' && <StockOpnamePage />}
      </Card>
    </div>
  );
};

export default InventoryPage;
