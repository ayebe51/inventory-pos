import React, { useState } from 'react';
import { Row, Col, Typography, Table, Button, theme as antTheme } from 'antd';
import {
  DollarOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
  PlusOutlined,
  ShopOutlined,
  FileAddOutlined,
  CheckCircleOutlined,
  RightOutlined,
  WalletOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { useThemeStore } from '../../../store/themeStore';
import { useAuthStore } from '../../../store/authStore';
import { useDashboardData, useRecentActivities, useMonthlyTrend } from '../hooks/useDashboardData';
import styles from './DashboardPage.module.css';

const { Text } = Typography;

export const DashboardPage: React.FC = () => {
  const { data } = useDashboardData();
  const { data: monthlyTrend } = useMonthlyTrend();
  const { data: recentActivities = [], isLoading: isLoadingActivities } = useRecentActivities();
  const user = useAuthStore((s) => s.user);
  const { token } = antTheme.useToken();
  const { isDarkMode } = useThemeStore();
  const navigate = useNavigate();
  const [chartTimeframe, setChartTimeframe] = useState<'weekly' | 'monthly'>('weekly');

  const formatYAxisLabel = (v: number) => {
    if (!v || Math.abs(v) < 1) return 'Rp 0';
    const abs = Math.abs(v);
    if (abs >= 1_000_000_000) {
      return `Rp ${(v / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}B`;
    }
    if (abs >= 1_000_000) {
      return `Rp ${(v / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}M`;
    }
    if (abs >= 1_000) {
      return `Rp ${(v / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })}k`;
    }
    return `Rp ${Math.round(v).toLocaleString('id-ID')}`;
  };

  const formatCurrency = (val?: number) =>
    val !== undefined && val !== 0 ? `Rp ${val.toLocaleString('id-ID')}` : 'Rp 0';

  // Format today's date in Indonesian format
  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';

  const isWeekly = chartTimeframe === 'weekly';

  const xAxisData = isWeekly
    ? data?.salesTrend?.map((d: any) => d.date) || []
    : monthlyTrend?.map((d: any) => d.date) || [];

  const salesData = isWeekly
    ? data?.salesTrend?.map((d: any) => d.revenue) || []
    : monthlyTrend?.map((d: any) => d.revenue) || [];

  const hasSalesData = salesData.some((v: number) => v > 0);

  const revenueChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDarkMode ? '#1C2333' : '#FFFFFF',
      borderColor: token.colorBorder,
      textStyle: { color: token.colorText },
      formatter: (params: any[]) => {
        const p1 = params[0];
        const val1 = Number(p1?.value) || 0;
        return `
          <div style="font-weight:600;margin-bottom:4px;">${p1?.name || ''}</div>
          <div style="color:#F05328;display:flex;justify-content:space-between;gap:12px;">
            <span>● Omset Penjualan:</span> <b>Rp ${val1.toLocaleString('id-ID')}</b>
          </div>
        `;
      },
    },
    grid: { top: 20, right: 15, bottom: 30, left: 75 },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLine: { lineStyle: { color: token.colorBorderSecondary } },
      axisLabel: { fontSize: 12, color: token.colorTextSecondary },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 12, color: token.colorTextSecondary, formatter: formatYAxisLabel },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: token.colorBorderSecondary, type: 'dashed' } },
    },
    series: [
      {
        name: 'Omset Penjualan',
        type: 'bar',
        barMaxWidth: isWeekly ? 24 : 16,
        data: salesData,
        itemStyle: {
          color: '#F05328',
          borderRadius: [6, 6, 0, 0],
        },
      },
    ],
  };

  // Recent Activities Table Columns
  const columns = [
    {
      title: 'Waktu',
      dataIndex: 'time',
      key: 'time',
      render: (time: string) => (
        <span style={{ color: token.colorTextSecondary, fontSize: 12.5, fontWeight: 500 }}>
          {time ? new Date(time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
        </span>
      ),
    },
    {
      title: 'Aktivitas System / Log',
      dataIndex: 'text',
      key: 'text',
      render: (text: string) => (
        <span style={{ fontWeight: 600, color: token.colorText }}>
          {text || 'System Event'}
        </span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: record.color || '#10B981' }}>
          <span className={`${styles.statusDot} ${styles.statusDotSuccess}`} style={{ background: record.color || '#10B981' }} />
          Log System
        </span>
      ),
    },
    {
      title: 'Aksi',
      key: 'action',
      render: () => (
        <Button type="text" size="small" icon={<RightOutlined style={{ fontSize: 12 }} />} onClick={() => navigate('/reporting')} />
      ),
    },
  ];

  return (
    <div className={styles.dashboardContainer}>
      {/* Header Row (Greetings + Quick Action Buttons) */}
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.greetingTitle}>{greeting}, {user?.name || 'Admin'} 👋</h1>
          <p className={styles.greetingSubtitle}>
            {todayFormatted} · Ringkasan operasional toko, penjualan, & kesehatan stok hari ini.
          </p>
        </div>

        {/* Finexy Actionable Quick Actions */}
        <div className={styles.capsuleNav}>
          <button
            className={`${styles.capsuleButton} ${styles.capsuleButtonCoral}`}
            onClick={() => navigate('/pos/shift')}
          >
            <ShopOutlined style={{ marginRight: 6 }} /> Buka POS Kasir
          </button>
          <button
            className={styles.capsuleButton}
            onClick={() => navigate('/inventory')}
          >
            <PlusOutlined style={{ marginRight: 6 }} /> + Produk
          </button>
          <button
            className={styles.capsuleButton}
            onClick={() => navigate('/purchase')}
          >
            <FileAddOutlined style={{ marginRight: 6 }} /> + Purchase Order
          </button>
        </div>
      </div>

      {/* 4 Humanized KPI Stat Cards Grid */}
      <Row gutter={[20, 20]}>
        {/* KPI Card 1: Penjualan Hari Ini (Highlight Solid Coral) */}
        <Col xs={24} sm={12} lg={6}>
          <div className={styles.highlightStatCard}>
            <div className={styles.highlightCardHeader}>
              <span className={styles.highlightCardTitle}>Total Penjualan</span>
            </div>
            <div>
              <div className={styles.highlightValue}>
                {formatCurrency(data?.total_sales ?? 0)}
              </div>
              <span style={{ fontSize: 12, opacity: 0.9 }}>
                Akumulasi POS + invoice (posted/paid)
              </span>
            </div>
          </div>
        </Col>

        {/* KPI Card 2: Saldo Kas & Bank */}
        <Col xs={24} sm={12} lg={6}>
          <div className={styles.secondaryStatCard}>
            <div className={styles.statCardHeader}>
              <span className={styles.statCardTitle}>Saldo Kas & Bank</span>
              <div className={styles.statIconBox} style={{ background: '#ECFDF5', color: '#059669' }}>
                <DollarOutlined />
              </div>
            </div>
            <div>
              <div className={styles.statValue}>
                {formatCurrency(data?.cash_position ?? 0)}
              </div>
              <span className={`${styles.trendPill} ${styles.trendPillPositive}`}>
                <CheckCircleOutlined /> Piutang {formatCurrency(data?.ar_outstanding ?? 0)}
              </span>
            </div>
          </div>
        </Col>

        {/* KPI Card 3: Nilai Persediaan */}
        <Col xs={24} sm={12} lg={6}>
          <div className={styles.secondaryStatCard}>
            <div className={styles.statCardHeader}>
              <span className={styles.statCardTitle}>Nilai Persediaan</span>
              <div className={styles.statIconBox} style={{ background: '#FFF1ED', color: '#F05328' }}>
                <ShoppingCartOutlined />
              </div>
            </div>
            <div>
              <div className={styles.statValue}>
                {formatCurrency(data?.inventory_value ?? 0)}
              </div>
              <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                Nilai persediaan berdasarkan ledger
              </span>
            </div>
          </div>
        </Col>

        {/* KPI Card 4: Perlu Perhatian / Stok Menipis */}
        <Col xs={24} sm={12} lg={6}>
          <div className={styles.secondaryStatCard} onClick={() => navigate('/inventory')} style={{ cursor: 'pointer' }}>
            <div className={styles.statCardHeader}>
              <span className={styles.statCardTitle}>Perlu Perhatian</span>
              <div className={styles.statIconBox} style={{ background: '#FEF2F2', color: '#DC2626' }}>
                <WarningOutlined />
              </div>
            </div>
            <div>
              <div className={styles.statValue}>
                {data?.low_stock_alerts ?? 0} <span style={{ fontSize: 14, fontWeight: 600, color: token.colorTextSecondary }}>SKU</span>
              </div>
              <span className={`${styles.trendPill} ${styles.trendPillNegative}`}>
                Stok ≤ 5 unit — klik untuk periksa →
              </span>
            </div>
          </div>
        </Col>
      </Row>

      {/* Middle Row: Revenue Trend Chart (Left) & Need Attention Action Widget (Right) */}
      <Row gutter={[20, 20]}>
        {/* Revenue Trend Chart / Educational Empty State */}
        <Col xs={24} lg={16}>
          <div className={styles.finexyCard} style={{ height: '100%' }}>
            <div className={styles.finexyCardHeader}>
              <div>
                <h3 className={styles.finexyCardTitle}>Grafik Penjualan & Profitability</h3>
                <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  Perbandingan Omset Penjualan (Oranye) & Net Profit (Dark Charcoal)
                </Text>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="small"
                  type={chartTimeframe === 'weekly' ? 'primary' : 'text'}
                  onClick={() => setChartTimeframe('weekly')}
                  style={{ borderRadius: 12, background: chartTimeframe === 'weekly' ? '#F05328' : 'transparent' }}
                >
                  Mingguan
                </Button>
                <Button
                  size="small"
                  type={chartTimeframe === 'monthly' ? 'primary' : 'text'}
                  onClick={() => setChartTimeframe('monthly')}
                  style={{ borderRadius: 12, background: chartTimeframe === 'monthly' ? '#F05328' : 'transparent' }}
                >
                  Bulanan
                </Button>
              </div>
            </div>

            {/* Educational Action Empty State if Sales == 0 */}
            {!hasSalesData ? (
              <div className={styles.emptyStateBox}>
                <RocketOutlined style={{ fontSize: 36, color: '#F05328' }} />
                <h4 className={styles.emptyStateTitle}>Belum Ada Transaksi Hari Ini</h4>
                <p className={styles.emptyStateSubtext}>
                  Grafik tren omset penjualan akan otomatis muncul setelah transaksi pertama Anda tercatat di kasir.
                </p>
                <Button
                  type="primary"
                  icon={<ShopOutlined />}
                  style={{ borderRadius: 12, background: '#F05328' }}
                  onClick={() => navigate('/pos/shift')}
                >
                  Buka POS Kasir Sekarang
                </Button>
              </div>
            ) : (
              <ReactECharts option={revenueChartOption} style={{ height: 310 }} opts={{ renderer: 'svg' }} />
            )}
          </div>
        </Col>

        {/* Right Section: Need Attention Action Widget & Real Stock Health */}
        <Col xs={24} lg={8}>
          <div className={styles.finexyCard} style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div className={styles.finexyCardHeader}>
                <h3 className={styles.finexyCardTitle}>Yang Perlu Perhatian</h3>
                <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>Aksi Membutuhkan Tindakan</Text>
              </div>

              {/* Action Attention Items — real data from executive dashboard */}
              <div className={styles.attentionItem}>
                <div className={styles.attentionMeta}>
                  <span className={styles.attentionDotYellow} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
                      {data?.low_stock_alerts ?? 0} Produk Stok Menipis
                    </div>
                    <div style={{ fontSize: 11, color: token.colorTextSecondary }}>Stok ≤ 5 unit di seluruh gudang</div>
                  </div>
                </div>
                <button className={styles.attentionActionBtn} onClick={() => navigate('/inventory')}>
                  Periksa
                </button>
              </div>

              <div className={styles.attentionItem}>
                <div className={styles.attentionMeta}>
                  <span className={styles.attentionDotBlue} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
                      Piutang Belum Lunas: {formatCurrency(data?.ar_outstanding ?? 0)}
                    </div>
                    <div style={{ fontSize: 11, color: token.colorTextSecondary }}>Invoice penjualan posted/partial</div>
                  </div>
                </div>
                <button className={styles.attentionActionBtn} onClick={() => navigate('/invoicing')}>
                  Tagihan
                </button>
              </div>

              <div className={styles.attentionItem}>
                <div className={styles.attentionMeta}>
                  <span className={styles.attentionDotRed} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
                      Hutang Usaha: {formatCurrency(data?.ap_outstanding ?? 0)}
                    </div>
                    <div style={{ fontSize: 11, color: token.colorTextSecondary }}>Invoice pembelian belum dibayar</div>
                  </div>
                </div>
                <button className={styles.attentionActionBtn} onClick={() => navigate('/finance')}>
                  Kelola
                </button>
              </div>
            </div>

            {/* Real Stock Status Breakdown */}
            <div style={{ background: token.colorBgLayout, padding: 16, borderRadius: 16, border: `1px solid ${token.colorBorderSecondary}`, marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: token.colorText }}>Kondisi Stok Barang</span>
                <Button type="link" size="small" style={{ padding: 0, color: '#F05328', fontWeight: 600 }} onClick={() => navigate('/inventory')}>
                  Lihat Detail →
                </Button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 4, fontSize: 12 }}>
                <span style={{ padding: '4px 8px', borderRadius: 8, background: (data?.low_stock_alerts ?? 0) > 0 ? '#FEF3C7' : '#ECFDF5', color: (data?.low_stock_alerts ?? 0) > 0 ? '#D97706' : '#059669', fontWeight: 600 }}>
                  {(data?.low_stock_alerts ?? 0) > 0 ? `🟡 ${data.low_stock_alerts} SKU Perlu Restock` : '🟢 Semua Stok Aman'}
                </span>
              </div>
            </div>
          </div>
        </Col>
      </Row>

      {/* Row 3: Humanized Kas & QRIS Mini Virtual Cards */}
      <Row gutter={[20, 20]}>
        <Col xs={24} md={12}>
          <div
            className={styles.miniCardDark}
            onClick={() => navigate('/pos/shift')}
            style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, opacity: 0.85, fontWeight: 500 }}>Posisi Kas & Bank</span>
              <WalletOutlined style={{ fontSize: 18 }} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{formatCurrency(data?.cash_position ?? 0)}</div>
              <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 600 }}>Kelola Keuangan →</span>
            </div>
          </div>
        </Col>

        <Col xs={24} md={12}>
          <div
            className={styles.miniCardCoral}
            onClick={() => navigate('/finance')}
            style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, opacity: 0.9, fontWeight: 500 }}>Total Pembelian</span>
              <ShoppingCartOutlined style={{ fontSize: 18 }} />
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{formatCurrency(data?.total_purchases ?? 0)}</div>
              <span style={{ fontSize: 12, opacity: 0.9, fontWeight: 600 }}>Invoice pembelian posted/paid →</span>
            </div>
          </div>
        </Col>
      </Row>

      {/* Bottom Row: Recent Transactions Table (Actionable & Prominent) */}
      <div className={styles.finexyCard}>
        <div className={styles.finexyCardHeader}>
          <div>
            <h3 className={styles.finexyCardTitle}>Transaksi POS & Aktivitas Terbaru</h3>
            <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
              Daftar transaksi kasir real-time dari toko
            </Text>
          </div>
          <Button type="link" style={{ color: '#F05328', fontWeight: 600 }} onClick={() => navigate('/sales')}>
            Lihat Semua Transaksi <RightOutlined style={{ fontSize: 10 }} />
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={recentActivities}
          rowKey={(record, idx) => record.id || idx || String(Math.random())}
          scroll={{ x: 'max-content' }}
          pagination={false}
          loading={isLoadingActivities}
          size="middle"
        />
      </div>
    </div>
  );
};
