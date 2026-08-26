import React, { useState } from 'react';
import {
  Table, Typography, Button, Input, Tag, Modal, Form, Select, Switch, message, Card
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusOutlined, EditOutlined, UserOutlined, TeamOutlined,
  SearchOutlined, SafetyCertificateOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const RoleManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();

  // Queries
  const { data: rolesResponse, isLoading: rolesLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/api/v1/admin/roles').then((r: any) => r.data)
  });
  const roles = rolesResponse?.data || (Array.isArray(rolesResponse) ? rolesResponse : []);

  const { data: permissionsResponse } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () => api.get('/api/v1/admin/permissions').then((r: any) => r.data)
  });
  const permissions = permissionsResponse?.data || (Array.isArray(permissionsResponse) ? permissionsResponse : []);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (values: any) => api.post('/api/v1/admin/roles', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-roles'] });
      setIsModalOpen(false);
      form.resetFields();
      message.success('Role created successfully');
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to create role')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) => api.put(`/api/v1/admin/roles/${id}`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-roles'] });
      setIsModalOpen(false);
      form.resetFields();
      setEditingRoleId(null);
      message.success('Role updated successfully');
    }
  });

  const handleOpenModal = (role?: any) => {
    if (role) {
      setEditingRoleId(role.id);
      form.setFieldsValue({
        name: role.name,
        description: role.description,
        is_active: role.is_active,
        permission_ids: role.role_permissions?.map((rp: any) => rp.permission.id) || []
      });
    } else {
      setEditingRoleId(null);
      form.resetFields();
      form.setFieldsValue({ is_active: true });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    form.validateFields().then(values => {
      if (editingRoleId) {
        updateMutation.mutate({ id: editingRoleId, values });
      } else {
        createMutation.mutate(values);
      }
    });
  };

  const filteredRoles = roles.filter((r: any) =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      title: 'ROLE NAME',
      dataIndex: 'name',
      render: (name: string) => <Text style={{ fontWeight: 700, fontSize: 14 }}>{name}</Text>
    },
    {
      title: 'DESCRIPTION',
      dataIndex: 'description',
      render: (desc: string) => <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{desc || '—'}</span>
    },
    {
      title: 'ACTIVE USERS',
      dataIndex: '_count',
      width: 140,
      render: (v: any) => (
        <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700 }}>
          {v?.user_roles || 0} users
        </Tag>
      )
    },
    {
      title: 'STATUS',
      dataIndex: 'is_active',
      width: 120,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'} style={{ borderRadius: 6, fontWeight: 700 }}>
          {isActive ? 'ACTIVE' : 'INACTIVE'}
        </Tag>
      )
    },
    {
      title: 'CREATED DATE',
      dataIndex: 'created_at',
      width: 140,
      render: (v: string) => <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{v ? dayjs(v).format('DD MMM YYYY') : '—'}</span>
    },
    {
      title: 'ACTION',
      key: 'action',
      width: 80,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} size="small" style={{ borderRadius: 6 }} />
      )
    }
  ];

  return (
    <div className="page-container" style={{ paddingBottom: 40 }}>
      {/* Eyebrow Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 999,
          background: 'var(--brand-50)',
          border: '1px solid var(--brand-200)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--brand-600)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 8
        }}>
          <SafetyCertificateOutlined />
          <span>RBAC Governance & Permissions</span>
        </div>

        <Title level={2} className="page-title" style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>
          Role Management & Permissions
        </Title>
        <Text className="page-subtitle" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Configure fine-grained module access rights, permissions, and security roles.
        </Text>
      </div>

      {/* Pill Navigation Bar */}
      <Card bodyStyle={{ padding: '8px 12px' }} style={{ borderRadius: 16, marginBottom: 24, background: 'var(--solid-bg)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => navigate('/admin/users')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 12,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            <UserOutlined />
            <span>User Accounts</span>
          </button>

          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--solid-bg)',
              color: 'var(--brand-600)',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}
          >
            <TeamOutlined />
            <span>Roles & Permissions</span>
            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'var(--brand-50)', color: 'var(--brand-600)' }}>
              {roles.length}
            </span>
          </button>
        </div>
      </Card>

      <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 20, background: 'var(--solid-bg)' }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search role name or description..."
            prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ maxWidth: 360, borderRadius: 10 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
            style={{ height: 40, borderRadius: 10, fontWeight: 700, boxShadow: '0 4px 12px var(--brand-glow)' }}
          >
            Add New Role
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={filteredRoles}
          rowKey="id"
          loading={rolesLoading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10 }}
          size="middle"
          style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
        />
      </Card>

      <Modal
        title={editingRoleId ? "Edit Security Role" : "Add Security Role"}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Role Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Finance Manager, Inventory Clerk" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="description" label="Role Description">
            <Input.TextArea rows={2} placeholder="Describe role responsibilities..." style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="permission_ids" label="Assigned Permissions">
            <Select
              mode="multiple"
              placeholder="Select permissions"
              style={{ borderRadius: 8 }}
              options={permissions.map((p: any) => ({
                label: `${p.module}.${p.action}`,
                value: p.id
              }))}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="is_active" label="Role Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RoleManagementPage;
