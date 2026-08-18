import React, { useState, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Badge, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  LayoutDashboard, ShoppingCart, Package, Truck, BarChart2,
  Users, Shield, DollarSign, Archive,
  ChevronsLeft, ChevronsRight, Bell, Sun, Moon, LogOut,
  User, ChevronRight, Layers, BookOpen,
  MoreHorizontal,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { api } from '../../lib/api';
import { CommandPalette } from './CommandPalette';
import styles from './Layout.module.css';

/* ── Navigation config ──────────────────────────────────────────────── */
interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  children?: { key: string; label: string }[];
  section?: string;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Workspace',
    items: [
      { key: '/',              icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
      { key: '/pos',           icon: <ShoppingCart     size={16} />, label: 'Point of Sale' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { key: '/inventory',     icon: <Package size={16} />, label: 'Inventory' },
      { key: '/purchase',      icon: <Truck size={16} />,   label: 'Procurement' },
      { key: '/sales',         icon: <Archive size={16} />, label: 'Sales Orders' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { key: '/invoicing',     icon: <DollarSign size={16} />, label: 'Invoicing & Billing' },
      { key: '/finance',       icon: <DollarSign size={16} />, label: 'Finance & Accounting' },
      { key: '/reporting',     icon: <BarChart2   size={16} />, label: 'Reporting' },
      { key: '/approvals',     icon: <Shield      size={16} />, label: 'Approvals' },
      { key: '/audit',         icon: <BookOpen    size={16} />, label: 'Audit Trail' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { key: '/master-data',   icon: <Layers size={16} />,  label: 'Master Data' },
      {
        key: 'admin-group',
        icon: <Users size={16} />,
        label: 'Admin',
        children: [
          { key: '/admin/users', label: 'User Management' },
          { key: '/admin/roles', label: 'Role Management' },
        ],
      },
    ],
  },
];

/* Helper — get a flat label for the current path */
function getBreadcrumb(pathname: string): { parent: string; current: string } {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.children) {
        const child = item.children.find(c => c.key === pathname);
        if (child) return { parent: item.label, current: child.label };
      } else if (item.key === pathname) {
        return { parent: group.label, current: item.label };
      }
    }
  }
  return { parent: '', current: 'Page' };
}

/* ── NavItem component ──────────────────────────────────────────────── */
interface NavItemProps {
  item: NavItem;
  collapsed: boolean;
  activePath: string;
  onNavigate: (key: string) => void;
}

