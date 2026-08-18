import React, { useState } from 'react';
import { Modal, Form, Input, Button, Table, InputNumber, DatePicker, message, Row, Col, Typography, Select, Space } from 'antd';
import { PlusOutlined, DeleteOutlined, BookOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useCreateJournalEntry } from '../hooks/useFinance';
import type { JournalEntryLine } from '../types/finance.types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_COA_ACCOUNTS = [
  { value: '1001-CASH', label: '1001-CASH — Kas & Setara Kas' },
  { value: '1002-BANK', label: '1002-BANK — Rekening Bank Utama' },
  { value: '1100-AR',   label: '1100-AR — Piutang Usaha (Accounts Receivable)' },
  { value: '1300-INV',  label: '1300-INV — Persediaan Barang Dagangan' },
  { value: '2100-AP',   label: '2100-AP — Hutang Usaha (Accounts Payable)' },
  { value: '3001-EQU',  label: '3001-EQU — Modal / Ekuitas Pemilik' },
  { value: '4001-REV',  label: '4001-REV — Pendapatan Penjualan' },
  { value: '5001-COGS', label: '5001-COGS — Harga Pokok Penjualan (HPP)' },
  { value: '6001-EXP',  label: '6001-EXP — Beban Operasional & Umum' },
];

export const JournalEntryModal: React.FC<JournalEntryModalProps> = ({ isOpen, onClose }) => {
  const [form] = Form.useForm();
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { accountId: '1001-CASH', debit: 0, credit: 0 },
    { accountId: '4001-REV', debit: 0, credit: 0 },
  ]);

  const { mutate, isPending } = useCreateJournalEntry();

  const handleLineChange = (index: number, field: keyof JournalEntryLine, value: string | number) => {
    const newLines = [...lines];
    if (field === 'debit' || field === 'credit') {
      newLines[index][field] = Number(value) || 0;
      // Enforce exclusivity: if setting debit, clear credit and vice versa
      if (Number(value) > 0) {
        if (field === 'debit') newLines[index].credit = 0;
        if (field === 'credit') newLines[index].debit = 0;
      }
    } else {
      newLines[index].accountId = value as string;
    }
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { accountId: '', debit: 0, credit: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 2) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;
  const diff = Math.abs(totalDebit - totalCredit);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!isBalanced) {
        message.error('Journal entry must be balanced (Total Debit = Total Credit)');
        return;
      }

      const hasEmptyAccounts = lines.some(l => !l.accountId);
      if (hasEmptyAccounts) {
        message.error('All lines must have a selected Account ID');
        return;
      }

      mutate({
        date: values.date.format('YYYY-MM-DD'),
        description: values.description,
        lines,
      }, {
        onSuccess: () => {
          message.success('Journal entry posted successfully');
          onClose();
          form.resetFields();
          setLines([
            { accountId: '1001-CASH', debit: 0, credit: 0 },
            { accountId: '4001-REV', debit: 0, credit: 0 },
          ]);
        }
      });
    } catch (_) {}
  };

  const columns = [
    {
      title: 'ACCOUNT ID / NAME',
      key: 'accountId',
      render: (_: any, __: any, index: number) => (
        <Select
          showSearch
          allowClear
          value={lines[index].accountId || undefined}
          placeholder="Select or enter account..."
          onChange={(val) => handleLineChange(index, 'accountId', val || '')}
          style={{ width: '100%', borderRadius: 8 }}
          options={DEFAULT_COA_ACCOUNTS}
        />
      ),
    },
    {
      title: 'DEBIT (RP)',
      key: 'debit',
      width: 170,
      render: (_: any, __: any, index: number) => (
        <InputNumber
          style={{ width: '100%', borderRadius: 8 }}
          min={0}
          value={lines[index].debit}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
          parser={value => value?.replace(/\./g, '') as any}
          onChange={(val) => handleLineChange(index, 'debit', val || 0)}
          disabled={lines[index].credit > 0}
        />
      ),
    },
    {
      title: 'CREDIT (RP)',
      key: 'credit',
      width: 170,
      render: (_: any, __: any, index: number) => (
        <InputNumber
          style={{ width: '100%', borderRadius: 8 }}
          min={0}
          value={lines[index].credit}
          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
          parser={value => value?.replace(/\./g, '') as any}
          onChange={(val) => handleLineChange(index, 'credit', val || 0)}
          disabled={lines[index].debit > 0}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 44,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLine(index)}
          disabled={lines.length <= 2}
        />
      ),
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--brand-50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--brand-600)'
          }}>
            <BookOutlined style={{ fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Manual Journal Entry
            </div>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              Record double-entry ledger transaction with balanced debit & credit values.
            </Text>
          </div>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={isPending}
      width={720}
      okText="Post Entry"
      okButtonProps={{
        disabled: !isBalanced,
        style: { borderRadius: 8, fontWeight: 700, height: 38, padding: '0 20px', boxShadow: '0 4px 12px var(--brand-glow)' }
      }}
      cancelButtonProps={{ style: { borderRadius: 8 } }}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ date: dayjs() }} style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="date"
              label="Transaction Date"
              rules={[{ required: true, message: 'Required' }]}
            >
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item
              name="description"
              label="Transaction Description / Memo"
              rules={[{ required: true, message: 'Required' }]}
            >
              <Input placeholder="e.g. Sales revenue deposit, Operational expense..." style={{ borderRadius: 8 }} />
            </Form.Item>
          </Col>
        </Row>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
          marginBottom: 12
        }}>
          <Text style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
            Journal Lines ({lines.length})
          </Text>
          <Button
            type="dashed"
            onClick={addLine}
            icon={<PlusOutlined />}
            style={{ borderRadius: 8, fontSize: 13, fontWeight: 600 }}
          >
            Add Line Item
          </Button>
        </div>

        <Table
          dataSource={lines.map((l, i) => ({ ...l, key: i }))}
          columns={columns}
          rowKey="key"
          pagination={false}
          size="middle"
          style={{ background: 'var(--solid-bg)', borderRadius: 12, overflow: 'hidden' }}
        />

        {/* Balance Status Banner */}
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          borderRadius: 12,
          background: isBalanced ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${isBalanced ? 'var(--success-border)' : 'var(--danger-border)'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isBalanced ? (
              <CheckCircleOutlined style={{ color: 'var(--success)', fontSize: 16 }} />
            ) : (
              <WarningOutlined style={{ color: 'var(--danger)', fontSize: 16 }} />
            )}
            <span style={{
              fontSize: 13,
              fontWeight: 700,
              color: isBalanced ? 'var(--success)' : 'var(--danger)'
            }}>
              {isBalanced
                ? 'Balanced Journal Entry (Debit = Credit)'
                : `Unbalanced Entry — Difference: Rp ${diff.toLocaleString('id-ID')}`
              }
            </span>
          </div>

          <Space size="large">
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Debit: <strong style={{ color: 'var(--text-primary)' }}>Rp {totalDebit.toLocaleString('id-ID')}</strong>
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Credit: <strong style={{ color: 'var(--text-primary)' }}>Rp {totalCredit.toLocaleString('id-ID')}</strong>
            </span>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default JournalEntryModal;
