import React, { useState } from 'react';
import { Row, Col, Card, Typography, Select, Button, Space, DatePicker, message, Table, Statistic } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  useExecutiveDashboard, 
  useInventoryPosition, 
  useIncomeStatement,
  useBalanceSheet,
  useCashFlow,
  useARAging,
  useAPAging
} from '../hooks/useReporting';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export type ReportType = 'sales' | 'inventory' | 'income_statement' | 'balance_sheet' | 'cash_flow' | 'ar_aging' | 'ap_aging';

export const ReportingPage: React.FC = () => {
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [asOfDate, setAsOfDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  
  const { data: execData, isLoading: isExecLoading, refetch: refetchExec } = useExecutiveDashboard(asOfDate, { enabled: reportType === 'sales' });
  const { data: invData, isLoading: isInvLoading, refetch: refetchInv } = useInventoryPosition(asOfDate, { enabled: reportType === 'inventory' });
  const { data: incomeData, isLoading: isIncomeLoading, refetch: refetchIncome } = useIncomeStatement('', { enabled: reportType === 'income_statement' });
  const { data: balanceData, isLoading: isBalanceLoading, refetch: refetchBalance } = useBalanceSheet(asOfDate, { enabled: reportType === 'balance_sheet' });
  const { data: cashFlowData, isLoading: isCashFlowLoading, refetch: refetchCashFlow } = useCashFlow('', { enabled: reportType === 'cash_flow' });
  const { data: arAgingData, isLoading: isArLoading, refetch: refetchAr } = useARAging(asOfDate, { enabled: reportType === 'ar_aging' });
  const { data: apAgingData, isLoading: isApLoading, refetch: refetchAp } = useAPAging(asOfDate, { enabled: reportType === 'ap_aging' });

  const refetchAll = () => {
    refetchExec();
    refetchInv();
    refetchIncome();
    refetchBalance();
    refetchCashFlow();
    refetchAr();
    refetchAp();
  };

  const isLoading = isExecLoading || isInvLoading || isIncomeLoading || isBalanceLoading || isCashFlowLoading || isArLoading || isApLoading;

  const handleExportXLSX = () => {
    try {
      let exportData: any[] = [];
      let sheetName = 'Report';

      if (reportType === 'sales') {
        exportData = execData?.top_products || [];
        sheetName = 'Top Products';
      } else if (reportType === 'inventory') {
        exportData = invData?.items || [];
        sheetName = 'Inventory Position';
      } else if (reportType === 'ar_aging') {
        exportData = arAgingData?.buckets || [];
        sheetName = 'AR Aging';
      } else if (reportType === 'ap_aging') {
        exportData = apAgingData?.buckets || [];
        sheetName = 'AP Aging';
      } else if (reportType === 'balance_sheet') {
        exportData = [
          { Category: 'Total Assets', Amount: balanceData?.total_assets || 0 },
          { Category: 'Total Liabilities', Amount: balanceData?.total_liabilities || 0 },
          { Category: 'Total Equity', Amount: balanceData?.total_equity || 0 },
        ];
        sheetName = 'Balance Sheet';
      } else if (reportType === 'income_statement') {
        exportData = [
          { Category: 'Revenue', Amount: incomeData?.revenue || 0 },
          { Category: 'COGS', Amount: incomeData?.cogs || 0 },
          { Category: 'Gross Profit', Amount: incomeData?.gross_profit || 0 },
          { Category: 'Operating Expenses', Amount: incomeData?.operating_expenses || 0 },
          { Category: 'Net Income', Amount: incomeData?.net_income || 0 },
        ];
        sheetName = 'Income Statement';
      } else if (reportType === 'cash_flow') {
        exportData = cashFlowData?.operating_activities?.items || [];
        sheetName = 'Cash Flow';
      }

      if (!exportData.length) return message.warning('No data to export');
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${sheetName}_${Date.now()}.xlsx`);
      message.success('Exported to XLSX');
    } catch (e) {
      message.error('Failed to export XLSX');
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.text(`Kiro ERP - ${reportType.toUpperCase()} Report`, 14, 15);
      doc.text(`As of: ${asOfDate}`, 14, 22);

      if (reportType === 'sales') {
        if (!execData?.top_products?.length) return message.warning('No data to export');
        const columns = ['Product Name', 'Total Qty', 'Total Revenue (Rp)'];
        const rows = execData.top_products.map((r: any) => [
          r.product_name, 
          r.total_qty, 
          Number(r.total_revenue).toLocaleString()
        ]);
        autoTable(doc, { head: [columns], body: rows, startY: 28 });
      } else if (reportType === 'inventory') {
        if (!invData?.items?.length) return message.warning('No data to export');
        const columns = ['Code', 'Name', 'Warehouse', 'Qty On Hand', 'Avg Cost', 'Total Value'];
        const rows = invData.items.map((r: any) => [
          r.product_code,
          r.product_name,
          r.warehouse_name,
          r.qty_on_hand,
          Number(r.average_cost).toLocaleString(),
          Number(r.total_value).toLocaleString()
        ]);
        autoTable(doc, { head: [columns], body: rows, startY: 28 });
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
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Reporting & Analytics Hub</Title>
          <Text className="page-subtitle">Standardized financial, inventory, and sales intelligence</Text>
        </div>
        <Space wrap>
          <Select value={reportType} onChange={setReportType} style={{ width: 220 }}>
            <Option value="sales">Executive Dashboard</Option>
            <Option value="inventory">Inventory Position</Option>
            <Option value="balance_sheet">Balance Sheet (Neraca)</Option>
            <Option value="income_statement">Income Statement (P&L)</Option>
            <Option value="cash_flow">Cash Flow Statement</Option>
            <Option value="ar_aging">AR Aging Report</Option>
            <Option value="ap_aging">AP Aging Report</Option>
          </Select>
          <DatePicker 
            value={dayjs(asOfDate)} 
            onChange={(_, dateStr) => setAsOfDate(dateStr as string)} 
            allowClear={false}
          />
          <Button icon={<ReloadOutlined />} onClick={refetchAll} />
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

      {reportType === 'balance_sheet' && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card className="stat-card">
              <Statistic title="Total Aset" value={balanceData?.total_assets || 0} prefix="Rp" valueStyle={{ color: '#10B981' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card className="stat-card">
              <Statistic title="Total Liabilitas" value={balanceData?.total_liabilities || 0} prefix="Rp" valueStyle={{ color: '#EF4444' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card className="stat-card">
              <Statistic title="Total Ekuitas" value={balanceData?.total_equity || 0} prefix="Rp" valueStyle={{ color: '#6366F1' }} />
            </Card>
          </Col>
        </Row>
      )}

      {(reportType === 'sales' || reportType === 'inventory') && (
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card 
              className="stat-card" 
              loading={isLoading}
              title={reportType === 'sales' ? "Top 5 Products by Revenue" : "Inventory Value by Warehouse"}
            >
              <ReactECharts
                option={reportType === 'sales' ? salesOption : inventoryOption}
                style={{ height: 350 }}
                opts={{ renderer: 'svg' }}
              />
            </Card>
          </Col>
        </Row>
      )}
      
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card className="stat-card" title={`Detail Laporan: ${reportType.toUpperCase().replace('_', ' ')}`} loading={isLoading}>
            {reportType === 'sales' && (
              <Table
                dataSource={execData?.top_products || []}
                rowKey="product_id"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Product', dataIndex: 'product_name' },
                  { title: 'Total Qty', dataIndex: 'total_qty', align: 'right' },
                  { title: 'Revenue', dataIndex: 'total_revenue', align: 'right', render: (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}` }
                ]}
              />
            )}

            {reportType === 'inventory' && (
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
                  { title: 'Avg Cost', dataIndex: 'average_cost', align: 'right', render: (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}` },
                  { title: 'Total Value', dataIndex: 'total_value', align: 'right', render: (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}` }
                ]}
              />
            )}

            {reportType === 'balance_sheet' && (
              <Table
                dataSource={[
                  { key: 1, category: 'Aset Lancar & Aset Tetap', amount: balanceData?.total_assets || 0 },
                  { key: 2, category: 'Kewajiban / Liabilitas', amount: balanceData?.total_liabilities || 0 },
                  { key: 3, category: 'Modal & Laba Ditahan', amount: balanceData?.total_equity || 0 },
                ]}
                rowKey="key"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Komponen Neraca', dataIndex: 'category' },
                  { title: 'Total Saldo', dataIndex: 'amount', align: 'right', render: (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}` }
                ]}
              />
            )}

            {reportType === 'income_statement' && (
              <Table
                dataSource={[
                  { key: 1, item: 'Pendapatan Usaha (Revenue)', amount: incomeData?.revenue || 0 },
                  { key: 2, item: 'Beban Pokok Penjualan (COGS)', amount: incomeData?.cogs || 0 },
                  { key: 3, item: 'Laba Kotor (Gross Profit)', amount: incomeData?.gross_profit || 0 },
                  { key: 4, item: 'Beban Operasional', amount: incomeData?.operating_expenses || 0 },
                  { key: 5, item: 'Laba Bersih (Net Income)', amount: incomeData?.net_income || 0 },
                ]}
                rowKey="key"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Pos Laba Rugi', dataIndex: 'item' },
                  { title: 'Jumlah', dataIndex: 'amount', align: 'right', render: (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}` }
                ]}
              />
            )}

            {reportType === 'cash_flow' && (
              <Table
                dataSource={cashFlowData?.operating_activities?.items || []}
                rowKey={(r: any) => r.account_name}
                size="small"
                pagination={false}
                columns={[
                  { title: 'Akun Kas / Bank', dataIndex: 'account_name' },
                  { title: 'Arus Masuk (Inflow)', dataIndex: 'inflow', align: 'right', render: (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}` },
                  { title: 'Arus Keluar (Outflow)', dataIndex: 'outflow', align: 'right', render: (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}` },
                  { title: 'Net Cash Flow', dataIndex: 'net_flow', align: 'right', render: (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}` }
                ]}
              />
            )}

            {reportType === 'ar_aging' && (
              <Table
                dataSource={arAgingData?.buckets || []}
                rowKey="label"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Kategori Aging', dataIndex: 'label' },
                  { title: 'Jumlah Faktur', dataIndex: 'count', align: 'right' },
                  { title: 'Total Piutang', dataIndex: 'amount', align: 'right', render: (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}` }
                ]}
              />
            )}

            {reportType === 'ap_aging' && (
              <Table
                dataSource={apAgingData?.buckets || []}
                rowKey="label"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Kategori Aging', dataIndex: 'label' },
                  { title: 'Jumlah Faktur', dataIndex: 'count', align: 'right' },
                  { title: 'Total Utang', dataIndex: 'amount', align: 'right', render: (v: number) => `Rp ${Number(v || 0).toLocaleString('id-ID')}` }
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
