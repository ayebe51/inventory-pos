import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Tooltip, Popover } from 'antd';
import type { MenuProps } from 'antd';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  BarChart2,
  DollarSign,
  Sun,
  Moon,
  LogOut,
  Search,
  Bell,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  User,
  ChevronsRight,
  ChevronsLeft,
  Building2,
  Settings,
  Layers,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useLogout } from '../../features/auth/hooks/useAuth';
import { CommandPalette } from './CommandPalette';
import styles from './Layout.module.css';

interface NavGroup {
  groupName: string;
  items: {
    key: string;
    label: string;
    icon: React.ReactNode;
    subItems?: { key: string; label: string }[];
  }[];
}

/* Kelompok Utama Navigasi Mini ERP Retail System (Streamlined & Efficient) */
const MINI_ERP_NAV_GROUPS: NavGroup[] = [
  {
    groupName: 'DASHBOARD',
    items: [
      { key: '/', label: 'Overview Operasional', icon: <LayoutDashboard size={17} /> },
    ],
  },
  {
    groupName: 'POS & PENJUALAN',
    items: [
      {
        key: '/pos',
        label: 'POS Kasir & Sales',
        icon: <ShoppingCart size={17} />,
        subItems: [
          { key: '/pos', label: 'Kasir Checkout' },
          { key: '/sales', label: 'Sales Orders (B2B)' },
          { key: '/sales/returns', label: 'Retur Penjualan' },
          { key: '/pos/shift', label: 'Shift Kasir & Laci' },
        ],
      },
    ],
  },
  {
    groupName: 'INVENTORI & STOK',
    items: [
      {
        key: '/inventory',
        label: 'Produk & Stok',
        icon: <Package size={17} />,
        subItems: [
          { key: '/inventory', label: 'Master Produk & Katalog' },
          { key: '/inventory/opname', label: 'Stock Opname' },
          { key: '/inventory/transfers', label: 'Transfer Gudang' },
        ],
      },
    ],
  },
  {
    groupName: 'PENGADAAN',
    items: [
      {
        key: '/purchase',
        label: 'Procurement (PO)',
        icon: <Truck size={17} />,
        subItems: [
          { key: '/purchase', label: 'Purchase Order (PO)' },
          { key: '/purchase/requests', label: 'Purchase Request' },
        ],
      },
    ],
  },
  {
    groupName: 'FINANCE & AKUNTANSI',
    items: [
      {
        key: '/finance',
        label: 'Finance Hub',
        icon: <DollarSign size={17} />,
        subItems: [
          { key: '/finance', label: 'Kas & Rekening Bank' },
          { key: '/invoicing', label: 'Hutang & Piutang (AP/AR)' },
          { key: '/finance/payments', label: 'Pembayaran (AR/AP)' },
          { key: '/finance/reconciliation', label: 'Jurnal & Rekonsiliasi' },
        ],
      },
    ],
  },
  {
    groupName: 'LAPORAN & ANALITIK',
    items: [
      {
        key: '/reporting',
        label: 'Executive Reports',
        icon: <BarChart2 size={17} />,
      },
    ],
  },
  {
    groupName: 'PENGATURAN',
    items: [
      {
        key: '/master-data',
        label: 'Data Master',
        icon: <Layers size={17} />,
      },
      {
        key: '/admin',
        label: 'Pengaturan Toko',
        icon: <Settings size={17} />,
        subItems: [
          { key: '/admin/store', label: 'Profil Toko & Cabang' },
          { key: '/admin/users', label: 'User & Hak Akses' },
          { key: '/admin/roles', label: 'Kelola Peran & Akses' },
          { key: '/audit', label: 'Audit Log' },
        ],
      },
    ],
  },
];

