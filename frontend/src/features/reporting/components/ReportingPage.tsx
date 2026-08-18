import React, { useState } from 'react';
import { Row, Col, Card, Typography, Select, Button, Space, DatePicker, message, Table, Statistic } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useExecutiveDashboard, useInventoryPosition } from '../hooks/useReporting';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export const ReportingPage: React.FC = () => {
  const [reportType, setReportType] = useState<'sales' | 'inventory'>('sales');
  const [asOfDate, setAsOfDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  
  const { data: execData, isLoading: isExecLoading, refetch: refetchExec } = useExecutiveDashboard(asOfDate);
  const { data: invData, isLoading: isInvLoading, refetch: refetchInv } = useInventoryPosition(asOfDate);

  const handleExportXLSX = () => {
    try {
      if (reportType === 'sales') {
        if (!execData?.top_products?.length) return message.warning('No data to export');
        const ws = XLSX.utils.json_to_sheet(execData.top_products);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Top Products');
        XLSX.writeFile(wb, `Sales_Report_${Date.now()}.xlsx`);
      } else {
        if (!invData?.items?.length) return message.warning('No data to export');
        const ws = XLSX.utils.json_to_sheet(invData.items);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory Position');
        XLSX.writeFile(wb, `Inventory_Report_${Date.now()}.xlsx`);
      }
      message.success('Exported to XLSX');
    } catch (e) {
      message.error('Failed to export XLSX');
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.text(`Kiro ERP - ${reportType === 'sales' ? 'Executive Sales' : 'Inventory Position'} Report`, 14, 15);
      doc.text(`As of: ${asOfDate}`, 14, 22);

      if (reportType === 'sales') {
        if (!execData?.top_products?.length) return message.warning('No data to export');
        const columns = ['Product Name', 'Total Qty', 'Total Revenue (Rp)'];
        const rows = execData.top_products.map((r: any) => [
          r.product_name, 
          r.total_qty, 
          r.total_revenue.toLocaleString()
        ]);
        autoTable(doc, {
          head: [columns],
          body: rows,
          startY: 28,
          theme: 'grid',
          styles: { fontSize: 8 },
          headStyles: { fillColor: [139, 92, 246] }
        });
      } else {
        if (!invData?.items?.length) return message.warning('No data to export');
        const columns = ['Code', 'Name', 'Warehouse', 'Qty On Hand', 'Avg Cost', 'Total Value'];
        const rows = invData.items.map((r: any) => [
          r.product_code,
          r.product_name,
          r.warehouse_name,
          r.qty_on_hand,
          r.average_cost.toLocaleString(),
          r.total_value.toLocaleString()
        ]);
        autoTable(doc, {
          head: [columns],
          body: rows,
          startY: 28,
          theme: 'grid',
          styles: { fontSize: 8 },
          headStyles: { fillColor: [139, 92, 246] }
        });
      }

      doc.save(`${reportType}_report_${Date.now()}.pdf`);
      message.success('Exported to PDF');
    } catch (e) {
      message.error('Failed to export PDF');
    }
  };

  const salesOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: execData?.top_products?.map((d: any) => d.product_name) || [],
      axisLabel: { color: '#94A3B8', interval: 0, rotate: 15 },
      axisLine: { lineStyle: { color: '#2D2D3F' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94A3B8' },
      splitLine: { lineStyle: { color: '#1E1E2E' } }
    },
    series: [
      {
        name: 'Revenue',
        type: 'bar',
        barWidth: '40%',
        data: execData?.top_products?.map((d: any) => d.total_revenue) || [],
        itemStyle: { 
          color: '#8B5CF6',
          borderRadius: [4, 4, 0, 0]
        }
      }
    ]
  };

  // Group inventory items by warehouse for the pie chart
  const warehouseGroups = invData?.items?.reduce((acc: any, item: any) => {
    acc[item.warehouse_name] = (acc[item.warehouse_name] || 0) + item.total_value;
    return acc;
  }, {});

  const inventoryOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { textStyle: { color: '#94A3B8' }, orient: 'vertical', right: 10, top: 'center' },
    series: [
      {
        name: 'Inventory Value',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#12121A', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: warehouseGroups 
          ? Object.keys(warehouseGroups).map(k => ({ value: warehouseGroups[k], name: k })) 
          : []
      }
    ]
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Reporting & Analytics</Title>
          <Text className="page-subtitle">Insights into sales, inventory, and finance</Text>
        </div>
        <Space>
          <Select value={reportType} onChange={setReportType} style={{ width: 180 }}>
            <Option value="sales">Executive Dashboard</Option>
            <Option value="inventory">Inventory Position</Option>
          </Select>
          <DatePicker 
            value={dayjs(asOfDate)} 
            onChange={(_, dateStr) => setAsOfDate(dateStr as string)} 
            allowClear={false}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { refetchExec(); refetchInv(); }} />
          <Button icon={<DownloadOutlined />} onClick={handleExportXLSX}>XLSX</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportPDF} type="primary">PDF</Button>
        </Space>
      </div>

      {reportType === 'sales' && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card className="stat-card">
              <Statistic title="Total Sales" value={execData?.total_sales || 0} prefix="Rp" />
            </Card>
          </Col>
          <Col span={6}>
            <Card className="stat-card">
              <Statistic title="Total Purchases" value={execData?.total_purchases || 0} prefix="Rp" />
            </Card>
          </Col>
          <Col span={6}>
            <Card className="stat-card">
              <Statistic title="AR Outstanding" value={execData?.ar_outstanding || 0} prefix="Rp" valueStyle={{ color: '#3b82f6' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card className="stat-card">
              <Statistic title="AP Outstanding" value={execData?.ap_outstanding || 0} prefix="Rp" valueStyle={{ color: '#f59e0b' }} />
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card 
            className="stat-card" 
            loading={reportType === 'sales' ? isExecLoading : isInvLoading}
            title={reportType === 'sales' ? "Top 5 Products by Revenue" : "Inventory Value by Warehouse"}
          >
            <ReactECharts
              option={reportType === 'sales' ? salesOption : inventoryOption}
              style={{ height: 400 }}
              opts={{ renderer: 'svg' }}
            />
          </Card>
        </Col>
      </Row>
      
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card className="stat-card" title="Data Details">
            {reportType === 'sales' ? (
              <Table
                dataSource={execData?.top_products || []}
                rowKey="product_id"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Product', dataIndex: 'product_name' },
                  { title: 'Total Qty', dataIndex: 'total_qty', align: 'right' },
                  { title: 'Revenue', dataIndex: 'total_revenue', align: 'right', render: (v: number) => `Rp ${v.toLocaleString()}` }
                ]}
              />
            ) : (
              <Table
                dataSource={invData?.items || []}
                rowKey={(r: any) => `${r.product_id}-${r.warehouse_id}`}
                size="small"
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: 'Code', dataIndex: 'product_code' },
                  { title: 'Product', dataIndex: 'product_name' },
                  { title: 'Warehouse', dataIndex: 'warehouse_name' },
                  { title: 'Qty On Hand', dataIndex: 'qty_on_hand', align: 'right' },
                  { title: 'Avg Cost', dataIndex: 'average_cost', align: 'right', render: (v: number) => `Rp ${v.toLocaleString()}` },
                  { title: 'Total Value', dataIndex: 'total_value', align: 'right', render: (v: number) => `Rp ${v.toLocaleString()}` }
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
