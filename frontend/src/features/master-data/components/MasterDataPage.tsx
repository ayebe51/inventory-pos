import React, { useState } from 'react';
import { Typography, Card } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  ShopOutlined, UserOutlined, AppstoreOutlined, HomeOutlined,
  InboxOutlined, SafetyCertificateOutlined, BookOutlined
} from '@ant-design/icons';
import { api } from '../../../lib/api';
import { CustomersTab } from './tabs/CustomersTab';
import { SuppliersTab } from './tabs/SuppliersTab';
import { WarehousesTab } from './tabs/WarehousesTab';
import { CategoriesTab } from './tabs/CategoriesTab';
import { UomsTab } from './tabs/UomsTab';
import { CoaTab } from './tabs/CoaTab';

const { Title, Text } = Typography;

export const MasterDataPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('customers');

  const { data: custData } = useQuery({ queryKey: ['customers'], queryFn: () => api.get('/api/v1/master-data/customers').then(r => r.data) });
  const { data: suppData } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/api/v1/master-data/suppliers').then(r => r.data) });
  const { data: whData } = useQuery({ queryKey: ['warehouses'], queryFn: () => api.get('/api/v1/warehouses').then(r => r.data) });
  const { data: catData } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/api/v1/master-data/categories').then(r => r.data) });
  const { data: uomData } = useQuery({ queryKey: ['uoms'], queryFn: () => api.get('/api/v1/master-data/uoms').then(r => r.data) });
  const { data: coaData } = useQuery({ queryKey: ['coa-accounts'], queryFn: () => api.get('/api/v1/master-data/coa').then(r => r.data) });

  const custCount = (custData?.data || (Array.isArray(custData) ? custData : [])).length;
  const suppCount = (suppData?.data || (Array.isArray(suppData) ? suppData : [])).length;
  const whCount = (whData?.data || (Array.isArray(whData) ? whData : [])).length;
  const catCount = (catData?.data || (Array.isArray(catData) ? catData : [])).length;
  const uomCount = (uomData?.data || (Array.isArray(uomData) ? uomData : [])).length;
  const coaCount = (coaData?.data || (Array.isArray(coaData) ? coaData : [])).length;

  const tabItems = [
    { key: 'customers', label: 'Customers', icon: <UserOutlined />, count: custCount },
    { key: 'suppliers', label: 'Suppliers', icon: <ShopOutlined />, count: suppCount },
    { key: 'warehouses', label: 'Warehouses', icon: <HomeOutlined />, count: whCount },
    { key: 'categories', label: 'Categories', icon: <AppstoreOutlined />, count: catCount },
    { key: 'uoms', label: 'Units (UOM)', icon: <InboxOutlined />, count: uomCount },
    { key: 'coa', label: 'Chart of Accounts', icon: <BookOutlined />, count: coaCount },
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
          <span>Core Infrastructure Registry</span>
        </div>

        <Title level={2} className="page-title" style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>
          Master Data Directory
        </Title>
        <Text className="page-subtitle" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Manage global entities, business partners, product taxonomy, units of measure, and warehouse infrastructure.
        </Text>
      </div>

      {/* Main Card with AntD v6 styles */}
      <Card
        styles={{ body: { padding: 24 } }}
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
                aria-label={`Buka tab ${item.label}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: isActive ? 'var(--solid-bg)' : 'transparent',
                  color: isActive ? 'var(--brand-600)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background: isActive ? 'var(--brand-50)' : 'rgba(0,0,0,0.05)',
                  color: isActive ? 'var(--brand-600)' : 'var(--text-tertiary)'
                }}>
                  {item.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'customers' && <CustomersTab />}
        {activeTab === 'suppliers' && <SuppliersTab />}
        {activeTab === 'warehouses' && <WarehousesTab />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'uoms' && <UomsTab />}
        {activeTab === 'coa' && <CoaTab />}
      </Card>
    </div>
  );
};

export default MasterDataPage;