export const Layout: React.FC = () => {
  const location = useLocation();
const navigate = useNavigate();
const [isExpanded, setIsExpanded] = useState(true);

const { data: branchData } = useQuery({
  queryKey: ['branches'],
  queryFn: () => api.get('/api/v1/organization/branches').then((r) => r.data),
  staleTime: 5 * 60_000,
});
const branches: any[] = Array.isArray(branchData) ? branchData : (branchData?.data ?? []);
  const [openGroupKeys, setOpenGroupKeys] = useState<Record<string, boolean>>({
    '/pos': true,
    '/inventory': true,
    '/purchase': true,
    '/finance': true,
    '/admin': true,
  });

  const { user } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();

  const logout = useLogout();

  const toggleGroup = (key: string) => {
    setOpenGroupKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Activity Center Notification Popover Content — honest empty state until a
  // real notification source is wired (no fabricated counts/items)
  const notificationContent = (
    <div style={{ width: 310, padding: '12px 4px', textAlign: 'center' }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10, color: 'var(--text-primary)', textAlign: 'left' }}>
        Pusat Notifikasi Aktivitas
      </div>
      <div style={{ color: 'var(--text-tertiary)', fontSize: 12.5, padding: '18px 8px' }}>
        Belum ada notifikasi.
      </div>
    </div>
  );

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile-header',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
            {user?.name || 'System Administrator'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {user?.role || 'Owner'}
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      icon: <User size={14} />,
      label: 'Profil Pengguna',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogOut size={14} />,
      label: 'Keluar (Sign out)',
      danger: true,
          onClick: logout,
    },
  ];

  return (
    <div className={styles.root}>
      {/* ── Left Sidebar Rail: Mini ERP Collapsible / Expandable Islands ──── */}
      <aside
        className={`${styles.sidebarRail} ${
          isExpanded ? styles.sidebarRailExpanded : styles.sidebarRailCollapsed
        }`}
      >
        {/* Sidebar Island 1: KIRO POS Brand Island (Top Left) */}
        <div
          className={`${styles.islandBase} ${
            isExpanded ? styles.islandBaseExpanded : styles.islandBaseCollapsed
          } ${styles.sidebarIslandBrand} ${
            !isExpanded ? styles.sidebarIslandBrandCollapsed : ''
          }`}
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.brandLogoMark}>K</div>
          {isExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <span className={styles.brandTitle}>KIRO POS</span>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.04em' }}>ENTERPRISE SYSTEM</span>
            </div>
          )}
        </div>

        {/* Sidebar Island 2: Main Navigation Rail (7 Groups) - Directly below KIRO POS */}
        <div
          className={`${styles.islandBase} ${
            isExpanded ? styles.islandBaseExpanded : styles.islandBaseCollapsed
          } ${styles.islandNav} ${
            isExpanded ? styles.islandNavExpanded : styles.islandNavCollapsed
          }`}
        >
          {MINI_ERP_NAV_GROUPS.map((group) => (
            <div key={group.groupName} style={{ width: '100%' }}>
              {isExpanded && <div className={styles.navGroupHeader}>{group.groupName}</div>}
              {group.items.map((item) => {
                const isGroupActive =
                  item.key === '/'
                    ? location.pathname === '/'
                    : location.pathname.startsWith(item.key);
                const hasSub = item.subItems && item.subItems.length > 0;
                const isSubOpen = openGroupKeys[item.key] ?? false;

                if (!isExpanded) {
                  return (
                    <Tooltip
                      key={item.key}
                      title={item.label}
                      placement="right"
                      overlayInnerStyle={{ background: '#18181B', color: '#FFF', borderRadius: 8, fontWeight: 600, fontSize: 12 }}
                    >
                      <button
                        className={`${styles.navIconBtn} ${isGroupActive ? styles.navIconBtnActive : ''}`}
                        onClick={() => navigate(item.key)}
                      >
                        {item.icon}
                      </button>
                    </Tooltip>
                  );
                }

                return (
                  <div key={item.key} style={{ width: '100%', marginBottom: 2 }}>
                    <button
                      className={`${styles.navRowExpanded} ${
                        isGroupActive ? styles.navRowExpandedActive : ''
                      }`}
                      onClick={() => {
                        if (hasSub) {
                          toggleGroup(item.key);
                        } else {
                          navigate(item.key);
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {item.icon}
                        <span>{item.label}</span>
                      </div>
                      {hasSub && (
                        <ChevronRight
                          size={14}
                          style={{
                            transform: isSubOpen ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      )}
                    </button>

                    {hasSub && isSubOpen && (
                      <div className={styles.navSubList}>
                        {item.subItems?.map((sub) => {
                          const isSubActive = location.pathname === sub.key;
                          return (
                            <button
                              key={sub.key}
                              className={`${styles.navSubItem} ${
                                isSubActive ? styles.navSubItemActive : ''
                              }`}
                              onClick={() => navigate(sub.key)}
                            >
                              <span>•</span>
                              <span>{sub.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Island 3: Theme, Support & Collapse Controls */}
        <div
          className={`${styles.islandBase} ${
            isExpanded ? styles.islandBaseExpanded : styles.islandBaseCollapsed
          } ${styles.islandFooter} ${
            isExpanded ? styles.islandFooterExpanded : styles.islandFooterCollapsed
          }`}
        >
          {isExpanded ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
              <button
                className={styles.navRowExpanded}
                onClick={toggleTheme}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isDarkMode ? <Moon size={16} /> : <Sun size={16} />}
                  <span>{isDarkMode ? 'Mode Gelap' : 'Mode Terang'}</span>
                </div>
              </button>

              <button
                className={styles.expandToggleBtn}
                onClick={() => setIsExpanded(false)}
                title="Mengecilkan Sidebar"
              >
                <ChevronsLeft size={16} />
                <span>Kecilkan Sidebar</span>
              </button>
            </div>
          ) : (
            <>
              <Tooltip title="Mode Terang / Gelap" placement="right">
                <button className={styles.navIconBtn} onClick={toggleTheme}>
                  {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                </button>
              </Tooltip>

              <Tooltip title="Memperluas Sidebar" placement="right">
                <button className={styles.navIconBtn} onClick={() => setIsExpanded(true)}>
                  <ChevronsRight size={18} />
                </button>
              </Tooltip>
            </>
          )}
        </div>
      </aside>

      {/* ── Main Container Workspace ─────────────────────────────────────── */}
      <div
        className={`${styles.mainContainer} ${
          isExpanded ? styles.mainContainerExpanded : styles.mainContainerCollapsed
        }`}
      >
        {/* ── Top Header Bar (Clean Header - No Top Nav Switcher) ───────── */}
        <header className={styles.topHeaderBar}>
          {/* Header Left: Branch Selector Chip (real branches) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Dropdown
              menu={{
                items: (branches.length > 0
                  ? branches
                  : [{ id: 'none', name: 'Tidak ada cabang terdaftar' }]
                ).map((b: any) => ({ key: b.id, label: b.name })),
                selectable: true,
                defaultSelectedKeys: branches[0] ? [branches[0].id] : [],
              }}
              trigger={['click']}
            >
              <div className={`${styles.topIslandBase} ${styles.branchChip}`}>
                <Building2 size={15} style={{ color: '#F05328' }} />
                <span>{branches[0]?.name ?? 'Cabang'}</span>
                <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />
              </div>
            </Dropdown>
          </div>

          {/* Header Center / Right: Global Search & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Global Search Bar Shortcut */}
            <button
              className={styles.searchChipBtn}
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true });
                window.dispatchEvent(event);
              }}
            >
              <Search size={15} />
              <span>Cari produk, transaksi, supplier...</span>
              <span className={styles.searchKbd}>⌘ K</span>
            </button>

            {/* Controls: Notification Bell with Activity Center Popover */}
            <div className={`${styles.topIslandBase} ${styles.islandControls}`}>
              <Popover content={notificationContent} trigger="click" placement="bottomRight">
                <button className={styles.controlIconBtn}>
                  <Bell size={16} style={{ color: 'var(--text-secondary)' }} />
                </button>
              </Popover>

              <Tooltip title="Pencarian & Bantuan (Ctrl + K)">
                <button
                  className={styles.controlIconBtn}
                  onClick={() => {
                    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true });
                    window.dispatchEvent(event);
                  }}
                >
                  <HelpCircle size={16} />
                </button>
              </Tooltip>
            </div>

            {/* User Profile Chip */}
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
              <div className={`${styles.topIslandBase} ${styles.islandUser}`}>
                <div className={styles.userAvatarCircle}>
                  {user?.name?.[0]?.toUpperCase() || 'S'}
                </div>
                <div className={styles.userTextMeta}>
                  <span className={styles.userNameText}>{user?.name || 'System Administrator'}</span>
                  <span className={styles.userRoleText}>{user?.role || 'Owner'}</span>
                </div>
                <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', marginLeft: 2 }} />
              </div>
            </Dropdown>
          </div>
        </header>

        {/* ── Content View Workspace ────────────────────────────────────── */}
        <main className={styles.contentArea}>
          <Outlet />
        </main>
      </div>

      <CommandPalette />
    </div>
  );
};
