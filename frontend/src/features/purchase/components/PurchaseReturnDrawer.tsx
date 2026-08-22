import React, { useState } from 'react';
import {
  Drawer, Form, Select, Input, InputNumber, Button, Space,
  Row, Col, Table, message, Typography
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';

const { Option } = Select;
const { Text } = Typography;

interface PurchaseReturnDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const PurchaseReturnDrawer: React.FC<PurchaseReturnDrawerProps> = ({ open, onClose }) => {
  const [form] = Form.useForm();
  const [lines, setLines] = useState<any[]>([]);
  const qc = useQueryClient();

  const { data: suppliersResponse } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/api/v1/master-data/suppliers').then((r: any) => r.data),
  });
  const suppliers = (suppliersResponse as any)?.data || [];

  const { data: branchesResponse } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/api/v1/organization/branches').then((r: any) => r.data),
  });
  const branches = (branchesResponse as any)?.data || [];

  const { data: warehousesResponse } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/api/v1/warehouses').then((r: any) => r.data),
  });
  const warehouses = (warehousesResponse as any)?.data || [];

  const { data: productsResponse } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/v1/master-data/products').then((r: any) => r.data),
  });
  const products = (productsResponse as any)?.data || [];

  const { data: uomsResponse } = useQuery({
    queryKey: ['uoms'],
    queryFn: () => api.get('/api/v1/master-data/uoms').then((r: any) => r.data),
  });
  const uoms = (uomsResponse as any)?.data || [];

  const createReturn = useMutation({
    mutationFn: (payload: any) => api.post('/api/v1/purchase-returns', payload).then((r: any) => r.data),
    onSuccess: () => {
      message.success('Retur pembelian berhasil dibuat dan stok diperbarui!');
      qc.invalidateQueries({ queryKey: ['purchase-returns'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      onClose();
      form.resetFields();
      setLines([]);
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || 'Gagal membuat retur pembelian');
    },
  });

  const handleAddLine = () => {
    setLines([...lines, { key: Date.now(), product_id: null, uom_id: null, qty: 1, unit_cost: 0 }]);
  };

  const handleRemoveLine = (key: number) => {
    setLines(lines.filter((l) => l.key !== key));
  };

  const updateLine = (key: number, field: string, value: any) => {
    setLines(
      lines.map((l) => {
        if (l.key !== key) return l;
        const updated = { ...l, [field]: value };
        if (field === 'product_id') {
          const prod = products.find((p: any) => p.id === value);
          if (prod) {
            updated.uom_id = prod.uom_id;
            updated.unit_cost = Number(prod.standard_cost) || 0;
          }
        }
        return updated;
      }),
    );
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (lines.length === 0) {
        return message.error('Tambahkan minimal 1 item retur');
      }
      for (const line of lines) {
        if (!line.product_id || !line.uom_id || line.qty <= 0) {
          return message.error('Pastikan seluruh baris item lengkap dan jumlah > 0');
        }
      }

      const payload = {
        ...values,
        lines: lines.map((l) => ({
          product_id: l.product_id,
          uom_id: l.uom_id,
          qty: l.qty,
          unit_cost: l.unit_cost,
        })),
      };

      await createReturn.mutateAsync(payload);
    } catch (_) {}
  };

  const lineColumns = [
    {
      title: 'Produk',
      dataIndex: 'product_id',
      render: (val: any, record: any) => (
        <Select
          style={{ width: '100%' }}
          placeholder="Pilih produk"
          value={val}
          onChange={(v) => updateLine(record.key, 'product_id', v)}
        >
          {products.map((p: any) => (
            <Option key={p.id} value={p.id}>{p.code} - {p.name}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Satuan',
      dataIndex: 'uom_id',
      width: 120,
      render: (val: any, record: any) => (
        <Select
          style={{ width: '100%' }}
          placeholder="Satuan"
          value={val}
          onChange={(v) => updateLine(record.key, 'uom_id', v)}
        >
          {uoms.map((u: any) => (
            <Option key={u.id} value={u.id}>{u.code}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Jumlah',
      dataIndex: 'qty',
      width: 100,
      render: (val: any, record: any) => (
        <InputNumber
          min={0.0001}
          style={{ width: '100%' }}
          value={val}
          onChange={(v) => updateLine(record.key, 'qty', v || 0)}
        />
      ),
    },
    {
      title: 'Biaya Satuan',
      dataIndex: 'unit_cost',
      width: 130,
      render: (val: any, record: any) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={val}
          onChange={(v) => updateLine(record.key, 'unit_cost', v || 0)}
        />
      ),
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 60,
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveLine(record.key)}
        />
      ),
    },
  ];

  return (
    <Drawer
      title="Buat Retur Pembelian (Return to Supplier)"
      open={open}
      onClose={onClose}
      width={720}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>Batal</Button>
          <Button type="primary" onClick={handleSubmit} loading={createReturn.isPending}>
            Konfirmasi Retur & Potong Stok
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="supplier_id" label="Supplier" rules={[{ required: true, message: 'Pilih supplier' }]}>
              <Select placeholder="Pilih supplier">
                {suppliers.map((s: any) => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="branch_id" label="Cabang" rules={[{ required: true, message: 'Pilih cabang' }]}>
              <Select placeholder="Pilih cabang">
                {branches.map((b: any) => (
                  <Option key={b.id} value={b.id}>{b.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="warehouse_id" label="Gudang Asal" rules={[{ required: true, message: 'Pilih gudang' }]}>
              <Select placeholder="Pilih gudang asal">
                {warehouses.map((w: any) => (
                  <Option key={w.id} value={w.id}>{w.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="reason" label="Alasan Retur" rules={[{ required: true, message: 'Isi alasan retur' }]}>
              <Input placeholder="Contoh: Barang rusak saat diterima" />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ marginTop: 16, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>Baris Item Retur</Text>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleAddLine}>
            Tambah Item
          </Button>
        </div>

        <Table
          dataSource={lines}
          columns={lineColumns}
          pagination={false}
          size="small"
          rowKey="key"
        />
      </Form>
    </Drawer>
  );
};
