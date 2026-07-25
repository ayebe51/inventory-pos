import React, { useState } from 'react';
import { Row, Col, Card, Typography, Select, Button, Space, DatePicker, message, Table } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSalesSummary, useInventoryPosition } from '../hooks/useReporting';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

export const ReportingPage: React.FC = () => {
  const [reportType, setReportType] = useState<'sales' | 'inventory'>('sales');
  
  // Dummy date range for now
  const { data: salesData, isLoading: isSalesLoading } = useSalesSummary('2026-07-01', '2026-07-31');
  const { data: inventoryData, isLoading: isInvLoading } = useInventoryPosition();

  const handleExportXLSX = () => {
    try {
      const dataToExport = reportType === 'sales' ? salesData : inventoryData;
      if (!dataToExport || dataToExport.length === 0) return message.warning('No data to export');
      
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Report');
      XLSX.writeFile(wb, `${reportType}_report_${Date.now()}.xlsx`);
      message.success('Exported to XLSX');
    } catch (e) {
      message.error('Failed to export XLSX');
    }
  };

  const handleExportPDF = () => {
    try {
      const dataToExport = reportType === 'sales' ? salesData : inventoryData;
      if (!dataToExport || dataToExport.length === 0) return message.warning('No data to export');

      const doc = new jsPDF();
      doc.text(`Kiro ERP - ${reportType === 'sales' ? 'Sales' : 'Inventory'} Report`, 14, 15);
      
      const columns = Object.keys(dataToExport[0]).map(key => ({ header: key.toUpperCase(), dataKey: key }));
      
      autoTable(doc, {
        head: [columns.map(c => c.header)],
        body: dataToExport.map((row: any) => columns.map(c => row[c.dataKey])),
        startY: 20,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [139, 92, 246] }
      });

      doc.save(`${reportType}_report_${Date.now()}.pdf`);
      message.success('Exported to PDF');
    } catch (e) {
      message.error('Failed to export PDF');
    }
  };

  const salesOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#E2E8F0' }, bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: salesData?.map((d: any) => d.date) || [],
      axisLabel: { color: '#64748B' },
      axisLine: { lineStyle: { color: '#2D2D3F' } }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#64748B' },
      splitLine: { lineStyle: { color: '#1E1E2E' } }
    },
    series: [
      {
        name: 'Revenue',
        type: 'line',
        smooth: true,
        data: salesData?.map((d: any) => d.revenue) || [],
        itemStyle: { color: '#8B5CF6' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: 'rgba(139,92,246,0.5)' }, { offset: 1, color: 'rgba(139,92,246,0)' }]
          }
        }
      }
    ]
  };

  const inventoryOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: { textStyle: { color: '#E2E8F0' }, orient: 'vertical', right: 10, top: 'center' },
    series: [
      {
        name: 'Inventory Value',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: '#12121A', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 20, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: inventoryData?.map((d: any) => ({ value: d.value, name: d.category })) || []
      }
    ]
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Reporting & Analytics</Title>
          <Text className="page-subtitle">Insights into sales, inventory, and finance</Text>
        </div>
        <Space>
          <Select value={reportType} onChange={(v: any) => setReportType(v)} style={{ width: 150 }}>
            <Option value="sales">Sales & Revenue</Option>
            <Option value="inventory">Inventory Position</Option>
          </Select>
          <RangePicker />
          <Button icon={<ReloadOutlined />} />
          <Button icon={<DownloadOutlined />} onClick={handleExportXLSX}>XLSX</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportPDF} type="primary">PDF</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card className="stat-card" loading={reportType === 'sales' ? isSalesLoading : isInvLoading}>
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
          <Card className="stat-card" title={<Text style={{ color: '#E2E8F0' }}>Data Details</Text>}>
            <Table
              dataSource={reportType === 'sales' ? salesData : inventoryData}
              rowKey={reportType === 'sales' ? 'date' : 'category'}
              size="small"
              pagination={{ pageSize: 10 }}
              columns={
                reportType === 'sales' 
                ? [
                    { title: 'Date', dataIndex: 'date' },
                    { title: 'Transactions', dataIndex: 'transactions', align: 'right' },
                    { title: 'Revenue', dataIndex: 'revenue', align: 'right', render: v => `Rp ${v.toLocaleString()}` }
                  ]
                : [
                    { title: 'Category', dataIndex: 'category' },
                    { title: 'Value', dataIndex: 'value', align: 'right', render: v => `Rp ${v.toLocaleString()}` }
                  ]
              }
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
