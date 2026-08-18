import React, { useState } from 'react';
import { Modal, Form, Input, Button, Table, InputNumber, DatePicker, message, Row, Col, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useCreateJournalEntry } from '../hooks/useFinance';
import type { JournalEntryLine } from '../types/finance.types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JournalEntryModal: React.FC<JournalEntryModalProps> = ({ isOpen, onClose }) => {
  const [form] = Form.useForm();
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { accountId: '', debit: 0, credit: 0 },
    { accountId: '', debit: 0, credit: 0 },
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

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
  const isBalanced = totalDebit === totalCredit && totalDebit > 0;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!isBalanced) {
        message.error('Journal entry must be balanced (Total Debit = Total Credit)');
        return;
      }
      
      const hasEmptyAccounts = lines.some(l => !l.accountId);
      if (hasEmptyAccounts) {
        message.error('All lines must have an Account ID');
        return;
      }

      mutate({
        date: values.date.format('YYYY-MM-DD'),
        description: values.description,
        lines,
      }, {
        onSuccess: () => {
          message.success('Journal entry created successfully');
          onClose();
          form.resetFields();
          setLines([
            { accountId: '', debit: 0, credit: 0 },
            { accountId: '', debit: 0, credit: 0 },
          ]);
        }
      });
    } catch (_) {}
  };

  const columns = [
    {
      title: 'Account ID',
      key: 'accountId',
      render: (_: any, __: any, index: number) => (
        <Input
          placeholder="e.g. 1001-CASH"
          value={lines[index].accountId}
          onChange={(e) => handleLineChange(index, 'accountId', e.target.value)}
        />
      ),
    },
    {
      title: 'Debit',
      key: 'debit',
      width: 150,
      render: (_: any, __: any, index: number) => (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          value={lines[index].debit}
          onChange={(val) => handleLineChange(index, 'debit', val || 0)}
          disabled={lines[index].credit > 0}
        />
      ),
    },
    {
      title: 'Credit',
      key: 'credit',
      width: 150,
      render: (_: any, __: any, index: number) => (
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          value={lines[index].credit}
          onChange={(val) => handleLineChange(index, 'credit', val || 0)}
          disabled={lines[index].debit > 0}
        />
      ),
    },
    {
      title: '',
      key: 'action',
      width: 50,
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
      title="Manual Journal Entry"
      open={isOpen}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={isPending}
      width={700}
      okText="Post Entry"
      okButtonProps={{ disabled: !isBalanced }}
    >
      <Form form={form} layout="vertical" initialValues={{ date: dayjs() }}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              name="date"
              label="Date"
              rules={[{ required: true, message: 'Date is required' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item
              name="description"
              label="Description"
              rules={[{ required: true, message: 'Description is required' }]}
            >
              <Input placeholder="Entry description..." />
            </Form.Item>
          </Col>
        </Row>

        <Table
          dataSource={lines}
          columns={columns}
          rowKey={(_, i) => String(i)}
          pagination={false}
          size="small"
          footer={() => (
            <Row style={{ marginTop: 8 }}>
              <Col span={12}>
                <Button type="dashed" onClick={addLine} icon={<PlusOutlined />} block>
                  Add Line
                </Button>
              </Col>
            </Row>
          )}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, marginTop: 16 }}>
          <Text strong>
            Total Debit: <Text style={{ color: totalDebit === totalCredit ? '#34d399' : '#f43f5e' }}>Rp {totalDebit.toLocaleString()}</Text>
          </Text>
          <Text strong>
            Total Credit: <Text style={{ color: totalDebit === totalCredit ? '#34d399' : '#f43f5e' }}>Rp {totalCredit.toLocaleString()}</Text>
          </Text>
        </div>
      </Form>
    </Modal>
  );
};
