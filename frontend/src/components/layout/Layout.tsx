import React, { useState, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Dropdown, Badge, Tooltip, Popover, Button } from 'antd';
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
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { api } from '../../lib/api';
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

/* 7 Kelompok Utama Navigasi Mini ERP Retail System (Streamlined & Efficient) */
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
          { key: '/sales', label: 'Daftar Transaksi' },
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
          { key: '/inventory/stock', label: 'Persediaan & Mutasi' },
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
          { key: '/purchase/suppliers', label: 'Daftar Supplier' },
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
        key: '/admin',
        label: 'Pengaturan Toko',
        icon: <Settings size={17} />,
        subItems: [
          { key: '/admin/store', label: 'Profil Toko & Cabang' },
          { key: '/admin/users', label: 'User & Hak Akses' },
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
  const [openGroupKeys, setOpenGroupKeys] = useState<Record<string, boolean>>({
    '/pos': true,
    '/inventory': true,
    '/inventory/stock': true,
    '/purchase': true,
    '/finance': true,
  });

  const { user, clearAuth } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();

  const handleLogout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch (_) {}
    clearAuth();
    navigate('/login');
  }, [clearAuth, navigate]);

  const toggleGroup = (key: string) => {
    setOpenGroupKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Activity Center Notification Popover Content
  const notificationContent = (
    <div style={{ width: 310, padding: '4px 0' }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 8, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Pusat Notifikasi Aktivitas</span>
        <span style={{ fontSize: 11, background: '#FEF2F2', color: '#DC2626', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>5 Perlu Aksi</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#991B1B' }}>🔴 4 Produk Habis Total</span>
          </div>
          <Button size="small" type="primary" danger style={{ borderRadius: 6, fontSize: 11, height: 24 }} onClick={() => navigate('/purchase')}>
            + Restock
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: '#FEF3C7', border: '1px solid #FCD34D' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>🟡 8 Produk Di Bawah Min.</span>
          </div>
          <Button size="small" style={{ borderRadius: 6, fontSize: 11, height: 24 }} onClick={() => navigate('/inventory')}>
            Periksa
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: '#FEF3C7', border: '1px solid #FCD34D' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#92400E' }}>🟡 2 PO Menunggu Approval</span>
          </div>
          <Button size="small" style={{ borderRadius: 6, fontSize: 11, height: 24 }} onClick={() => navigate('/approvals')}>
            Review
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #93C5FD' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1E40AF' }}>🔵 3 Invoice Belum Lunas</span>
          </div>
          <Button size="small" style={{ borderRadius: 6, fontSize: 11, height: 24 }} onClick={() => navigate('/invoicing')}>
            Tagihan
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 8, background: '#ECFDF5', border: '1px solid #6EE7B7' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#065F46' }}>🟢 Stock Opname Selesai</span>
          </div>
          <Button size="small" style={{ borderRadius: 6, fontSize: 11, height: 24 }} onClick={() => navigate('/inventory/opname')}>
            Lihat
          </Button>
        </div>
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
      onClick: handleLogout,
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
        {/* Top Special Action CTA: BUKA POS KASIR */}
        {isExpanded ? (
          <button
            className={styles.posCtaBtn}
            onClick={() => navigate('/pos/shift')}
          >
            <ShoppingCart size={18} />
            <span>BUKA POS KASIR</span>
          </button>
        ) : (
          <Tooltip title="Buka POS Kasir" placement="right">
            <button
              className={`${styles.posCtaBtn} ${styles.posCtaBtnCollapsed}`}
              onClick={() => navigate('/pos/shift')}
            >
              <ShoppingCart size={20} />
            </button>
          </Tooltip>
        )}

        {/* Sidebar Island 2: Main Navigation Rail (7 Groups) */}
        <div
          className={`${styles.islandBase} ${
            isExpanded ? styles.islandBaseExpanded : styles.islandBaseCollapsed
          } ${styles.islandNav}`}
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
          } ${styles.islandFooter}`}
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
          {/* Header Left: Brand Logo + Branch Selector Chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={`${styles.topIslandBase} ${styles.islandBrand}`} onClick={() => navigate('/')}>
              <div className={styles.brandLogoMark}>K</div>
              <span className={styles.brandTitle}>KIRO POS</span>
            </div>

            <Dropdown
              menu={{
                items: [
                  { key: 'b1', label: '🏢 Cabang Utama (Surabaya)' },
                  { key: 'b2', label: '🏬 Cabang Malang (Toko 2)' },
                  { key: 'b3', label: '🏭 Gudang Pusat Sidoarjo' },
                ],
              }}
              trigger={['click']}
            >
              <div className={`${styles.topIslandBase} ${styles.branchChip}`}>
                <Building2 size={15} style={{ color: '#F05328' }} />
                <span>Cabang Utama (Surabaya)</span>
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
                  <Badge count={5} size="small" offset={[2, -2]}>
                    <Bell size={16} style={{ color: 'var(--text-secondary)' }} />
                  </Badge>
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