const NavItemRow: React.FC<NavItemProps> = ({ item, collapsed, activePath, onNavigate }) => {
  const [open, setOpen] = useState(() => {
    if (!item.children) return false;
    return item.children.some(c => c.key === activePath);
  });

  const isActive = item.children
    ? item.children.some(c => c.key === activePath)
    : item.key === activePath;

  const handleClick = () => {
    if (item.children) { setOpen(o => !o); }
    else { onNavigate(item.key); }
  };

  const baseStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: collapsed ? '0 0' : '0 10px',
    height: 38,
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 120ms ease',
    fontSize: 13,
    fontWeight: 500,
    color: isActive ? (item.children ? 'var(--brand-500)' : 'var(--brand-600)') : 'var(--text-secondary)',
    background: isActive && !item.children ? 'var(--brand-50)' : 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    justifyContent: collapsed ? 'center' : 'flex-start',
    userSelect: 'none',
    position: 'relative',
  };

  const iconStyle: React.CSSProperties = {
    flexShrink: 0,
    color: isActive ? 'var(--brand-500)' : 'var(--text-tertiary)',
    transition: 'color 120ms ease',
  };

  const content = (
    <button
      style={baseStyle}
      onClick={handleClick}
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--glass-bg-hover)';
        (e.currentTarget as HTMLElement).style.color = isActive ? '' : 'var(--text-primary)';
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = isActive ? '' : 'var(--text-secondary)';
      }}
    >
      <span style={iconStyle}>{item.icon}</span>
      {!collapsed && (
        <>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.label}
          </span>
          {item.children && (
            <ChevronRight
              size={12}
              style={{
                flexShrink: 0,
                color: 'var(--text-tertiary)',
                transition: 'transform 200ms ease',
                transform: open ? 'rotate(90deg)' : 'none',
              }}
            />
          )}
        </>
      )}
    </button>
  );

  return (
    <div>
      {collapsed && item.icon ? (
        <Tooltip title={item.label} placement="right">
          {content}
        </Tooltip>
      ) : content}

      {/* Children */}
      {!collapsed && item.children && open && (
        <div style={{ paddingLeft: 28, marginTop: 2 }}>
          {item.children.map(child => {
            const childActive = child.key === activePath;
            return (
              <button
                key={child.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  height: 34,
                  padding: '0 10px 0 8px',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: childActive ? 600 : 400,
                  color: childActive ? 'var(--brand-600)' : 'var(--text-secondary)',
                  background: childActive ? 'var(--brand-50)' : 'transparent',
                  transition: 'all 120ms ease',
                  textAlign: 'left',
                  position: 'relative',
                  userSelect: 'none',
                }}
                onClick={() => onNavigate(child.key)}
                onMouseEnter={e => {
                  if (!childActive) {
                    (e.currentTarget as HTMLElement).style.background = 'var(--glass-bg-hover)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!childActive) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {/* Active indicator dot */}
                <span style={{
                  width: 5, height: 5,
                  borderRadius: '50%',
                  background: childActive ? 'var(--brand-500)' : 'var(--glass-border)',
                  flexShrink: 0,
                  transition: 'background 120ms ease',
                }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {child.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Main Layout ────────────────────────────────────────────────────── */
export const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { user, clearAuth } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();

  const handleLogout = useCallback(async () => {
    try { await api.post('/api/v1/auth/logout'); } catch (_) {}
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  const handleNavigate = useCallback((key: string) => {
    navigate(key);
  }, [navigate]);

  const breadcrumb = getBreadcrumb(location.pathname);

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile-header',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
            {user?.name || 'User'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {user?.role || 'Staff'}
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      icon: <User size={14} />,
      label: 'Profile',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogOut size={14} />,
      label: 'Sign out',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <div className={styles.root}>

      {/* ── Glass Sidebar ───────────────────────────────────────── */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : styles.sidebarExpanded}`}>

        {/* Logo */}
        <div
          className={`${styles.sidebarLogo} ${collapsed ? styles.sidebarLogoCollapsed : ''}`}
          onClick={() => navigate('/')}
          role="button"
          tabIndex={0}
        >
          <div className={styles.logoMark}>K</div>
          {!collapsed && (
            <div className={styles.logoTextBlock}>
              <div className={styles.logoName}>Kiro ERP</div>
              <div className={styles.logoSub}>Enterprise</div>
            </div>
          )}
        </div>

        {/* Nav Groups */}
        <div className={styles.navScroll}>
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {/* Section label — hidden when collapsed */}
              {!collapsed && (
                <div className={styles.navSection}>
                  <div className={styles.navSectionLabel}>{group.label}</div>
                </div>
              )}
              {collapsed && <div style={{ height: 12 }} />}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map(item => (
                  <NavItemRow
                    key={item.key}
                    item={item}
                    collapsed={collapsed}
                    activePath={location.pathname}
                    onNavigate={handleNavigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* User Section */}
        <div className={styles.userSection}>
          <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="topLeft">
            <button className={`${styles.userBtn} ${collapsed ? styles.userBtnCollapsed : ''}`}>
              <div className={styles.userAvatar}>
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              {!collapsed && (
                <div className={styles.userInfo}>
                  <div className={styles.userName}>{user?.name || 'User'}</div>
                  <div className={styles.userRole}>{user?.role || 'Staff'}</div>
                </div>
              )}
              {!collapsed && <MoreHorizontal size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />}
            </button>
          </Dropdown>

          {/* Collapse toggle */}
          <button
            className={styles.collapseBtn}
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronsRight size={15} />
              : <ChevronsLeft size={15} />
            }
          </button>
        </div>
      </aside>

      {/* ── Main Area ───────────────────────────────────────────── */}
      <div className={`${styles.main} ${collapsed ? styles.mainCollapsed : styles.mainExpanded}`}>

        {/* Glass Navbar */}
        <header className={styles.navbar}>
          {/* Breadcrumb */}
          <nav className={styles.navbarBreadcrumb}>
            {breadcrumb.parent && (
              <>
                <span className={styles.navbarBreadcrumbText}>{breadcrumb.parent}</span>
                <ChevronRight size={12} style={{ color: 'var(--text-tertiary)' }} />
              </>
            )}
            <span className={styles.navbarBreadcrumbCurrent}>{breadcrumb.current}</span>
          </nav>

          {/* Actions */}
          <div className={styles.navbarActions}>
            {/* Theme toggle */}
            <Tooltip title={isDarkMode ? 'Light mode' : 'Dark mode'}>
              <button
                className={styles.navbarIconBtn}
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </Tooltip>

            {/* Notifications */}
            <Tooltip title="Notifications">
              <button className={styles.navbarIconBtn} aria-label="Notifications">
                <Badge
                  count={3}
                  size="small"
                  style={{ fontSize: 9, minWidth: 14, height: 14, lineHeight: '14px', padding: '0 3px' }}
                >
                  <Bell size={15} />
                </Badge>
              </button>
            </Tooltip>

            <div className={styles.navbarDivider} />

            {/* User avatar */}
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
              <button
                className={styles.navbarIconBtn}
                style={{ width: 'auto', padding: '0 4px', gap: 8, borderRadius: 20 }}
                aria-label="User menu"
              >
                <div style={{
                  width: 28, height: 28,
                  borderRadius: '50%',
                  background: 'var(--brand-gradient)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#fff',
                  boxShadow: '0 2px 6px var(--brand-glow)',
                }}>
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span style={{
                  fontSize: 12.5, fontWeight: 500,
                  color: 'var(--text-primary)',
                  maxWidth: 90,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user?.name || 'User'}
                </span>
                <ChevronRight size={11} style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </Dropdown>
          </div>
        </header>

        {/* Page Content — solid workspace */}
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>

      <CommandPalette />
    </div>
  );
};
