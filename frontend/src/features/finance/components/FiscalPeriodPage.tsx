import React, { useState } from 'react';
import {
  Table, Typography, Button, Space, Tag, Modal, Form, Input, DatePicker, message, Card
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusOutlined, LockOutlined, CheckCircleOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import { api } from '../../../lib/api';
import dayjs from 'dayjs';
import { useAuthStore } from '../../../store/authStore';

const { Title, Text } = Typography;

export const FiscalPeriodPage: React.FC = () => {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<any>(null);
  const [form] = Form.useForm();

  // Queries
  const { data: periods, isLoading } = useQuery({
    queryKey: ['fiscal-periods'],
    queryFn: () => api.get('/api/v1/accounting/period').then(r => r.data)
  });

  const { data: checklist, isLoading: checklistLoading } = useQuery({
    queryKey: ['fiscal-period-checklist', selectedPeriod?.id],
    queryFn: () => api.get(`/api/v1/accounting/period/${selectedPeriod.id}/checklist`).then(r => r.data),
    enabled: !!selectedPeriod && isChecklistModalOpen
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (values: any) => api.post('/api/v1/accounting/period', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-periods'] });
      setIsModalOpen(false);
      form.resetFields();
      message.success('Fiscal period created successfully');
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to create period')
  });

  const closePeriodMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/accounting/period/${id}/close`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal-periods'] });
      setIsChecklistModalOpen(false);
      message.success('Fiscal period closed successfully');
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to close period')
  });

  const handleSave = () => {
    form.validateFields().then(values => {
      const payload = {
        period_name: values.period_name,
        year: values.year,
        month: values.month,
        start_date: values.date_range[0].toISOString(),
        end_date: values.date_range[1].toISOString(),
      };
      createMutation.mutate(payload);
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'orange';
      case 'OPEN': return 'green';
      case 'CLOSED': return 'red';
      default: return 'default';
    }
  };

  const columns = [
    { title: 'Period Name', dataIndex: 'period_name' },
    { title: 'Year', dataIndex: 'year' },
    { title: 'Month', dataIndex: 'month' },
    { 
      title: 'Start Date', 
      dataIndex: 'start_date', 
      render: (v: string) => dayjs(v).format('DD MMM YYYY') 
    },
    { 
      title: 'End Date', 
      dataIndex: 'end_date', 
      render: (v: string) => dayjs(v).format('DD MMM YYYY') 
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      render: (status: string) => <Tag color={getStatusColor(status)}>{status}</Tag> 
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => {
        const canClosePeriod = user?.role === 'admin' || user?.role === 'manager';
        return (
          <Space>
            {record.status === 'OPEN' && canClosePeriod && (
              <Button 
                icon={<LockOutlined />} 
                onClick={() => {
                  setSelectedPeriod(record);
                  setIsChecklistModalOpen(true);
                }} 
                size="small" 
                danger 
              >
                Close Period
              </Button>
            )}
          </Space>
        )
      }
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>Fiscal Periods</Title>
          <Text type="secondary">Manage accounting periods and end-of-month closing</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          New Period
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={periods?.data} 
        rowKey="id" 
        loading={isLoading} 
      />

      <Modal
        title="Create Fiscal Period"
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="period_name" label="Period Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. July 2026" />
          </Form.Item>
          <Space>
            <Form.Item name="year" label="Year" rules={[{ required: true }]}>
              <Input type="number" />
            </Form.Item>
            <Form.Item name="month" label="Month (1-12)" rules={[{ required: true }]}>
              <Input type="number" min={1} max={12} />
            </Form.Item>
          </Space>
          <Form.Item name="date_range" label="Date Range" rules={[{ required: true }]}>
            <DatePicker.RangePicker />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Period Closing Checklist"
        open={isChecklistModalOpen}
        onOk={() => closePeriodMutation.mutate(selectedPeriod.id)}
        onCancel={() => setIsChecklistModalOpen(false)}
        okText="Confirm & Close Period"
        okButtonProps={{ disabled: !checklist?.data?.canClose, danger: true }}
        confirmLoading={closePeriodMutation.isPending}
        width={600}
      >
        {checklistLoading ? (
          <p>Loading checklist...</p>
        ) : checklist?.data ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text>
                Closing period <strong>{selectedPeriod?.period_name}</strong> will lock all transactions within this date range. 
                This action cannot be undone. Please ensure all checklist items are completed.
              </Text>
            </div>
            
            <Card size="small" style={{ marginBottom: 16 }}>
              {Object.entries(checklist.data.items).map(([key, value]: [string, any]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  {value.passed ? (
                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                  ) : (
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                  )}
                  <Text type={value.passed ? 'success' : 'danger'}>{value.message}</Text>
                </div>
              ))}
            </Card>

            {!checklist.data.canClose && (
              <div style={{ color: '#ff4d4f' }}>
                <strong>Cannot close period:</strong> You must resolve all failing checklist items first.
              </div>
            )}
          </div>
        ) : (
          <p>Error loading checklist</p>
        )}
      </Modal>
    </div>
  );
};
