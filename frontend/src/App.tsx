import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Spin, ConfigProvider, theme, Empty } from 'antd';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';

// Lazy-load all pages for code-splitting
const LoginPage = lazy(() => import('./features/auth/components/LoginPage').then((m) => ({ default: m.LoginPage })));
const MFASetupPage = lazy(() => import('./features/auth/components/MFASetupPage').then((m) => ({ default: m.MFASetupPage })));
const MFAVerifyPage = lazy(() => import('./features/auth/components/MFAVerifyPage').then((m) => ({ default: m.MFAVerifyPage })));
const ProtectedRoute = lazy(() => import('./features/auth/components/ProtectedRoute').then((m) => ({ default: m.ProtectedRoute })));
const DashboardPage = lazy(() => import('./features/dashboard/components/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const POSPage = lazy(() => import('./features/pos/components/POSPage').then((m) => ({ default: m.POSPage })));
const ShiftPage = lazy(() => import('./features/pos/components/ShiftPage').then((m) => ({ default: m.ShiftPage })));
const SalesOrderPage = lazy(() => import('./features/pos/components/SalesOrderPage').then((m) => ({ default: m.SalesOrderPage })));
const SalesReturnPage = lazy(() => import('./features/pos/components/SalesReturnPage').then((m) => ({ default: m.SalesReturnPage })));
const InventoryPage = lazy(() => import('./features/inventory/components/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const StockLedgerPage = lazy(() => import('./features/inventory/components/StockLedgerPage').then((m) => ({ default: m.StockLedgerPage })));
const StockTransferPage = lazy(() => import('./features/inventory/components/StockTransferPage').then((m) => ({ default: m.StockTransferPage })));
const StockOpnamePage = lazy(() => import('./features/inventory/components/StockOpnamePage').then((m) => ({ default: m.StockOpnamePage })));
const FinancePage = lazy(() => import('./features/finance/components/FinancePage').then((m) => ({ default: m.FinancePage })));
const PaymentPage = lazy(() => import('./features/finance/components/PaymentPage').then((m) => ({ default: m.PaymentPage })));
const FiscalPeriodPage = lazy(() => import('./features/finance/components/FiscalPeriodPage').then((m) => ({ default: m.FiscalPeriodPage })));
const BankReconciliationPage = lazy(() => import('./features/finance/components/BankReconciliationPage').then((m) => ({ default: m.BankReconciliationPage })));
const FixedAssetPage = lazy(() => import('./features/finance/components/FixedAssetPage'));
const PurchasePage = lazy(() => import('./features/purchase/components/PurchasePage').then((m) => ({ default: m.PurchasePage })));
const PurchaseRequestPage = lazy(() => import('./features/purchase/components/PurchaseRequestPage').then((m) => ({ default: m.PurchaseRequestPage })));
const ReportingPage = lazy(() => import('./features/reporting/components/ReportingPage').then((m) => ({ default: m.ReportingPage })));
const MasterDataPage = lazy(() => import('./features/master-data/components/MasterDataPage').then((m) => ({ default: m.MasterDataPage })));
const InvoicingPage = lazy(() => import('./features/invoicing/components/InvoicingPage').then((m) => ({ default: m.InvoicingPage })));
const ApprovalPage = lazy(() => import('./features/approvals/components/ApprovalPage').then((m) => ({ default: m.ApprovalPage })));
const AuditTrailPage = lazy(() => import('./features/approvals/components/AuditTrailPage').then((m) => ({ default: m.AuditTrailPage })));
const UserManagementPage = lazy(() => import('./features/admin/components/UserManagementPage').then((m) => ({ default: m.UserManagementPage })));
const RoleManagementPage = lazy(() => import('./features/admin/components/RoleManagementPage').then((m) => ({ default: m.RoleManagementPage })));
const PageLoader = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: 'var(--bg-app)',
    flexDirection: 'column', gap: 12,
  }}>
    <div style={{
      width: 36, height: 36,
      borderRadius: 10,
      background: 'var(--brand-gradient)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, fontWeight: 800, color: '#fff',
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>K</div>
    <Spin size="large" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  const { isDarkMode } = useThemeStore();
  const { isAuthenticated, clearAuth } = useAuthStore();

  useEffect(() => {
    // Apply immediately and on change
    const attr = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', attr);
    document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  // GAP-06: Idle session detection (30 minutes)
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (isAuthenticated) {
          clearAuth();
          // The AuthGuard will automatically redirect to /login when isAuthenticated becomes false
        }
      }, 30 * 60 * 1000); // 30 minutes
    };

    if (isAuthenticated) {
      resetTimer();
      const events = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
      events.forEach((event) => window.addEventListener(event, resetTimer));

      return () => {
        clearTimeout(timeoutId);
        events.forEach((event) => window.removeEventListener(event, resetTimer));
      };
    }
  }, [isAuthenticated, clearAuth]);

  const buildTheme = (dark: boolean) => ({
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 13,
      borderRadius: 10,
      borderRadiusLG: 14,
      borderRadiusSM: 8,
      wireframe: false,
      motion: true,
      fontWeightStrong: 600,
      controlHeight: 38,
      controlHeightLG: 44,
      controlHeightSM: 30,
      lineWidth: 1,
      // Brand (Vibrant Coral Finexy Style)
      colorPrimary: dark ? '#FF6B4A' : '#F05328',
      colorInfo:    dark ? '#FF6B4A' : '#F05328',
      colorSuccess: dark ? '#10B981' : '#059669',
      colorWarning: dark ? '#F59E0B' : '#D97706',
      colorError:   dark ? '#EF4444' : '#DC2626',
      // Backgrounds
      colorBgBase:      dark ? '#0D1117' : '#F4F7FB',
      colorBgContainer: dark ? '#161B22' : '#FFFFFF',
      colorBgLayout:    dark ? '#0D1117' : '#F4F7FB',
      colorBgElevated:  dark ? '#1C2333' : '#FFFFFF',
      colorBgSpotlight: dark ? '#141921' : '#F9FAFB',
      // Borders
      colorBorder:          dark ? '#2D3748' : '#E5E9F0',
      colorBorderSecondary: dark ? '#1C2333' : '#F1F4F9',
      // Text
      colorText:          dark ? 'rgba(255,255,255,0.92)' : '#0F1629',
      colorTextSecondary: dark ? 'rgba(255,255,255,0.58)' : '#4B5675',
      colorTextTertiary:  dark ? 'rgba(255,255,255,0.36)' : '#8796AC',
      colorTextDisabled:  dark ? 'rgba(255,255,255,0.20)' : '#BAC2CF',
      colorTextHeading:   dark ? 'rgba(255,255,255,0.92)' : '#0F1629',
      colorTextLabel:     dark ? 'rgba(255,255,255,0.58)' : '#4B5675',
      colorLink:          dark ? '#FF8566' : '#F05328',
    },
    components: {
      Layout: {
        siderBg: 'transparent',
        headerBg: 'transparent',
        triggerBg: 'transparent',
        footerBg: 'transparent',
        bodyBg: 'transparent',
      },
      Menu: {
        itemBg: 'transparent',
        subMenuItemBg: 'transparent',
        darkItemBg: 'transparent',
        darkSubMenuItemBg: 'transparent',
        itemHeight: 38,
        itemPaddingInline: 0,
        activeBarWidth: 0,
        popupBg: dark ? '#1C2333' : 'rgba(255,255,255,0.90)',
        itemSelectedBg: dark ? 'rgba(99,102,241,0.12)' : '#EEF2FF',
        itemSelectedColor: dark ? '#818CF8' : '#4338CA',
        itemHoverBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.80)',
        itemColor: dark ? 'rgba(255,255,255,0.58)' : '#4B5675',
      },
      Button: {
        borderRadius: 10,
        fontWeight: 500,
        controlHeight: 38,
      },
      Input: {
        controlHeight: 38,
        paddingBlock: 8,
        paddingInline: 12,
        activeShadow: '0 0 0 3px rgba(99,102,241,0.18)',
        borderRadius: 10,
        colorBgContainer: dark ? '#161B22' : '#FFFFFF',
      },
      Select: {
        controlHeight: 38,
        borderRadius: 10,
        optionActiveBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.80)',
        optionSelectedBg: dark ? 'rgba(99,102,241,0.12)' : '#EEF2FF',
        optionSelectedColor: dark ? '#818CF8' : '#4338CA',
        colorBgContainer: dark ? '#161B22' : '#FFFFFF',
      },
      DatePicker: {
        controlHeight: 38,
        borderRadius: 10,
        activeShadow: '0 0 0 3px rgba(99,102,241,0.18)',
        colorBgContainer: dark ? '#161B22' : '#FFFFFF',
      },
      InputNumber: {
        controlHeight: 38,
        borderRadius: 10,
        colorBgContainer: dark ? '#161B22' : '#FFFFFF',
      },
      Table: {
        headerBg: dark ? '#141921' : '#F9FAFB',
        rowHoverBg: dark ? '#1C2333' : '#F9FAFB',
        headerColor: dark ? 'rgba(255,255,255,0.36)' : '#8796AC',
        borderColor: dark ? '#2D3748' : '#E5E9F0',
        cellPaddingBlock: 12,
        cellPaddingInline: 16,
        headerSortActiveBg: 'transparent',
        headerSortHoverBg: 'transparent',
        colorBgContainer: dark ? '#161B22' : '#FFFFFF',
      },
      Card: {
        paddingLG: 24,
        borderRadius: 18,
        colorBgContainer: dark ? '#161B22' : '#FFFFFF',
      },
      Modal: {
        borderRadius: 24,
        contentBg: dark ? 'rgba(22,27,34,0.70)' : 'rgba(255,255,255,0.70)',
        headerBg: 'transparent',
      },
      Drawer: {
        colorBgContainer: dark ? 'rgba(22,27,34,0.70)' : 'rgba(255,255,255,0.70)',
      },
      Message: {
        contentBg: dark ? 'rgba(22,27,34,0.85)' : 'rgba(255,255,255,0.85)',
        contentPadding: '12px 24px',
        borderRadiusLG: 14,
      },
      Tag: {
        borderRadius: 999,
        fontSize: 11,
      },
      Statistic: {
        titleFontSize: 11,
        contentFontSize: 28,
      },
      Typography: {
        fontWeightStrong: 700,
        colorTextHeading: dark ? 'rgba(255,255,255,0.92)' : '#0F1629',
      },
      Pagination: {
        borderRadius: 10,
        colorBgContainer: dark ? '#161B22' : '#FFFFFF',
      },
    },
  });

  const customRenderEmpty = () => (
    <div style={{ padding: '24px', textAlign: 'center' }}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No data found" />
    </div>
  );

  return (
    <ErrorBoundary>
      <ConfigProvider theme={buildTheme(isDarkMode)} renderEmpty={customRenderEmpty}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public */}
                <Route path="/login" element={<AuthGuard><LoginPage /></AuthGuard>} />
                <Route path="/verify-mfa" element={<AuthGuard><MFAVerifyPage /></AuthGuard>} />
                <Route path="/setup-mfa" element={<AuthGuard><MFASetupPage /></AuthGuard>} />

                {/* Protected */}
                <Route
                  path="/"
                  element={
                    <Suspense fallback={<PageLoader />}>
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    </Suspense>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="setup-mfa" element={<MFASetupPage />} />

                  {/* POS */}
                  <Route path="pos" element={<POSPage />} />
                  <Route path="pos/shift" element={<ShiftPage />} />

                  {/* Inventory & Stock */}
                  <Route path="inventory" element={<InventoryPage />} />
                  <Route path="inventory/categories" element={<InventoryPage />} />
                  <Route path="inventory/stock" element={<InventoryPage />} />
                  <Route path="inventory/ledger" element={<StockLedgerPage />} />
                  <Route path="inventory/transfers" element={<StockTransferPage />} />
                  <Route path="inventory/opname" element={<StockOpnamePage />} />
                  <Route path="inventory/goods-receipt" element={<Navigate to="/purchase/receipts" replace />} />
                  <Route path="inventory/goods-receipts" element={<Navigate to="/purchase/receipts" replace />} />

                  {/* Sales */}
                  <Route path="sales" element={<SalesOrderPage />} />
                  <Route path="sales/returns" element={<SalesReturnPage />} />

                  {/* Procurement */}
                  <Route path="purchase" element={<PurchasePage />} />
                  <Route path="purchase/suppliers" element={<PurchasePage />} />
                  <Route path="purchase/requests" element={<PurchaseRequestPage />} />
                  <Route path="purchase/receipts" element={<PurchasePage />} />
                  <Route path="purchase/returns" element={<PurchasePage />} />

                  {/* Finance / Accounting */}
                  <Route path="finance" element={<FinancePage />} />
                  <Route path="finance/expenses" element={<FinancePage />} />
                  <Route path="finance/payments" element={<PaymentPage />} />
                  <Route path="finance/reconciliation" element={<BankReconciliationPage />} />
                  <Route path="finance/periods" element={<FiscalPeriodPage />} />
                  <Route path="finance/assets" element={<FixedAssetPage />} />
                  <Route path="payment" element={<Navigate to="/finance/payments" replace />} />
                  <Route path="bank-reconciliation" element={<Navigate to="/finance/reconciliation" replace />} />

                  {/* Invoicing AR/AP */}
                  <Route path="invoicing" element={<InvoicingPage />} />

                  {/* Reports & Analytics */}
                  <Route path="reporting" element={<ReportingPage />} />
                  <Route path="reporting/sales" element={<ReportingPage />} />
                  <Route path="reporting/purchase" element={<ReportingPage />} />
                  <Route path="reporting/inventory" element={<ReportingPage />} />
                  <Route path="reporting/financial" element={<ReportingPage />} />

                  {/* Governance & Audit */}
                  <Route path="approvals" element={<ApprovalPage />} />
                  <Route path="audit" element={<AuditTrailPage />} />

                  {/* Settings & Master Data */}
                  <Route path="master-data" element={<MasterDataPage />} />
                  
                  {/* Admin & Security */}
                  <Route path="admin" element={<UserManagementPage />} />
                  <Route path="admin/store" element={<UserManagementPage />} />
                  <Route path="admin/users" element={<UserManagementPage />} />
                  <Route path="admin/roles" element={<RoleManagementPage />} />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </QueryClientProvider>
      </ConfigProvider>
    </ErrorBoundary>
  );
};

export default App;
