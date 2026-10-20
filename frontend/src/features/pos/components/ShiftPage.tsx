import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Button, Typography, Space, Tag, Statistic,
  Table, Modal, Form, InputNumber, Descriptions, message, Select,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlayCircleOutlined, CloseCircleOutlined, BarChartOutlined, ShopOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useOpenShift, useCloseShift, useActiveShift, useShiftTransactions } from '../hooks/usePOS';

const { Title, Text } = Typography;

export const ShiftPage: React.FC = () => {
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);
  const [form] = Form.useForm();
  const selectedBranchId = Form.useWatch('branch_id', form);

  const { data: activeShift } = useActiveShift();
  const openShift = useOpenShift();
  const closeShift = useCloseShift();
  const { data: transactions } = useShiftTransactions(activeShift?.id);

  const { data: branchData } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/api/v1/organization/branches').then((r) => r.data),
  });
  const { data: warehouseData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/api/v1/warehouses').then((r) => r.data),
  });

  const branches: any[] = React.useMemo(
    () => (Array.isArray(branchData?.data) ? branchData.data : Array.isArray(branchData) ? branchData : []),
    [branchData]
  );
  const warehouses: any[] = React.useMemo(
    () => (Array.isArray(warehouseData?.data) ? warehouseData.data : Array.isArray(warehouseData) ? warehouseData : []),
    [warehouseData]
  );

  useEffect(() => {
    if (openModal && branches.length > 0 && !form.getFieldValue('branch_id')) {
      const firstBranch = branches[0];
      const matchingWh = warehouses.find((w: any) => w.branch_id === firstBranch.id) || warehouses[0];
      form.setFieldsValue({
        branch_id: firstBranch.id,
        warehouse_id: matchingWh?.id,
      });
    }
  }, [openModal, branches, warehouses, form]);

  const handleOpenShift = async () => {
    try {
      const values = await form.validateFields();
      await openShift.mutateAsync({
        opening_balance: values.opening_balance,
        branch_id: values.branch_id,
        warehouse_id: values.warehouse_id,
      });
      message.success('Shift opened successfully!');
      setOpenModal(false);
      form.resetFields();
    } catch (_) {}
  };

  const handleCloseShift = async () => {
    try {
      const values = await form.validateFields();
      await closeShift.mutateAsync({
        shift_id: activeShift!.id,
        closing_balance: values.closing_balance,
      });
      message.success('Shift closed. Report generated.');
      setCloseModal(false);
    } catch (_) {}
  };

  const txColumns: ColumnsType<any> = [
    { title: 'Transaction #', dataIndex: 'transaction_number', width: 170, render: (v) => <Text code style={{ color: '#F05328' }}>{v}</Text> },
    { title: 'Time', dataIndex: 'transaction_date', width: 100, render: (d) => new Date(d).toLocaleTimeString('id-ID') },
    { title: 'Items', dataIndex: 'lines', width: 70, render: (l) => l?.length ?? 0 },
    {
      title: 'Payment Method',
      dataIndex: 'payments',
      width: 140,
      render: (payments: any[]) => {
        if (!payments || payments.length === 0) return <Tag>CASH</Tag>;
        return (
          <Space orientation="horizontal" size={4} wrap>
            {payments.map((p, idx) => {
              const type = p.payment_method?.type || p.method || 'CASH';
              const color = type === 'CASH' ? 'green' : type === 'CARD' ? 'blue' : 'orange';
              return <Tag color={color} key={idx}>{type}</Tag>;
            })}
          </Space>
        );
      }
    },
    { title: 'Total', dataIndex: 'total_amount', align: 'right', width: 140, render: (v) => <Text className="number-display" style={{ color: '#34D399', fontWeight: 600 }}>Rp {v?.toLocaleString('id-ID')}</Text> },
    { title: 'Status', dataIndex: 'status', width: 100, render: (s) => <Tag color={s === 'COMPLETED' ? 'green' : s === 'VOIDED' ? 'red' : 'orange'}>{s}</Tag> },
  ];

  const completedTxs = transactions?.data?.filter((t: any) => t.status === 'COMPLETED') ?? [];
  const totalSales = completedTxs.reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0);

  // Cash sales calculation strictly for physical drawer cash:
  // ONLY counts payments with payment_method.type === 'CASH' (minus change_amount)
  const cashSales = completedTxs.reduce((sum: number, t: any) => {
    if (Array.isArray(t.payments) && t.payments.length > 0) {
      const txCash = t.payments
        .filter((p: any) => (p.payment_method?.type === 'CASH' || p.method === 'CASH'))
        .reduce((pSum: number, p: any) => pSum + Number(p.amount || 0), 0);
      const txChange = Number(t.change_amount || 0);
      return sum + Math.max(0, txCash - txChange);
    }
    // Fallback: if no payments array, check transaction level property
    if (t.payment_method === 'CASH' || t.payment_type === 'CASH' || !t.payment_method) {
      return sum + (t.total_amount || 0);
    }
    return sum;
  }, 0);

  const nonCashSales = Math.max(0, totalSales - cashSales);
  const openingBalance = Number(activeShift?.opening_balance || 0);
  const expectedCashInDrawer = openingBalance + cashSales;

  const activeBranchName =
    activeShift?.branch?.name ||
    branches.find((b: any) => b.id === activeShift?.branch_id)?.name ||
    activeShift?.branch_id ||
    'Main Branch';

  const activeWarehouseName =
    activeShift?.warehouse?.name ||
    warehouses.find((w: any) => w.id === activeShift?.warehouse_id)?.name ||
    activeShift?.warehouse_id ||
    'Main Store Warehouse';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>Shift Management</Title>
          <Text className="page-subtitle">Open or close your cashier shift</Text>
        </div>
        {!activeShift ? (
          <Button type="primary" icon={<PlayCircleOutlined />} size="large" onClick={() => setOpenModal(true)}>
            Open Shift
          </Button>
        ) : (
          <Space>
            <Button
              icon={<BarChartOutlined />}
              style={{ color: '#F05328' }}
              onClick={() => setReportModal(true)}
            >
              View Report
            </Button>
            <Button danger icon={<CloseCircleOutlined />} onClick={() => setCloseModal(true)}>
              Close Shift
            </Button>
          </Space>
        )}
      </div>

      {!activeShift ? (
        <Card className="stat-card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🕐</div>
          <Title level={4} style={{ }}>No Active Shift</Title>
          <Text style={{ display: 'block', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Open a shift to start processing POS transactions. You must record your opening cash balance.
          </Text>
          <Button type="primary" icon={<PlayCircleOutlined />} size="large" onClick={() => setOpenModal(true)}>
            Open Shift Now
          </Button>
        </Card>
      ) : (
        <>
          {/* Active Shift Header Meta */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <Tag color="volcano" style={{ borderRadius: 6, fontWeight: 600 }}>
              Shift #{activeShift.shift_number || (typeof activeShift.id === 'string' ? activeShift.id.slice(0, 8) : '')}
            </Tag>
            <Tag icon={<ShopOutlined />} color="blue" style={{ borderRadius: 6 }}>
              Cabang: {activeBranchName}
            </Tag>
            <Tag icon={<DatabaseOutlined />} color="orange" style={{ borderRadius: 6 }}>
              Gudang: {activeWarehouseName}
            </Tag>
            <Tag color="green" style={{ borderRadius: 6 }}>
              Mulai: {activeShift?.opened_at ? new Date(activeShift.opened_at).toLocaleTimeString('id-ID') : '—'}
            </Tag>
          </div>

          {/* Active shift stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title={<Text style={{ }}>Opening Balance</Text>}
                  value={openingBalance}
                  prefix="Rp"
                  formatter={(v) => (v as number).toLocaleString('id-ID')}
                  styles={{ content: { color: '#64748B' } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title={<Text style={{ }}>Cash Sales (In Drawer)</Text>}
                  value={cashSales}
                  prefix="Rp"
                  formatter={(v) => (v as number).toLocaleString('id-ID')}
                  styles={{ content: { color: '#34D399', fontWeight: 600 } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title={<Text style={{ }}>Expected Cash in Drawer</Text>}
                  value={expectedCashInDrawer}
                  prefix="Rp"
                  formatter={(v) => (v as number).toLocaleString('id-ID')}
                  styles={{ content: { color: '#F05328', fontWeight: 700 } }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title={<Text style={{ }}>Total Sales (Cash + Non-Cash)</Text>}
                  value={totalSales}
                  prefix="Rp"
                  formatter={(v) => (v as number).toLocaleString('id-ID')}
                  styles={{ content: { color: '#3B82F6' } }}
                />
              </Card>
            </Col>
          </Row>

          {/* Transaction list */}
          <Card className="stat-card" title={<Text style={{ fontWeight: 600 }}>Today's Transactions</Text>}>
            <Table
              columns={txColumns}
              dataSource={transactions?.data ?? []}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 750 }}
              size="small"
            />
          </Card>
        </>
      )}

      {/* Open Shift Modal */}
      <Modal
        title="Open New Shift"
        open={openModal}
        onCancel={() => setOpenModal(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="branch_id"
            label="Cabang Operasional (Branch)"
            rules={[{ required: true, message: 'Pilih cabang operasional' }]}
          >
            <Select
              placeholder="Pilih Cabang..."
              showSearch
              optionFilterProp="children"
              onChange={() => {
                form.setFieldValue('warehouse_id', undefined);
              }}
            >
              {branches.map((b: any) => (
                <Select.Option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="warehouse_id"
            label="Gudang Kasir (Warehouse)"
            rules={[{ required: true, message: 'Pilih gudang kasir' }]}
          >
            <Select
              placeholder="Pilih Gudang..."
              showSearch
              optionFilterProp="children"
            >
              {warehouses
                .filter((w: any) => !selectedBranchId || w.branch_id === selectedBranchId)
                .map((w: any) => (
                  <Select.Option key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="opening_balance"
            label="Opening Cash Balance (Rp)"
            rules={[{ required: true, message: 'Enter opening balance' }]}
          >
            <InputNumber
              size="large"
              style={{ width: '100%' }}
              min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              placeholder="e.g. 1,000,000"
            />
          </Form.Item>

          <Button
            type="primary"
            block
            size="large"
            loading={openShift.isPending}
            onClick={handleOpenShift}
          >
            Open Shift
          </Button>
        </Form>
      </Modal>

      {/* Close Shift Modal */}
      <Modal
        title="Close Shift"
        open={closeModal}
        onCancel={() => setCloseModal(false)}
        footer={null}
        destroyOnHidden
      >
        <Card className="stat-card" style={{ marginBottom: 16 }}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Opening Balance (Kas Awal)">
              <Text className="number-display">Rp {openingBalance.toLocaleString('id-ID')}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Total Penjualan Tunai (Cash Sales)">
              <Text className="number-display" style={{ color: '#34D399', fontWeight: 600 }}>
                Rp {cashSales.toLocaleString('id-ID')}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Penjualan Non-Tunai (EDC & Transfer)">
              <Text className="number-display" style={{ color: '#64748B' }}>
                Rp {nonCashSales.toLocaleString('id-ID')}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="Total Seluruh Penjualan">
              <Text className="number-display">Rp {totalSales.toLocaleString('id-ID')}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Estimasi Fisik Kas di Laci (Expected Cash)">
              <Text className="number-display" style={{ color: '#F05328', fontWeight: 700, fontSize: 16 }}>
                Rp {expectedCashInDrawer.toLocaleString('id-ID')}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <Form form={form} layout="vertical">
          <Form.Item
            name="closing_balance"
            label="Actual Cash Count (Uang Fisik Kasir di Laci) (Rp)"
            rules={[{ required: true, message: 'Masukkan hasil hitungan fisik kas di laci' }]}
            help="Hitung fisik uang tunai di laci kasir, tidak termasuk struk EDC atau bukti transfer"
          >
            <InputNumber
              size="large"
              style={{ width: '100%' }}
              min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              placeholder="Masukkan jumlah kas fisik..."
            />
          </Form.Item>
          <Button
            danger
            block
            size="large"
            loading={closeShift.isPending}
            onClick={handleCloseShift}
          >
            Close Shift
          </Button>
        </Form>
      </Modal>

      {/* Shift Report Modal */}
      <Modal
        title="Active Shift Report Summary"
        open={reportModal}
        onCancel={() => setReportModal(false)}
        footer={<Button type="primary" onClick={() => setReportModal(false)}>Done</Button>}
        destroyOnHidden
      >
        <Descriptions bordered size="small" column={1} style={{ marginTop: 12 }}>
          <Descriptions.Item label="Cashier Shift ID">
            <Text code>{activeShift?.id || '—'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Cabang (Branch)">
            <Text strong>{activeBranchName}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Gudang Kasir (Warehouse)">
            <Text strong>{activeWarehouseName}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Opened At">
            {activeShift?.opened_at ? new Date(activeShift.opened_at).toLocaleString('id-ID') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Opening Cash Balance">
            <Text strong>Rp {openingBalance.toLocaleString('id-ID')}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Cash Sales (Masuk Laci Kasir)">
            <Text strong style={{ color: '#34D399' }}>Rp {cashSales.toLocaleString('id-ID')}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Non-Cash Sales (EDC & Transfer)">
            <Text strong style={{ color: '#64748B' }}>Rp {nonCashSales.toLocaleString('id-ID')}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Total Sales Processed">
            <Text strong>Rp {totalSales.toLocaleString('id-ID')}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Completed Transactions">
            {completedTxs.length} orders
          </Descriptions.Item>
          <Descriptions.Item label="Expected Physical Cash in Drawer">
            <Text strong style={{ color: '#F05328', fontSize: 16 }}>
              Rp {expectedCashInDrawer.toLocaleString('id-ID')}
            </Text>
          </Descriptions.Item>
        </Descriptions>
      </Modal>
    </div>
  );
};
