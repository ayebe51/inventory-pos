import React from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker, message, Row, Col, Typography } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useCreateJournalEntry } from '../hooks/useFinance';
import dayjs from 'dayjs';

const { Text } = Typography;

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_EXPENSE_CATEGORIES = [
  { value: '6001-EXP', label: 'Beban Operasional & Umum (General Operational Expense)' },
  { value: '6002-RENT', label: 'Beban Sewa Gedung & Kantor (Office Rent Expense)' },
  { value: '6003-UTIL', label: 'Beban Listrik, Air & Internet (Utilities & Internet)' },
  { value: '6004-SALARY', label: 'Beban Gaji & Tunjangan Karyawan (Payroll Expense)' },
  { value: '6005-LOGISTIC', label: 'Beban Kurir & Logistik (Shipping & Logistics)' },
  { value: '6006-MAINT', label: 'Beban Pemeliharaan & Perbaikan (Maintenance Expense)' },
];

const DEFAULT_PAYMENT_SOURCES = [
  { value: '1001-CASH', label: '1001-CASH — Kas Tunai (Cash in Hand)' },
  { value: '1002-BANK', label: '1002-BANK — Rekening Bank Utama' },
];

export const RecordExpenseModal: React.FC<RecordExpenseModalProps> = ({ isOpen, onClose }) => {
  const [form] = Form.useForm();
  const { mutate, isPending } = useCreateJournalEntry();

  const { data: coaData } = useQuery({
    queryKey: ['coa-accounts'],
    queryFn: () => api.get('/api/v1/master-data/coa').then((r: any) => r.data),
    enabled: isOpen,
  });

  const coaList = coaData?.data || [];
  const dynamicExpenses = coaList
    .filter((a: any) => a.account_type === 'EXPENSE' || a.account_type === 'COGS')
    .map((a: any) => ({ value: a.id, label: `${a.account_code} — ${a.account_name}` }));

  const dynamicSources = coaList
    .filter((a: any) => a.account_type === 'ASSET' && (a.account_code?.startsWith('1') || a.account_name?.toLowerCase().includes('kas') || a.account_name?.toLowerCase().includes('bank')))
    .map((a: any) => ({ value: a.id, label: `${a.account_code} — ${a.account_name}` }));

  const expenseOptions = dynamicExpenses.length > 0 ? dynamicExpenses : DEFAULT_EXPENSE_CATEGORIES;
  const paymentSourceOptions = dynamicSources.length > 0 ? dynamicSources : DEFAULT_PAYMENT_SOURCES;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const amount = Number(values.amount) || 0;

      if (amount <= 0) {
        message.error('Expense amount must be greater than Rp 0');
        return;
      }

      mutate({
        date: values.date.format('YYYY-MM-DD'),
        description: `Beban Operasional: ${values.description}`,
        lines: [
          { accountId: values.expense_account, debit: amount, credit: 0 },
          { accountId: values.payment_source, debit: 0, credit: amount },
        ],
      }, {
        onSuccess: () => {
          message.success('Expense recorded successfully');
          onClose();
          form.resetFields();
        }
      });
    } catch (_) {}
  };

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
            <FileTextOutlined style={{ fontSize: 16 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              Record Operational Expense
            </div>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              Quickly record business expenses and generate automatic journal entries.
            </Text>
          </div>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={isPending}
      width={560}
      okText="Record Expense"
      okButtonProps={{
        style: { borderRadius: 8, fontWeight: 700, height: 38, padding: '0 20px', boxShadow: '0 4px 12px var(--brand-glow)' }
      }}
      cancelButtonProps={{ style: { borderRadius: 8 } }}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          date: dayjs(),
          expense_account: '6001-EXP',
          payment_source: '1001-CASH'
        }}
        style={{ marginTop: 16 }}
      >
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="date" label="Expense Date" rules={[{ required: true }]}>
              <DatePicker format="DD/MM/YYYY" style={{ width: '100%', borderRadius: 8 }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="amount" label="Amount (Rp)" rules={[{ required: true, message: 'Required' }]}>
              <InputNumber
                min={1}
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                parser={value => value?.replace(/\./g, '') as any}
                placeholder="0"
                style={{ width: '100%', borderRadius: 8, fontWeight: 700 }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="description" label="Expense Details / Note" rules={[{ required: true, message: 'Expense details required' }]}>
          <Input placeholder="e.g. Pembayaran listrik kantor bulan ini, Beli kertas HVS..." style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="expense_account" label="Expense Category (Debit)" rules={[{ required: true }]}>
          <Select options={expenseOptions} showSearch allowClear style={{ borderRadius: 8 }} />
        </Form.Item>

        <Form.Item name="payment_source" label="Payment Paid From (Credit)" rules={[{ required: true }]}>
          <Select options={paymentSourceOptions} showSearch allowClear style={{ borderRadius: 8 }} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RecordExpenseModal;
