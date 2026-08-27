import React, { useState } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, InputNumber, DatePicker, Select, message, Tag, Typography } from 'antd';
import { PlusOutlined, CalculatorOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';

const FixedAssetPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: assets, isLoading } = useQuery({
    queryKey: ['fixedAssets'],
    queryFn: async () => {
      const res = await api.get('/api/v1/accounting/assets');
      return res.data;
    }
  });

  const { data: coaData } = useQuery({
    queryKey: ['coa-accounts'],
    queryFn: () => api.get('/api/v1/master-data/coa').then((r: any) => r.data),
    enabled: isModalOpen,
  });

  const coaList = coaData?.data || [];
  const coaOptions = coaList.map((a: any) => ({
    value: a.id,
    label: `${a.account_code} — ${a.account_name} (${a.account_type})`,
  }));

  const createAssetMutation = useMutation({
    mutationFn: async (values: any) => {
      const res = await api.post('/api/v1/accounting/assets', values);
      return res.data;
    },
    onSuccess: () => {
      message.success('Fixed Asset created successfully');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['fixedAssets'] });
    }
  });

  const runDepreciationMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/v1/accounting/assets/run-depreciation');
      return res.data;
    },
    onSuccess: (data) => {
      message.success(data.message || 'Depreciation run successfully');
      queryClient.invalidateQueries({ queryKey: ['fixedAssets'] });
    }
  });

  const columns = [
    { title: 'Code', dataIndex: 'code', key: 'code' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { 
      title: 'Purchase Price', 
      dataIndex: 'purchase_price', 
      key: 'purchase_price',
      render: (val: string) => `Rp ${Number(val).toLocaleString()}`
    },
    { 
      title: 'Accum. Depr.', 
      dataIndex: 'accumulated_depreciation', 
      key: 'accumulated_depreciation',
      render: (val: string) => `Rp ${Number(val).toLocaleString()}`
    },
    { 
      title: 'Net Book Value', 
      key: 'nbv',
      render: (_: any, record: any) => {
        const pPrice = Number(record.purchase_price);
        const aDep = Number(record.accumulated_depreciation);
        return `Rp ${(pPrice - aDep).toLocaleString()}`;
      }
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => <Tag color={status === 'ACTIVE' ? 'green' : 'red'}>{status}</Tag>
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Typography.Title level={3} className="page-title" style={{ marginBottom: 4 }}>
            Fixed Assets
          </Typography.Title>
          <Typography.Text className="page-subtitle">Manage company assets and depreciation</Typography.Text>
        </div>
        <Space>
          <Button 
            icon={<CalculatorOutlined />} 
            onClick={() => runDepreciationMutation.mutate()}
            loading={runDepreciationMutation.isPending}
          >
            Run Depreciation
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setIsModalOpen(true)}
          >
            New Asset
          </Button>
        </Space>
      </div>

      <Card className="stat-card" bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={assets}
          loading={isLoading}
          pagination={{ pageSize: 15 }}
        />
      </Card>

      <Modal
        title="Register New Asset"
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createAssetMutation.isPending}
      >
        <Form form={form} layout="vertical" onFinish={(val) => createAssetMutation.mutate(val)}>
          <Form.Item name="code" label="Asset Code" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Asset Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="purchase_date" label="Purchase Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="purchase_price" label="Purchase Price" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="salvage_value" label="Salvage Value (Nilai Sisa)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="useful_life_months" label="Useful Life (Months)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item name="asset_account_id" label="Asset Account" rules={[{ required: true }]}>
            <Select showSearch allowClear options={coaOptions} placeholder="Select Asset Account" />
          </Form.Item>
          <Form.Item name="depreciation_expense_account_id" label="Depreciation Expense Account" rules={[{ required: true }]}>
            <Select showSearch allowClear options={coaOptions} placeholder="Select Depreciation Expense Account" />
          </Form.Item>
          <Form.Item name="accum_depreciation_account_id" label="Accumulated Depreciation Account" rules={[{ required: true }]}>
            <Select showSearch allowClear options={coaOptions} placeholder="Select Accumulated Depreciation Account" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FixedAssetPage;
