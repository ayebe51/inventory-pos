import React, { useState, useEffect } from 'react';
import { Modal, Input, List } from 'antd';
import { SearchOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../store/themeStore';
import {
  LayoutDashboard, ShoppingCart, Package, Truck, BarChart2,
  Users, Shield, DollarSign, Archive, Layers, BookOpen
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  path: string;
}

const COMMAND_DATA: CommandItem[] = [
  { id: '1', title: 'Dashboard', subtitle: 'Executive Overview', icon: <LayoutDashboard size={16} />, path: '/' },
  { id: '2', title: 'Point of Sale', subtitle: 'Open Cashier / POS', icon: <ShoppingCart size={16} />, path: '/pos' },
  { id: '3', title: 'Products & Stock', subtitle: 'Manage Inventory', icon: <Package size={16} />, path: '/inventory' },
  { id: '4', title: 'Stock Transfer', subtitle: 'Move goods between branches', icon: <Package size={16} />, path: '/inventory/transfers' },
  { id: '5', title: 'Purchase Orders', subtitle: 'Procurement', icon: <Truck size={16} />, path: '/purchase' },
  { id: '6', title: 'Sales Orders', subtitle: 'Manage B2B Sales', icon: <Archive size={16} />, path: '/sales' },
  { id: '7', title: 'Invoicing', subtitle: 'AR/AP and Bills', icon: <DollarSign size={16} />, path: '/invoicing' },
  { id: '8', title: 'Journal Entries', subtitle: 'Finance & Accounting', icon: <DollarSign size={16} />, path: '/finance' },
  { id: '9', title: 'Reporting', subtitle: 'Financial & Operational Reports', icon: <BarChart2 size={16} />, path: '/reporting' },
  { id: '10', title: 'Master Data', subtitle: 'System Configuration', icon: <Layers size={16} />, path: '/master-data' },
  { id: '11', title: 'User Management', subtitle: 'Admin controls', icon: <Users size={16} />, path: '/admin/users' },
  { id: '12', title: 'Approvals', subtitle: 'Pending document approvals', icon: <Shield size={16} />, path: '/approvals' },
  { id: '13', title: 'Audit Trail', subtitle: 'System activity logs', icon: <BookOpen size={16} />, path: '/audit' },
];

export const CommandPalette: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { isDarkMode } = useThemeStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setVisible((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [visible]);

  const filteredData = COMMAND_DATA.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const handleNavigate = (path: string) => {
    navigate(path);
    setVisible(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredData.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredData.length) % filteredData.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredData[selectedIndex]) {
        handleNavigate(filteredData[selectedIndex].path);
      }
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={() => setVisible(false)}
      footer={null}
      closable={false}
      width={600}
      bodyStyle={{ padding: 0 }}
      maskStyle={{
        backdropFilter: 'blur(8px)',
        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.4)',
      }}
      style={{
        top: '15vh',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2), 0 0 0 1px var(--glass-border-strong)',
      }}
    >
      <div style={{ background: isDarkMode ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(24px)' }}>
        <Input
          autoFocus
          placeholder="What do you need to do? (e.g., 'invoice')"
          prefix={<SearchOutlined style={{ fontSize: 20, color: 'var(--text-tertiary)', marginRight: 8 }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onKeyDown}
          bordered={false}
          style={{
            fontSize: 20,
            padding: '24px',
            borderBottom: '1px solid var(--glass-border)',
            boxShadow: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
          }}
        />
        
        <List
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: 12,
          }}
          dataSource={filteredData}
          renderItem={(item, index) => {
            const isActive = index === selectedIndex;
            return (
              <List.Item
                onClick={() => handleNavigate(item.path)}
                onMouseEnter={() => setSelectedIndex(index)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: 'none',
                  borderRadius: 12,
                  background: isActive ? 'var(--brand-50)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'background 0.2s ease',
                  marginBottom: 4,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 16 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? 'var(--brand-500)' : 'var(--glass-bg)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    boxShadow: isActive ? '0 4px 12px var(--brand-glow)' : 'none',
                    transition: 'all 0.2s ease',
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: isActive ? 'var(--brand-700)' : 'var(--text-primary)' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 12, color: isActive ? 'var(--brand-600)' : 'var(--text-secondary)', marginTop: 2 }}>
                      {item.subtitle}
                    </div>
                  </div>
                </div>
                {isActive && (
                  <ArrowRightOutlined style={{ color: 'var(--brand-500)', fontSize: 16 }} />
                )}
              </List.Item>
            );
          }}
        />
      </div>
    </Modal>
  );
};
