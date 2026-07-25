import React, { useState } from 'react';
import {
  Card, Row, Col, Button, Typography, Space, Tag, Statistic,
  Table, Modal, Form, InputNumber, Descriptions, Badge, Divider, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlayCircleOutlined, PauseCircleOutlined, BarChartOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useOpenShift, useCloseShift, useActiveShift, useShiftTransactions } from '../hooks/usePOS';

const { Title, Text } = Typography;

export const ShiftPage: React.FC = () => {
  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [form] = Form.useForm();

  const { data: activeShift, isLoading } = useActiveShift();
  const openShift = useOpenShift();
  const closeShift = useCloseShift();
  const { data: transactions } = useShiftTransactions(activeShift?.id);

  const handleOpenShift = async () => {
    try {
      const values = await form.validateFields();
      await openShift.mutateAsync({ opening_balance: values.opening_balance });
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
    { title: 'Transaction #', dataIndex: 'transaction_number', width: 180, render: (v) => <Text code style={{ color: '#A78BFA' }}>{v}</Text> },
    { title: 'Time', dataIndex: 'transaction_date', width: 120, render: (d) => new Date(d).toLocaleTimeString('id-ID') },
    { title: 'Items', dataIndex: 'lines', width: 80, render: (l) => l?.length ?? 0 },
    { title: 'Total', dataIndex: 'total_amount', align: 'right', width: 160, render: (v) => <Text className="number-display" style={{ color: '#34D399', fontWeight: 600 }}>Rp {v?.toLocaleString('id-ID')}</Text> },
    { title: 'Status', dataIndex: 'status', width: 110, render: (s) => <Tag color={s === 'COMPLETED' ? 'green' : s === 'VOIDED' ? 'red' : 'orange'}>{s}</Tag> },
  ];

  const totalSales = transactions?.data?.filter((t: any) => t.status === 'COMPLETED').reduce((sum: number, t: any) => sum + (t.total_amount || 0), 0) ?? 0;

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
            <Button icon={<BarChartOutlined />} style={{ color: '#8B5CF6' }}>View Report</Button>
            <Button danger icon={<CloseCircleOutlined />} onClick={() => setCloseModal(true)}>
              Close Shift
            </Button>
          </Space>
        )}
      </div>

      {!activeShift ? (
        <Card className="stat-card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🕐</div>
          <Title level={4} style={{ color: '#E2E8F0' }}>No Active Shift</Title>
          <Text style={{ color: '#64748B', display: 'block', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
            Open a shift to start processing POS transactions. You must record your opening cash balance.
          </Text>
          <Button type="primary" icon={<PlayCircleOutlined />} size="large" onClick={() => setOpenModal(true)}>
            Open Shift Now
          </Button>
        </Card>
      ) : (
        <>
          {/* Active shift stats */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title={<Text style={{ color: '#64748B' }}>Opening Balance</Text>}
                  value={activeShift.opening_balance}
                  prefix="Rp"
                  formatter={(v) => (v as number).toLocaleString('id-ID')}
                  valueStyle={{ color: '#8B5CF6' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title={<Text style={{ color: '#64748B' }}>Total Sales (Today)</Text>}
                  value={totalSales}
                  prefix="Rp"
                  formatter={(v) => (v as number).toLocaleString('id-ID')}
                  valueStyle={{ color: '#34D399' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title={<Text style={{ color: '#64748B' }}>Transactions</Text>}
                  value={transactions?.data?.filter((t: any) => t.status === 'COMPLETED').length ?? 0}
                  valueStyle={{ color: '#E2E8F0' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="stat-card">
                <Statistic
                  title={<Text style={{ color: '#64748B' }}>Shift Duration</Text>}
                  value={Math.floor((Date.now() - new Date(activeShift.opened_at).getTime()) / 3600000)}
                  suffix="hours"
                  valueStyle={{ color: '#FBBF24' }}
                />
              </Card>
            </Col>
          </Row>

          {/* Transaction list */}
          <Card className="stat-card" title={<Text style={{ color: '#E2E8F0', fontWeight: 600 }}>Today's Transactions</Text>}>
            <Table
              columns={txColumns}
              dataSource={transactions?.data ?? []}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 700 }}
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
      >
        <Form form={form} layout="vertical">
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
      >
        <Card className="stat-card" style={{ marginBottom: 16 }}>
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Opening Balance">
              <Text className="number-display">Rp {activeShift?.opening_balance?.toLocaleString('id-ID')}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Total Sales">
              <Text className="number-display" style={{ color: '#34D399' }}>Rp {totalSales.toLocaleString('id-ID')}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Expected Closing">
              <Text className="number-display" style={{ color: '#8B5CF6', fontWeight: 600 }}>
                Rp {((activeShift?.opening_balance || 0) + totalSales).toLocaleString('id-ID')}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
        <Form form={form} layout="vertical">
          <Form.Item
            name="closing_balance"
            label="Actual Cash Count (Rp)"
            rules={[{ required: true }]}
          >
            <InputNumber
              size="large"
              style={{ width: '100%' }}
              min={0}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
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
    </div>
  );
};
