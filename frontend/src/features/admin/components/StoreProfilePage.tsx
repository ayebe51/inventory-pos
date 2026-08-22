import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tabs,
  Table,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
  Badge,
  Row,
  Col,
  Popconfirm,
  Descriptions,
} from 'antd';
import {
  Store,
  Building2,
  Warehouse as WarehouseIcon,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Layers,
  AlertCircle,
  Building,
} from 'lucide-react';
import { api } from '../../../lib/api';

interface BranchItem {
  id: string;
  code: string;
  name: string;
  type: 'HEAD_OFFICE' | 'BRANCH';
  parent_id: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  branch_id: string;
  address: string | null;
  is_active: boolean;
  is_locked: boolean;
  lock_reason?: string | null;
}

interface HierarchyNode extends BranchItem {
  children?: HierarchyNode[];
}

export const StoreProfilePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('1');
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  
  // Modals state
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);
  const [isHeadOfficeModalOpen, setIsHeadOfficeModalOpen] = useState(false);
  
  const [form] = Form.useForm();
  const [hoForm] = Form.useForm();

  // Fetch all organization data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchRes, hierarchyRes, warehouseRes] = await Promise.all([
        api.get('/api/v1/organization/branches').catch(() => ({ data: { data: [] } })),
        api.get('/api/v1/organization/hierarchy').catch(() => ({ data: { data: [] } })),
        api.get('/api/v1/warehouses').catch(() => ({ data: { data: [] } })),
      ]);

      const branchList: BranchItem[] = branchRes.data?.data || [];
      const hierarchyData: HierarchyNode[] = hierarchyRes.data?.data || [];
      const warehouseList: WarehouseItem[] = warehouseRes.data?.data || [];

      setBranches(branchList);
      setHierarchy(hierarchyData);
      setWarehouses(warehouseList);
    } catch (err: any) {
      message.error(err.message || 'Gagal memuat data profil toko & cabang');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const headOffice = branches.find((b) => b.type === 'HEAD_OFFICE') || branches[0];
  const regularBranches = branches.filter((b) => b.type === 'BRANCH');

  // Handle Head Office Create / Update
  const handleSaveHeadOffice = async (values: any) => {
    try {
      if (headOffice) {
        // Update existing HO/Branch
        await api.put(`/api/v1/organization/branches/${headOffice.id}`, values);
        message.success('Profil Toko Pusat berhasil diperbarui');
      } else {
        // Create new HO
        await api.post('/api/v1/organization/head-office', values);
        message.success('Profil Toko Pusat berhasil dibuat');
      }
      setIsHeadOfficeModalOpen(false);
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.message || err.message || 'Gagal menyimpan Profil Toko');
    }
  };

  // Handle Create / Edit Branch
  const handleSaveBranch = async (values: any) => {
    try {
      if (editingBranch) {
        await api.put(`/api/v1/organization/branches/${editingBranch.id}`, values);
        message.success('Data cabang berhasil diperbarui');
      } else {
        await api.post('/api/v1/organization/branches', {
          ...values,
          parent_id: values.parent_id || headOffice?.id,
        });
        message.success('Cabang baru berhasil dibuat');
      }
      setIsBranchModalOpen(false);
      setEditingBranch(null);
      form.resetFields();
      fetchData();
    } catch (err: any) {
      message.error(err.response?.data?.message || err.message || 'Gagal menyimpan Cabang');
    }
  };

  const handleOpenEditBranch = (record: BranchItem) => {
    setEditingBranch(record);
    form.setFieldsValue({
      code: record.code,
      name: record.name,
      address: record.address,
      parent_id: record.parent_id,
    });
    setIsBranchModalOpen(true);
  };

  const handleToggleBranchActive = async (record: BranchItem) => {
    try {
      await api.put(`/api/v1/organization/branches/${record.id}`, {
        is_active: !record.is_active,
      });
      message.success(`Cabang ${record.name} berhasil ${record.is_active ? 'dinonaktifkan' : 'diaktifkan'}`);
      fetchData();
    } catch (err: any) {
      message.error(err.message || 'Gagal mengubah status cabang');
    }
  };

  const branchColumns = [
    {
      title: 'Kode Cabang',
      dataIndex: 'code',
      key: 'code',
      render: (code: string, record: BranchItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--brand-500)' }}>
            {code}
          </span>
          {record.type === 'HEAD_OFFICE' && (
            <Tag color="volcano" style={{ fontSize: 10, fontWeight: 700, borderRadius: 4 }}>
              PUSAT / HO
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Nama Cabang',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: BranchItem) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {record.address || 'Alamat belum diisi'}
          </div>
        </div>
      ),
    },
    {
      title: 'Tipe Node',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === 'HEAD_OFFICE' ? 'purple' : 'blue'} style={{ borderRadius: 12, fontWeight: 600 }}>
          {type === 'HEAD_OFFICE' ? 'Head Office' : 'Cabang Operasional'}
        </Tag>
      ),
    },
    {
      title: 'Gudang Terkait',
      key: 'warehouses',
      render: (_: any, record: BranchItem) => {
        const branchWhs = warehouses.filter((w) => w.branch_id === record.id);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {branchWhs.length > 0 ? (
              branchWhs.map((wh) => (
                <Tag key={wh.id} color="cyan" style={{ fontSize: 11, borderRadius: 4 }}>
                  {wh.name} ({wh.code})
                </Tag>
              ))
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                Belum ada gudang
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Badge
          status={active ? 'success' : 'default'}
          text={
            <span style={{ fontWeight: 600, color: active ? '#10B981' : 'var(--text-tertiary)' }}>
              {active ? 'Aktif' : 'Non-Aktif'}
            </span>
          }
        />
      ),
    },
    {
      title: 'Aksi',
      key: 'actions',
      render: (_: any, record: BranchItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            type="text"
            size="small"
            icon={<Edit2 size={14} />}
            onClick={() => handleOpenEditBranch(record)}
            style={{ color: 'var(--brand-500)' }}
          >
            Edit
          </Button>

          {record.type !== 'HEAD_OFFICE' && (
            <Popconfirm
              title={`${record.is_active ? 'Nonaktifkan' : 'Aktifkan'} Cabang?`}
              description={`Apakah Anda yakin ingin ${record.is_active ? 'menonaktifkan' : 'mengaktifkan'} ${record.name}?`}
              onConfirm={() => handleToggleBranchActive(record)}
              okText="Ya, Lanjutkan"
              cancelText="Batal"
            >
              <Button
                type="text"
                size="small"
                danger={record.is_active}
                icon={<Trash2 size={14} />}
              >
                {record.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: 'var(--brand-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFF',
                boxShadow: '0 4px 12px rgba(240, 83, 40, 0.25)',
              }}
            >
              <Store size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                Profil Toko & Pengaturan Cabang
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>
                Kelola identitas pusat (Head Office), struktur jaringan cabang, dan pemetaan gudang operasional.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            icon={<RefreshCw size={15} />}
            onClick={fetchData}
            loading={loading}
            style={{ borderRadius: 10 }}
          >
            Segarkan
          </Button>
          <Button
            type="primary"
            icon={<Plus size={15} />}
            onClick={() => {
              setEditingBranch(null);
              form.resetFields();
              setIsBranchModalOpen(true);
            }}
            style={{
              borderRadius: 10,
              background: 'linear-gradient(135deg, #F05328 0%, #D94119 100%)',
              border: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(240, 83, 40, 0.3)',
            }}
          >
            Tambah Cabang Baru
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }} align="stretch">
        <Col xs={24} sm={8} style={{ display: 'flex' }}>
          <Card
            bordered={false}
            styles={{ body: { padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
            style={{
              width: '100%',
              minHeight: 120,
              borderRadius: 16,
              background: 'var(--solid-bg)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              border: '1px solid var(--solid-border)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
                HEAD OFFICE / PUSAT
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#FFF1ED', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F05328' }}>
                  <Building size={18} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {headOffice ? headOffice.name : 'Utama'}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--solid-border-subtle, #F1F5F9)' }}>
              Kode: <strong style={{ color: 'var(--text-primary)' }}>{headOffice?.code || 'HO-Pusat'}</strong> • Entitas Induk
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={8} style={{ display: 'flex' }}>
          <Card
            bordered={false}
            styles={{ body: { padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
            style={{
              width: '100%',
              minHeight: 120,
              borderRadius: 16,
              background: 'var(--solid-bg)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              border: '1px solid var(--solid-border)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
                TOTAL CABANG OPERASIONAL
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                  <Building2 size={18} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {regularBranches.length} <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>Cabang</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--solid-border-subtle, #F1F5F9)' }}>
              {regularBranches.filter((b) => b.is_active).length} Cabang Aktif Digunakan
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={8} style={{ display: 'flex' }}>
          <Card
            bordered={false}
            styles={{ body: { padding: '16px 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
            style={{
              width: '100%',
              minHeight: 120,
              borderRadius: 16,
              background: 'var(--solid-bg)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
              border: '1px solid var(--solid-border)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>
                TOTAL GUDANG FISIK
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <WarehouseIcon size={18} />
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {warehouses.length} <span style={{ fontSize: 13, color: 'var(--text-tertiary)', fontWeight: 500 }}>Gudang</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--solid-border-subtle, #F1F5F9)' }}>
              Tersebar di seluruh cabang operasional
            </div>
          </Card>
        </Col>
      </Row>

      {/* Main Tab Container */}
      <Card
        bordered={false}
        style={{
          borderRadius: 20,
          background: 'var(--solid-bg)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          border: '1px solid var(--solid-border)',
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="large"
          items={[
            {
              key: '1',
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <Store size={16} /> Profil Toko Pusat (Head Office)
                </span>
              ),
              children: (
                <div style={{ padding: '12px 0' }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
                  ) : headOffice ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            Informasi Identitas Kantor Pusat
                          </h3>
                          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                            Identitas utama yang tercantum pada nota POS, faktur penjualan, dan laporan keuangan resmi.
                          </span>
                        </div>
                        <Button
                          icon={<Edit2 size={14} />}
                          onClick={() => {
                            hoForm.setFieldsValue({
                              code: headOffice.code,
                              name: headOffice.name,
                              address: headOffice.address,
                            });
                            setIsHeadOfficeModalOpen(true);
                          }}
                          style={{ borderRadius: 10 }}
                        >
                          Edit Profil Pusat
                        </Button>
                      </div>

                      <Descriptions
                        bordered
                        column={{ xs: 1, sm: 2, md: 2 }}
                        labelStyle={{ fontWeight: 600, background: 'var(--solid-bg-subtle)', width: '200px' }}
                      >
                        <Descriptions.Item label="Nama Perusahaan / Toko">
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{headOffice.name}</span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Kode Entitas (HO)">
                          <Tag color="volcano" style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {headOffice.code}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Tipe Organisasi">
                          <Tag color="purple" style={{ fontWeight: 600 }}>HEAD_OFFICE (Root Node)</Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Status Operasional">
                          <Badge status={headOffice.is_active ? 'success' : 'error'} text={headOffice.is_active ? 'Aktif Digunakan' : 'Non-Aktif'} />
                        </Descriptions.Item>
                        <Descriptions.Item label="Alamat Kantor Pusat" span={2}>
                          {headOffice.address || 'Belum diisi'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Tanggal Registrasi">
                          {new Date(headOffice.created_at).toLocaleDateString('id-ID', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Descriptions.Item>
                        <Descriptions.Item label="Mata Uang Operasional">
                          <span style={{ fontWeight: 600 }}>Rupiah (IDR - Rp)</span>
                        </Descriptions.Item>
                      </Descriptions>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      <AlertCircle size={40} style={{ color: '#F59E0B', marginBottom: 12 }} />
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>Profil Toko Pusat Belum Dibuat</h3>
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                        Silakan buat identitas Head Office terlebih dahulu sebagai induk seluruh cabang.
                      </p>
                      <Button
                        type="primary"
                        icon={<Plus size={15} />}
                        onClick={() => {
                          hoForm.resetFields();
                          setIsHeadOfficeModalOpen(true);
                        }}
                      >
                        Buat Profil Toko Pusat
                      </Button>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: '2',
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <Building2 size={16} /> Daftar & Manajemen Cabang ({branches.length})
                </span>
              ),
              children: (
                <div style={{ padding: '12px 0' }}>
                  <Table
                    columns={branchColumns}
                    dataSource={branches}
                    rowKey="id"
                    loading={loading}
                    pagination={false}
                    bordered
                    style={{ borderRadius: 12, overflow: 'hidden' }}
                  />
                </div>
              ),
            },
            {
              key: '3',
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                  <Layers size={16} /> Hierarki & Pemetaan Gudang
                </span>
              ),
              children: (
                <div style={{ padding: '12px 0' }}>
                  <div style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Pemetaan Gudang Fisik per Cabang Operasional
                    </h3>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      Pohon struktur organisasi terverifikasi memuat {hierarchy.length > 0 ? hierarchy.length : branches.length} node cabang & kantor pusat.
                    </span>
                  </div>

                  <Row gutter={[16, 16]}>
                    {branches.map((b) => {
                      const branchWhs = warehouses.filter((w) => w.branch_id === b.id);
                      return (
                        <Col xs={24} md={12} key={b.id}>
                          <Card
                            title={
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Building2 size={16} style={{ color: 'var(--brand-500)' }} />
                                  <span style={{ fontWeight: 700 }}>{b.name}</span>
                                </div>
                                <Tag color={b.type === 'HEAD_OFFICE' ? 'purple' : 'blue'}>
                                  {b.code}
                                </Tag>
                              </div>
                            }
                            bordered
                            style={{ borderRadius: 14, background: 'var(--solid-bg-subtle)' }}
                          >
                            {branchWhs.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {branchWhs.map((wh) => (
                                  <div
                                    key={wh.id}
                                    style={{
                                      padding: '10px 14px',
                                      borderRadius: 10,
                                      background: 'var(--solid-bg)',
                                      border: '1px solid var(--solid-border)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                    }}
                                  >
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                                        {wh.name}
                                      </div>
                                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        Kode: <code style={{ fontWeight: 700 }}>{wh.code}</code> • {wh.address || 'Tanpa Alamat'}
                                      </div>
                                    </div>

                                    <Badge
                                      status={wh.is_locked ? 'error' : 'success'}
                                      text={
                                        <span style={{ fontSize: 11, fontWeight: 600 }}>
                                          {wh.is_locked ? 'Terkunci' : 'Siap Digunakan'}
                                        </span>
                                      }
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
                                Belum ada gudang fisik yang didaftarkan pada cabang ini.
                              </div>
                            )}
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Modal Head Office Create/Edit */}
      <Modal
        title={headOffice ? 'Edit Profil Toko Pusat (Head Office)' : 'Buat Profil Toko Pusat'}
        open={isHeadOfficeModalOpen}
        onCancel={() => setIsHeadOfficeModalOpen(false)}
        onOk={() => hoForm.submit()}
        okText="Simpan Profil"
        cancelText="Batal"
        destroyOnClose
      >
        <Form form={hoForm} layout="vertical" onFinish={handleSaveHeadOffice} style={{ marginTop: 16 }}>
          <Form.Item
            name="code"
            label="Kode Organisasi Pusat (HO Code)"
            rules={[{ required: true, message: 'Kode organisasi wajib diisi' }]}
          >
            <Input placeholder="Contoh: HO-Pusat" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nama Perusahaan / Toko Utama"
            rules={[{ required: true, message: 'Nama Toko wajib diisi' }]}
          >
            <Input placeholder="Contoh: PT Kiro Retail Indonesia" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item name="address" label="Alamat Kantor Pusat">
            <Input.TextArea rows={3} placeholder="Alamat lengkap pusat..." style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Branch Create/Edit */}
      <Modal
        title={editingBranch ? `Edit Cabang — ${editingBranch.name}` : 'Tambah Cabang Baru'}
        open={isBranchModalOpen}
        onCancel={() => {
          setIsBranchModalOpen(false);
          setEditingBranch(null);
        }}
        onOk={() => form.submit()}
        okText="Simpan Cabang"
        cancelText="Batal"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSaveBranch} style={{ marginTop: 16 }}>
          <Form.Item
            name="code"
            label="Kode Cabang"
            rules={[{ required: true, message: 'Kode cabang wajib diisi' }]}
          >
            <Input placeholder="Contoh: BR-SUB-01" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Nama Cabang Operasional"
            rules={[{ required: true, message: 'Nama cabang wajib diisi' }]}
          >
            <Input placeholder="Contoh: Cabang Surabaya Barat" style={{ borderRadius: 8 }} />
          </Form.Item>

          <Form.Item name="parent_id" label="Induk Head Office">
            <Select placeholder="Pilih Head Office Induk" style={{ borderRadius: 8 }}>
              {branches
                .filter((b) => b.type === 'HEAD_OFFICE')
                .map((ho) => (
                  <Select.Option key={ho.id} value={ho.id}>
                    {ho.name} ({ho.code})
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item name="address" label="Alamat Cabang">
            <Input.TextArea rows={3} placeholder="Alamat cabang..." style={{ borderRadius: 8 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StoreProfilePage;
