import React from 'react';
import { Row, Col, Card, Statistic, Typography, List, Avatar, Tag } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  WarningOutlined,
  DollarOutlined,
  AreaChartOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useDashboardData } from '../hooks/useDashboardData';

const { Title, Text } = Typography;

const CHART_DATA = {
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  revenue: [12, 15.5, 11.2, 18.9, 24.5, 31, 28.4],
};

const RECENT_ACTIVITIES = [
  { text: 'New POS Sale #POS-20260725-00092', time: '2 mins ago', color: '#8B5CF6' },
  { text: 'Stock Opname initiated (WH-01)', time: '15 mins ago', color: '#FBBF24' },
  { text: 'Supplier Invoice Paid (PT Tech)', time: '1 hour ago', color: '#34D399' },
  { text: 'PO-202607-00012 approved', time: '2 hours ago', color: '#8B5CF6' },
  { text: 'Low stock alert: SKU-A001 (5 units)', time: '3 hours ago', color: '#F43F5E' },
];

export const DashboardPage: React.FC = () => {
  const { data, isLoading } = useDashboardData();

  const revenueChartOption = {
    backgroundColor: 'transparent',
    grid: { top: 20, right: 20, bottom: 30, left: 60 },
    xAxis: {
      type: 'category',
      data: CHART_DATA.days,
      axisLine: { lineStyle: { color: '#2D2D3F' } },
      axisLabel: { color: '#64748B', fontSize: 12 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748B', fontSize: 12, formatter: (v: number) => `${v}M` },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#1E1E2E', type: 'dashed' } },
    },
    series: [
      {
        data: CHART_DATA.revenue,
        type: 'bar',
        barMaxWidth: 40,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#8B5CF6' },
              { offset: 1, color: 'rgba(139, 92, 246, 0.2)' },
            ],
          },
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: {
          itemStyle: {
            color: '#A78BFA',
            shadowBlur: 16,
            shadowColor: 'rgba(139, 92, 246, 0.6)',
          },
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1A1A24',
      borderColor: '#2D2D3F',
      textStyle: { color: '#E2E8F0' },
      formatter: (params: any[]) => {
        const p = params[0];
        return `${p.name}<br/><span style="color:#8B5CF6">●</span> Revenue: Rp ${(p.value * 1_000_000).toLocaleString('id-ID')}`;
      },
    },
  };

  const formatCurrency = (val?: number) =>
    val !== undefined ? `Rp ${val.toLocaleString('id-ID')}` : '—';

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>
            Executive Overview
          </Title>
          <Text className="page-subtitle">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </Text>
        </div>
        <Tag color="purple" style={{ padding: '4px 12px', fontSize: 13 }}>Live</Tag>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" loading={isLoading}>
            <Statistic
              title={<Text style={{ color: '#64748B' }}>Total Revenue (Today)</Text>}
              value={data?.total_sales ?? 0}
              formatter={(v) => formatCurrency(v as number)}
              valueStyle={{ color: '#8B5CF6', fontSize: 22, fontWeight: 700 }}
              prefix={<AreaChartOutlined />}
              suffix={<Text style={{ fontSize: 12, color: '#34D399', marginLeft: 8 }}><ArrowUpOutlined /> 12.5%</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" loading={isLoading}>
            <Statistic
              title={<Text style={{ color: '#64748B' }}>Cash Position</Text>}
              value={data?.cash_position ?? 0}
              formatter={(v) => formatCurrency(v as number)}
              valueStyle={{ color: '#34D399', fontSize: 22, fontWeight: 700 }}
              prefix={<DollarOutlined />}
              suffix={<Text style={{ fontSize: 12, color: '#34D399', marginLeft: 8 }}><ArrowUpOutlined /> 5.2%</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" loading={isLoading}>
            <Statistic
              title={<Text style={{ color: '#64748B' }}>A/R Outstanding</Text>}
              value={data?.ar_outstanding ?? 0}
              formatter={(v) => formatCurrency(v as number)}
              valueStyle={{ color: '#FBBF24', fontSize: 22, fontWeight: 700 }}
              suffix={<Text style={{ fontSize: 12, color: '#F43F5E', marginLeft: 8 }}><ArrowDownOutlined /> 2.1%</Text>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card" loading={isLoading}>
            <Statistic
              title={<Text style={{ color: '#64748B' }}>Items Low in Stock</Text>}
              value={12}
              valueStyle={{ color: '#F43F5E', fontSize: 22, fontWeight: 700 }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts + Activity */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            className="stat-card"
            title={<Text style={{ color: '#E2E8F0', fontWeight: 600 }}>Weekly Revenue Trend</Text>}
          >
            <ReactECharts option={revenueChartOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            className="stat-card"
            title={<Text style={{ color: '#E2E8F0', fontWeight: 600 }}>Recent Activity</Text>}
            style={{ height: '100%' }}
          >
            <List
              dataSource={RECENT_ACTIVITIES}
              renderItem={(item) => (
                <List.Item style={{ padding: '10px 0', borderBottomColor: '#1E1E2E' }}>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        size={8}
                        style={{ background: item.color, marginTop: 6 }}
                      />
                    }
                    title={<Text style={{ color: '#CBD5E1', fontSize: 13 }}>{item.text}</Text>}
                    description={<Text style={{ color: '#475569', fontSize: 11 }}>{item.time}</Text>}
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
