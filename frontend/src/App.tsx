import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Spin } from 'antd';
import { Layout } from './components/layout/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuthStore } from './store/authStore';

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
const FinancePage = lazy(() => import('./features/finance/components/FinancePage').then((m) => ({ default: m.FinancePage })));
const PaymentPage = lazy(() => import('./features/finance/components/PaymentPage').then((m) => ({ default: m.PaymentPage })));
const BankReconciliationPage = lazy(() => import('./features/finance/components/BankReconciliationPage').then((m) => ({ default: m.BankReconciliationPage })));
const PurchasePage = lazy(() => import('./features/purchase/components/PurchasePage').then((m) => ({ default: m.PurchasePage })));
const ReportingPage = lazy(() => import('./features/reporting/components/ReportingPage').then((m) => ({ default: m.ReportingPage })));
const MasterDataPage = lazy(() => import('./features/master-data/components/MasterDataPage').then((m) => ({ default: m.MasterDataPage })));
const InvoicingPage = lazy(() => import('./features/invoicing/components/InvoicingPage').then((m) => ({ default: m.InvoicingPage })));
const ApprovalPage = lazy(() => import('./features/approvals/components/ApprovalPage').then((m) => ({ default: m.ApprovalPage })));
const AuditTrailPage = lazy(() => import('./features/approvals/components/AuditTrailPage').then((m) => ({ default: m.AuditTrailPage })));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
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
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<AuthGuard><LoginPage /></AuthGuard>} />
              <Route path="/verify-mfa" element={<AuthGuard><MFAVerifyPage /></AuthGuard>} />

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

                {/* Inventory */}
                <Route path="inventory" element={<InventoryPage />} />

                {/* Sales */}
                <Route path="sales" element={<SalesOrderPage />} />
                <Route path="sales/returns" element={<SalesReturnPage />} />

                {/* Purchase */}
                <Route path="purchase" element={<PurchasePage />} />

                {/* Finance / Accounting */}
                <Route path="finance" element={<FinancePage />} />
                <Route path="payment" element={<PaymentPage />} />
                <Route path="bank-reconciliation" element={<BankReconciliationPage />} />

                {/* Invoicing AR/AP */}
                <Route path="invoicing" element={<InvoicingPage />} />

                {/* Payment */}
                {/* <Route path="payment" element={<PaymentPage />} /> */}

                {/* Reports & Analytics */}
                <Route path="reporting" element={<ReportingPage />} />

                {/* Governance & Audit */}
                <Route path="approvals" element={<ApprovalPage />} />
                <Route path="audit" element={<AuditTrailPage />} />

                {/* Settings & Master Data */}
                <Route path="master-data" element={<MasterDataPage />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
