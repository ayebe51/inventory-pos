import React, { useState } from 'react';
import {
  Table, Typography, Button, Input, Tag, Modal, Form, Select, message
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusOutlined, SearchOutlined, BookOutlined
} from '@ant-design/icons';
import { api } from '../../../../lib/api';
import { ActionableEmptyState } from '../../../../components/common/ActionableEmptyState';

const { Text } = Typography;

export const CoaTab: React.FC = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['coa-accounts'],
    queryFn: () => api.get('/api/v1/master-data/coa').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => api.post('/api/v1/master-data/coa', {
      ...values,
      normal_balance: values.account_type === 'EXPENSE' || values.account_type === 'ASSET' ? 'DEBIT' : 'CREDIT'
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['coa-accounts'] });
      message.success('Account Code added to Chart of Accounts');
      setIsModalOpen(false);
      form.resetFields();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to create COA account');
      message.error(detail);
    }
  });

  const rawList = data?.data || (Array.isArray(data) ? data : []);
  const filteredData = rawList.filter((a: any) =>
    a.account_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.account_code?.toLowerCase().includes(search.toLowerCase()) ||
    a.account_type?.toLowerCase().includes(search.toLowerCase())
  );

  const getTypeTag = (type: string) => {
    switch (type) {
      case 'ASSET': return <Tag color="blue">ASSET</Tag>;
      case 'LIABILITY': return <Tag color="orange">LIABILITY</Tag>;
      case 'EQUITY': return <Tag color="gold">EQUITY</Tag>;
      case 'REVENUE': return <Tag color="green">REVENUE</Tag>;
      case 'EXPENSE': return <Tag color="red">EXPENSE</Tag>;
      default: return <Tag>{type}</Tag>;
    }
  };

  const columns = [
    {
      title: 'ACCOUNT CODE',
      dataIndex: 'account_code',
      width: 160,
      render: (t: string) => (
        <span style={{
          padding: '4px 10px',
          background: 'var(--brand-50)',
          color: 'var(--brand-600)',
          border: '1px solid var(--brand-200)',
          borderRadius: 8,
          fontFamily: 'var(--font-mono, monospace)',
          fontWeight: 700,
          fontSize: 12
        }}>
          {t}
        </span>
      )
    },
    {
      title: 'ACCOUNT NAME',
      dataIndex: 'account_name',
      render: (name: string) => <Text style={{ fontWeight: 700, fontSize: 14 }}>{name}</Text>
    },
    {
      title: 'CATEGORY TYPE',
      dataIndex: 'account_type',
      width: 160,
      align: 'center' as const,
      render: (type: string) => getTypeTag(type)
    },
    {
      title: 'NORMAL BALANCE',
      dataIndex: 'normal_balance',
      width: 140,
      align: 'center' as const,
      render: (bal: string) => (
        <span style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontWeight: 600,
          fontSize: 12,
          color: bal === 'DEBIT' ? '#10B981' : '#F59E0B'
        }}>
          {bal}
        </span>
      )
    }
  ];

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 20,
        padding: '16px 20px',
        background: 'var(--solid-bg-subtle)',
        borderRadius: 14,
        border: '1px solid var(--solid-border)'
      }}>
        <Input
          placeholder="Search account code, name, or type..."
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)', marginRight: 6 }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300, borderRadius: 10 }}
          allowClear
          aria-label="Cari kode akun COA"
        />

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { form.resetFields(); setIsModalOpen(true); }}
          style={{
            height: 40,
            padding: '0 20px',
            borderRadius: 10,
            fontWeight: 700,
            boxShadow: '0 4px 12px var(--brand-glow)'
          }}
          aria-label="Tambah Akun COA Baru"
        >
          Add Account
        </Button>
      </div>

      {filteredData.length === 0 && !isLoading ? (
        <ActionableEmptyState
          title="No Accounts in Ledger"
          description="Build Chart of Accounts to organize automated journal vouchers, ledger postings, and financial balance sheets."
          actionLabel="Add Account"
          onAction={() => { form.resetFields(); setIsModalOpen(true); }}
          icon={<BookOutlined />}
        />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 8 }}
          size="middle"
          style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
        />
      )}

      <Modal
        title="Add General Ledger Account (COA)"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnHidden
        width={480}
      >
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)} style={{ marginTop: 16 }}>
          <Form.Item name="account_code" label="Account Code" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. 5101 (Beban Gaji)" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="account_name" label="Account Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Beban Iklan & Promosi" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="account_type" label="Account Type" rules={[{ required: true, message: 'Required' }]}>
            <Select placeholder="Select account type" style={{ borderRadius: 8 }}>
              <Select.Option value="ASSET">ASSET (Harta / Aktiva)</Select.Option>
              <Select.Option value="LIABILITY">LIABILITY (Hutang / Kewajiban)</Select.Option>
              <Select.Option value="EQUITY">EQUITY (Modal / Ekuitas)</Select.Option>
              <Select.Option value="REVENUE">REVENUE (Pendapatan)</Select.Option>
              <Select.Option value="EXPENSE">EXPENSE (Beban Operasional)</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
