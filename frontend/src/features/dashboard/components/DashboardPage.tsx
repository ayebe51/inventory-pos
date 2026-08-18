import React from 'react';
import { Row, Col, Card, Statistic, Typography, List, Tag, Button, theme as antTheme } from 'antd';
import {
  AreaChartOutlined,
  DollarOutlined,
  CreditCardOutlined,
  ShoppingCartOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  PlusOutlined,
  ShopOutlined,
  FileAddOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import { useThemeStore } from '../../../store/themeStore';
import { useDashboardData, useRecentActivities } from '../hooks/useDashboardData';

const { Title, Text } = Typography;

const ICON_MAP: Record<string, React.ReactNode> = {
  ShoppingCartOutlined: <ShoppingCartOutlined />,
  WarningOutlined: <WarningOutlined />,
  DollarOutlined: <DollarOutlined />,
  CheckCircleOutlined: <CheckCircleOutlined />,
  InfoOutlined: <WarningOutlined />, // fallback to something if info isn't imported
};

export const DashboardPage: React.FC = () => {
  const { data, isLoading } = useDashboardData();
  const { data: recentActivities = [], isLoading: isLoadingActivities } = useRecentActivities();
  const { token } = antTheme.useToken();
  const { isDarkMode } = useThemeStore();
  const navigate = useNavigate();

  const revenueChartOption = {
    backgroundColor: 'transparent',
    grid: { top: 20, right: 20, bottom: 30, left: 60 },
    xAxis: {
      type: 'category',
      data: data?.salesTrend?.map((d: any) => d.date) || [],
      axisLine: { lineStyle: { color: token.colorBorderSecondary } },
      axisLabel: { fontSize: 12, color: token.colorTextSecondary },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 12, color: token.colorTextSecondary, formatter: (v: number) => `Rp ${(v / 1_000_000)}M` },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: token.colorBorderSecondary, type: 'dashed' } },
    },
    series: [
      {
        data: data?.salesTrend?.map((d: any) => d.revenue) || [],
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: token.colorPrimary },
              { offset: 1, color: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : 'rgba(79, 70, 229, 0.1)' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
          itemStyle: {
            color: '#6366F1',
          },
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: token.colorBgContainer,
      borderColor: token.colorBorder,
      textStyle: { color: token.colorText },
      formatter: (params: any[]) => {
        const p = params[0];
        return `${p.name}<br/><span style="color:${token.colorPrimary}">●</span> Revenue: Rp ${Number(p.value).toLocaleString('id-ID')}`;
      },
    },
  };

  const formatCurrency = (val?: number) =>
    val !== undefined ? `Rp ${val.toLocaleString('id-ID')}` : '—';

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>
            Executive Overview
          </Title>
          <Text className="page-subtitle">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </div>
        <Tag color="geekblue" style={{ padding: '4px 12px', fontSize: 13, borderRadius: 6, border: 'none', background: 'var(--brand-50)', color: 'var(--brand-600)' }}>Live Updates</Tag>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: 32 }}>
        <Title level={5} style={{ marginBottom: 16, color: token.colorTextSecondary, fontWeight: 600 }}>Quick Actions</Title>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => navigate('/inventory/products')} style={{ borderRadius: 8, padding: '0 24px' }}>Add Product</Button>
          <Button icon={<ShopOutlined />} size="large" onClick={() => navigate('/pos/shift')} style={{ borderRadius: 8, padding: '0 24px' }}>Open Shift</Button>
          <Button icon={<FileAddOutlined />} size="large" onClick={() => navigate('/purchase')} style={{ borderRadius: 8, padding: '0 24px' }}>Create PO</Button>
          <Button icon={<ShoppingCartOutlined />} size="large" onClick={() => navigate('/invoicing')} style={{ borderRadius: 8, padding: '0 24px' }}>New Invoice</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card className="stat-card" loading={isLoading} bodyStyle={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <Text style={{ color: token.colorTextSecondary, fontSize: 14, fontWeight: 500 }}>Total Revenue</Text>
              <div className="stat-icon" style={{ background: 'var(--brand-50)', color: 'var(--brand-600)' }}>
                <AreaChartOutlined />
              </div>
            </div>
            <Statistic
              value={data?.total_sales ?? 0}
              formatter={(v) => formatCurrency(v as number)}
              valueStyle={{ color: token.colorText, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            />
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Text type="secondary">Generated from active POS and Invoices</Text>
            </div>
          </Card>
        </Col>
        
        <Col xs={24} sm={12} lg={8}>
          <Card className="stat-card" loading={isLoading} bodyStyle={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <Text style={{ color: token.colorTextSecondary, fontSize: 14, fontWeight: 500 }}>Cash Position</Text>
              <div className="stat-icon" style={{ background: '#D1FAE5', color: '#059669' }}>
                <DollarOutlined />
              </div>
            </div>
            <Statistic
              value={data?.cash_position ?? 0}
              formatter={(v) => formatCurrency(v as number)}
              valueStyle={{ color: token.colorText, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            />
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Text type="secondary">Live cash and bank balance</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card className="stat-card" loading={isLoading} bodyStyle={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <Text style={{ color: token.colorTextSecondary, fontSize: 14, fontWeight: 500 }}>Inventory Value</Text>
              <div className="stat-icon" style={{ background: '#F3E8FF', color: '#9333EA' }}>
                <ShoppingCartOutlined />
              </div>
            </div>
            <Statistic
              value={data?.inventory_value ?? 0}
              formatter={(v) => formatCurrency(v as number)}
              valueStyle={{ color: token.colorText, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            />
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <Text type="secondary">Based on running average cost</Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card className="stat-card" loading={isLoading} bodyStyle={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <Text style={{ color: token.colorTextSecondary, fontSize: 14, fontWeight: 500 }}>A/R Outstanding</Text>
              <div className="stat-icon" style={{ background: '#DBEAFE', color: '#2563EB' }}>
                <CreditCardOutlined />
              </div>
            </div>
            <Statistic
              value={data?.ar_outstanding ?? 0}
              formatter={(v) => formatCurrency(v as number)}
              valueStyle={{ color: token.colorText, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            />
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {data?.ar_outstanding > 0 && <Tag color="error" style={{ margin: 0, border: 'none' }}>needs collection</Tag>}
              <Text type="secondary">Total uncollected receivables</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card className="stat-card" loading={isLoading} bodyStyle={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <Text style={{ color: token.colorTextSecondary, fontSize: 14, fontWeight: 500 }}>A/P Outstanding</Text>
              <div className="stat-icon" style={{ background: '#FEF3C7', color: '#D97706' }}>
                <CreditCardOutlined />
              </div>
            </div>
            <Statistic
              value={data?.ap_outstanding ?? 0}
              formatter={(v) => formatCurrency(v as number)}
              valueStyle={{ color: token.colorText, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            />
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {data?.ap_outstanding > 0 && <Tag color="warning" style={{ margin: 0, border: 'none' }}>pending payment</Tag>}
              <Text type="secondary">Total unpaid vendor invoices</Text>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card className="stat-card" loading={isLoading} bodyStyle={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <Text style={{ color: token.colorTextSecondary, fontSize: 14, fontWeight: 500 }}>Low Stock Alerts</Text>
              <div className="stat-icon" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                <WarningOutlined />
              </div>
            </div>
            <Statistic
              value={data?.low_stock_alerts ?? 0}
              valueStyle={{ color: token.colorText, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            />
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              {data?.low_stock_alerts > 0 ? (
                <Tag color="error" style={{ margin: 0, border: 'none' }}>Action Required</Tag>
              ) : (
                <Tag color="success" style={{ margin: 0, border: 'none' }}>Healthy</Tag>
              )}
              <Text type="secondary">Items below reorder threshold</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts + Activity */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={16}>
          <Card
            className="stat-card"
            title={<Text style={{ fontWeight: 600, fontSize: 16 }}>Weekly Revenue Trend</Text>}
            loading={isLoading}
            bodyStyle={{ padding: 24 }}
          >
            <ReactECharts option={revenueChartOption} style={{ height: 320 }} opts={{ renderer: 'svg' }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            className="stat-card"
            title={<Text style={{ fontWeight: 600, fontSize: 16 }}>Recent Activity</Text>}
            style={{ height: '100%' }}
            bodyStyle={{ padding: '8px 24px' }}
          >
            <List
              loading={isLoadingActivities}
              dataSource={recentActivities}
              renderItem={(item: any) => (
                <List.Item style={{ padding: '16px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                  <List.Item.Meta
                    avatar={
                      <div className="icon-pill" style={{ background: isDarkMode ? `${item.color}20` : `${item.color}15`, color: item.color, width: 32, height: 32, fontSize: 14 }}>
                        {ICON_MAP[item.icon] || <WarningOutlined />}
                      </div>
                    }
                    title={<Text style={{ color: token.colorText, fontSize: 14, fontWeight: 500 }}>{item.text}</Text>}
                    description={<Text style={{ color: token.colorTextSecondary, fontSize: 12, opacity: 0.8 }}>{new Date(item.time).toLocaleString()}</Text>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
