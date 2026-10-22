import React, { useState } from 'react';
import {
  Table, Button, Typography, Tag, Drawer, Form, Select, InputNumber, Row, Col, Space, message, Card, Popconfirm, Statistic
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlayCircleOutlined, SaveOutlined, CheckCircleOutlined, PlusOutlined, DeleteOutlined, EyeOutlined, CheckOutlined } from '@ant-design/icons';
import api from '../../../lib/api';
import { useResponsiveDrawerWidth } from '../../../hooks/useResponsiveDrawerWidth';

const { Title, Text } = Typography;
const { Option } = Select;

export const StockOpnamePage: React.FC = () => {
  const [initDrawerOpen, setInitDrawerOpen] = useState(false);
  const [recordDrawerOpen, setRecordDrawerOpen] = useState(false);
  const [varianceDrawerOpen, setVarianceDrawerOpen] = useState(false);
  const [selectedOpname, setSelectedOpname] = useState<any>(null);
  const [inspectingOpname, setInspectingOpname] = useState<any>(null);
  const [form] = Form.useForm();
  const [lines, setLines] = useState<any[]>([]);
  const qc = useQueryClient();

  const initDrawerWidth = useResponsiveDrawerWidth(480);
  const recordDrawerWidth = useResponsiveDrawerWidth(680);
  const varianceDrawerWidth = useResponsiveDrawerWidth(780);

  const { data: warehouses } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/api/v1/warehouses').then((r) => r.data),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/v1/master-data/products').then((r) => r.data),
  });

  const { data: opnameResponse, refetch: refetchOpnames, isLoading: isLoadingOpnames } = useQuery({
    queryKey: ['opnames'],
    queryFn: () => api.get('/api/v1/inventory/stock-opname').then((r) => r.data),
  });

  const opnames = opnameResponse?.data || [];

  const initiate = useMutation({
    mutationFn: (warehouse_id: string) => api.post('/api/v1/inventory/stock-opname/initiate', { warehouse_id }).then((r) => r.data.data),
    onSuccess: () => {
      message.success('Stock Opname initiated');
      refetchOpnames();
      setInitDrawerOpen(false);
      form.resetFields();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Gagal memulai stock opname');
    },
  });

  const record = useMutation({
    mutationFn: (data: { id: string; items: any[] }) => api.post(`/api/v1/inventory/stock-opname/${data.id}/record`, { items: data.items }),
    onSuccess: () => {
      message.success('Hasil hitung fisik berhasil disimpan');
      refetchOpnames();
      setRecordDrawerOpen(false);
      setLines([]);
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Gagal menyimpan hasil hitung');
    },
  });

  const finalize = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/inventory/stock-opname/${id}/finalize`).then((r) => r.data.data),
    onSuccess: () => {
      message.success('Stock Opname berhasil difinalisasi dan jurnal penyesuaian dicatat');
      setSelectedOpname(null);
      setVarianceDrawerOpen(false);
      refetchOpnames();
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.error?.message || err?.response?.data?.message || 'Gagal finalize opname');
    },
  });

  const handleInitSubmit = async () => {
    try {
      const values = await form.validateFields();
      initiate.mutate(values.warehouse_id);
    } catch (_) {}
  };

  const handleRecordSubmit = () => {
    if (lines.length === 0) return message.error('Tambah minimal satu baris hitung produk');
    record.mutate({ id: selectedOpname.id, items: lines });
  };

  const openVarianceInspection = (record: any) => {
    setInspectingOpname(record);
    setVarianceDrawerOpen(true);
  };

  const columns: ColumnsType<any> = [
    { title: 'Opname Number', dataIndex: 'opname_number', render: (t) => <Text code>{t}</Text> },
    {
      title: 'Warehouse',
      dataIndex: 'warehouse_id',
      render: (wId, record) => record.warehouse?.name || warehouses?.data?.find((w: any) => w.id === wId)?.name || wId,
    },
    {
      title: 'Date',
      dataIndex: 'initiated_at',
      render: (d, record) => {
        const dateVal = d || record.created_at || record.start_date;
        return dateVal ? new Date(dateVal).toLocaleDateString('id-ID') : '—';
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (s) => (
        <Tag color={s === 'COMPLETED' ? 'green' : s === 'IN_PROGRESS' ? 'blue' : 'orange'}>
          {s}
        </Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Space size={6}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openVarianceInspection(record)}
            aria-label={`Inspeksi varian ${record.opname_number}`}
          >
            Inspeksi Varian
          </Button>
          {(record.status === 'IN_PROGRESS' || record.status === 'INITIATED') && (
            <>
              <Button
                size="small"
                onClick={() => {
                  setSelectedOpname(record);
                  setRecordDrawerOpen(true);
                }}
                icon={<SaveOutlined />}
                aria-label="Catat hasil hitung fisik"
              >
                Record
              </Button>
              <Popconfirm
                title="Finalisasi Stock Opname?"
                description="Aksi ini akan mencatat jurnal penyesuaian selisih stok secara permanen dan membuka kembali gudang."
                onConfirm={() => finalize.mutate(record.id)}
                okText="Ya, Finalisasi"
                cancelText="Batal"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  type="primary"
                  loading={finalize.isPending}
                  disabled={finalize.isPending}
                  icon={<CheckCircleOutlined />}
                  aria-label="Finalisasi stock opname"
                >
                  Finalize
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  // Inspecting lines and statistics
  const inspectingLines: any[] = inspectingOpname?.lines || [];
  const matchCount = inspectingLines.filter(l => Number(l.qty_difference || 0) === 0).length;
  const shortageCount = inspectingLines.filter(l => Number(l.qty_difference || 0) < 0).length;
  const overageCount = inspectingLines.filter(l => Number(l.qty_difference || 0) > 0).length;

  const varianceColumns: ColumnsType<any> = [
    {
      title: 'Produk',
      key: 'product',
      render: (_, line) => {
        const prod = line.product || products?.data?.find((p: any) => p.id === line.product_id);
        return (
          <div>
            <Text strong style={{ display: 'block' }}>{prod?.name || 'Produk'}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>{prod?.code || line.product_id}</Text>
          </div>
        );
      },
    },
    {
      title: 'Stok Sistem',
      dataIndex: 'qty_system',
      align: 'right',
      render: (v) => <Text className="number-display">{Number(v || 0).toLocaleString('id-ID')}</Text>,
    },
    {
      title: 'Hitung Fisik',
      dataIndex: 'qty_counted',
      align: 'right',
      render: (v) => (
        <Text className="number-display" strong>
          {v !== null && v !== undefined ? Number(v).toLocaleString('id-ID') : 'Belum dihitung'}
        </Text>
      ),
    },
    {
      title: 'Selisih (Varian)',
      key: 'variance',
      align: 'right',
      render: (_, line) => {
        if (line.qty_counted === null || line.qty_counted === undefined) {
          return <Tag>Pending</Tag>;
        }
        const diff = Number(line.qty_difference || 0);
        if (diff === 0) {
          return <Tag color="success" icon={<CheckOutlined />}>Sesuai (0)</Tag>;
        }
        if (diff < 0) {
          return <Tag color="error">Kurang ({diff.toLocaleString('id-ID')})</Tag>;
        }
        return <Tag color="blue">Lebih (+{diff.toLocaleString('id-ID')})</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      align: 'center',
      render: (s) => (
        <Tag color={s === 'COUNTED' ? 'green' : 'orange'}>
          {s || 'PENDING'}
        </Tag>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title">Stock Opname</Title>
          <Text className="page-subtitle">Physical stock counting and reconciliation</Text>
        </div>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={() => setInitDrawerOpen(true)}
          aria-label="Mulai Stock Opname Baru"
        >
          Initiate Opname
        </Button>
      </div>

      <Card className="stat-card" styles={{ body: { padding: '24px' } }}>
        <Table
          columns={columns}
          dataSource={opnames}
          scroll={{ x: 'max-content' }}
          loading={isLoadingOpnames}
          rowKey="id"
          size="small"
        />
      </Card>

      {/* Initiate Opname Drawer */}
      <Drawer
        title="Initiate Stock Opname"
        open={initDrawerOpen}
        onClose={() => setInitDrawerOpen(false)}
        width={initDrawerWidth}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setInitDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleInitSubmit} loading={initiate.isPending}>Start</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="warehouse_id" label="Warehouse" rules={[{ required: true, message: 'Pilih gudang' }]}>
            <Select placeholder="Select warehouse to lock and count">
              {warehouses?.data?.map((w: any) => (
                <Option key={w.id} value={w.id}>{w.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Text type="warning">Note: This will lock the warehouse, preventing further transactions until finalized.</Text>
        </Form>
      </Drawer>

      {/* Record Physical Count Drawer */}
      <Drawer
        title="Record Physical Count"
        open={recordDrawerOpen}
        onClose={() => setRecordDrawerOpen(false)}
        width={recordDrawerWidth}
        styles={{ body: { padding: 20 } }}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setRecordDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleRecordSubmit} loading={record.isPending}>Save Counts</Button>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => setLines([...lines, { id: Date.now(), product_id: null, qty_counted: 0 }])}
            aria-label="Tambah Baris Hitung Produk"
          >
            Add Count Line
          </Button>
        </div>
        {lines.map((line) => (
          <Row gutter={8} key={line.id} style={{ marginBottom: 8 }}>
            <Col span={14}>
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder="Pilih Produk"
                value={line.product_id}
                onChange={(v) => setLines(lines.map(l => l.id === line.id ? { ...l, product_id: v } : l))}
                options={products?.data?.map((p: any) => ({ label: `${p.name} (${p.code})`, value: p.id }))}
              />
            </Col>
            <Col span={8}>
              <InputNumber
                style={{ width: '100%' }}
                placeholder="Jumlah Hitung"
                value={line.qty_counted}
                min={0}
                onChange={(v) => setLines(lines.map(l => l.id === line.id ? { ...l, qty_counted: v } : l))}
              />
            </Col>
            <Col span={2}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => setLines(lines.filter(l => l.id !== line.id))}
                aria-label="Hapus baris hitung"
              />
            </Col>
          </Row>
        ))}
      </Drawer>

      {/* Variance & Detail Inspection Drawer (Fix F-11) */}
      <Drawer
        title={`Inspeksi Varian Selisih: ${inspectingOpname?.opname_number || ''}`}
        open={varianceDrawerOpen}
        onClose={() => setVarianceDrawerOpen(false)}
        width={varianceDrawerWidth}
        styles={{ body: { padding: 20 } }}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setVarianceDrawerOpen(false)}>Tutup</Button>
            {inspectingOpname?.status === 'IN_PROGRESS' && (
              <Popconfirm
                title="Finalisasi Stock Opname?"
                description="Pastikan verifikasi selisih fisik telah selesai. Penyesuaian stok akan diposting ke kartu inventaris."
                onConfirm={() => finalize.mutate(inspectingOpname.id)}
                okText="Ya, Finalisasi"
                cancelText="Batal"
                okButtonProps={{ danger: true }}
              >
                <Button type="primary" loading={finalize.isPending} icon={<CheckCircleOutlined />}>
                  Finalisasi Opname Ini
                </Button>
              </Popconfirm>
            )}
          </Space>
        }
      >
        <div style={{ marginBottom: 20 }}>
          <Row gutter={[12, 12]}>
            <Col span={6}>
              <Card className="stat-card" styles={{ body: { padding: 12, textAlign: 'center' } }}>
                <Statistic title="Total Item" value={inspectingLines.length} />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card" styles={{ body: { padding: 12, textAlign: 'center' } }}>
                <Statistic title="Sesuai" value={matchCount} styles={{ content: { color: '#34D399' } }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card" styles={{ body: { padding: 12, textAlign: 'center' } }}>
                <Statistic title="Selisih Kurang" value={shortageCount} styles={{ content: { color: '#EF4444' } }} />
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card" styles={{ body: { padding: 12, textAlign: 'center' } }}>
                <Statistic title="Selisih Lebih" value={overageCount} styles={{ content: { color: '#3B82F6' } }} />
              </Card>
            </Col>
          </Row>
        </div>

        <Table
          columns={varianceColumns}
          dataSource={inspectingLines}
          rowKey={(r: any) => r.id || r.product_id || r.product?.id || 'opname-line'}
          size="small"
          scroll={{ x: 650 }}
          pagination={{ pageSize: 8 }}
        />
      </Drawer>
    </div>
  );
};
