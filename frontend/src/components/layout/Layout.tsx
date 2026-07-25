import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Button,
  Space,
  Typography,
  Badge,
  Tooltip,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  FileTextOutlined,
  BarChartOutlined,
  SettingOutlined,
  ShoppingOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  DollarOutlined,
  ContainerOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const navItems: MenuProps['items'] = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: '/pos',
    icon: <ShoppingCartOutlined />,
    label: 'Point of Sale',
  },
  {
    key: 'inventory-group',
    icon: <InboxOutlined />,
    label: 'Inventory',
    children: [
      { key: '/inventory', label: 'Products & Stock' },
      { key: '/inventory/transfers', label: 'Stock Transfer' },
      { key: '/inventory/opname', label: 'Stock Opname' },
    ],
  },
  {
    key: 'purchase-group',
    icon: <ShoppingOutlined />,
    label: 'Purchasing',
    children: [
      { key: '/purchase', label: 'Purchase Orders' },
      { key: '/purchase/receipts', label: 'Goods Receipt' },
    ],
  },
  {
    key: 'sales-group',
    icon: <ContainerOutlined />,
    label: 'Sales',
    children: [
      { key: '/sales', label: 'Sales Orders' },
      { key: '/sales/returns', label: 'Sales Returns' },
    ],
  },
  {
    key: 'finance-group',
    icon: <DollarOutlined />,
    label: 'Finance',
    children: [
      { key: '/finance', label: 'Journal Entries' },
      { key: '/invoicing', label: 'Invoicing (AR/AP)' },
      { key: '/payment', label: 'Payments' },
      { key: '/bank-reconciliation', label: 'Bank Reconciliation' },
    ],
  },
  {
    key: '/reporting',
    icon: <BarChartOutlined />,
    label: 'Reporting',
  },
  {
    key: '/approvals',
    icon: <SafetyCertificateOutlined />,
    label: 'Approvals',
  },
  {
    key: '/audit',
    icon: <AuditOutlined />,
    label: 'Audit Trail',
  },
  {
    key: '/master-data',
    icon: <SettingOutlined />,
    label: 'Master Data',
  },
];

export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Profile',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      danger: true,
      onClick: handleLogout,
    },
  ];

  // Determine which menu key is active
  const selectedKey = location.pathname;
  const openKeys = navItems
    .filter((item: any) => item?.children?.some((c: any) => c.key === selectedKey))
    .map((item: any) => item?.key as string);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={240}
        style={{
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          borderRight: '1px solid #2D2D3F',
        }}
      >
        {/* Logo */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: collapsed ? '0 20px' : '0 24px',
          borderBottom: '1px solid #2D2D3F',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
          onClick={() => navigate('/')}
        >
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)',
            fontWeight: 700,
            color: '#fff',
            fontSize: 14,
          }}>K</div>
          {!collapsed && (
            <div style={{ marginLeft: 12 }}>
              <div style={{ color: '#E2E8F0', fontWeight: 700, fontSize: 14, fontFamily: 'Space Grotesk' }}>Kiro ERP</div>
              <div style={{ color: '#64748B', fontSize: 10, letterSpacing: '0.1em' }}>ENTERPRISE</div>
            </div>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={navItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, paddingTop: 8 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'margin-left 0.2s' }}>
        <Header style={{
          position: 'sticky',
          top: 0,
          zIndex: 99,
          background: '#12121A',
          borderBottom: '1px solid #2D2D3F',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 16,
          height: 64,
        }}>
          <Tooltip title="Notifications">
            <Badge count={3} size="small">
              <Button type="text" icon={<BellOutlined />} style={{ color: '#94A3B8' }} />
            </Badge>
          </Tooltip>

          <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                size={32}
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}
              >
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </Avatar>
              {!collapsed && (
                <div>
                  <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 500, display: 'block' }}>
                    {user?.name || 'User'}
                  </Text>
                  <Text style={{ color: '#8B5CF6', fontSize: 11 }}>
                    {user?.role || 'Staff'}
                  </Text>
                </div>
              )}
            </Space>
          </Dropdown>
        </Header>

        <Content style={{ background: '#0F0F13', minHeight: 'calc(100vh - 64px)', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
