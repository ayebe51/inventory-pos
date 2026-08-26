import React, { useState } from 'react';
import {
  Table, Typography, Button, Input, Space, Tag, Modal, Form, Select, Switch, message, Card
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusOutlined, EditOutlined, KeyOutlined, UserOutlined,
  SearchOutlined, SafetyCertificateOutlined, TeamOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form] = Form.useForm();

  // Queries
  const { data: usersResponse, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/api/v1/admin/users').then((r: any) => r.data)
  });
  const users = usersResponse?.data || (Array.isArray(usersResponse) ? usersResponse : []);

  const { data: rolesResponse } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/api/v1/admin/roles').then((r: any) => r.data)
  });
  const roles = rolesResponse?.data || (Array.isArray(rolesResponse) ? rolesResponse : []);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (values: any) => api.post('/api/v1/admin/users', values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setIsModalOpen(false);
      form.resetFields();
      message.success('User created successfully');
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Failed to create user')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) => api.put(`/api/v1/admin/users/${id}`, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      setIsModalOpen(false);
      form.resetFields();
      setEditingUserId(null);
      message.success('User updated successfully');
    }
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/admin/users/${id}/reset-password`),
    onSuccess: (data: any) => {
      Modal.success({
        title: 'Password Reset Successful',
        content: (
          <div style={{ marginTop: 12 }}>
            <p>Please provide this temporary password to the user securely:</p>
            <Text copyable style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--brand-600)' }}>
              {data?.data?.temp_password || 'P@ssword123'}
            </Text>
          </div>
        )
      });
    }
  });

  const handleOpenModal = (user?: any) => {
    if (user) {
      setEditingUserId(user.id);
      form.setFieldsValue({
        email: user.email,
        full_name: user.full_name,
        is_active: user.is_active,
        role_ids: user.user_roles?.map((ur: any) => ur.role.id) || []
      });
    } else {
      setEditingUserId(null);
      form.resetFields();
      form.setFieldsValue({ is_active: true });
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    form.validateFields().then(values => {
      if (editingUserId) {
        updateMutation.mutate({ id: editingUserId, values });
      } else {
        createMutation.mutate(values);
      }
    });
  };

  const filteredUsers = users.filter((u: any) =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      title: 'FULL NAME',
      dataIndex: 'full_name',
      render: (name: string) => <Text style={{ fontWeight: 700, fontSize: 14 }}>{name}</Text>
    },
    {
      title: 'EMAIL ADDRESS',
      dataIndex: 'email',
      render: (email: string) => (
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, color: 'var(--text-secondary)' }}>
          {email}
        </span>
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
      title: 'ASSIGNED ROLES',
      key: 'roles',
      render: (_: any, record: any) => (
        <Space wrap>
          {record.user_roles?.map((ur: any) => (
            <Tag key={ur.role?.id || Math.random()} color="blue" style={{ borderRadius: 6, fontWeight: 600 }}>
              {ur.role?.name || 'User'}
            </Tag>
          ))}
        </Space>
      )
    },
    {
      title: 'JOINED DATE',
      dataIndex: 'created_at',
      width: 140,
      render: (v: string) => <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{v ? dayjs(v).format('DD MMM YYYY') : '—'}</span>
    },
    {
      title: 'ACTION',
      key: 'action',
      width: 130,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} size="small" style={{ borderRadius: 6 }} />
          <Button
            icon={<KeyOutlined />}
            onClick={() => {
              Modal.confirm({
                title: 'Reset Password',
                content: `Are you sure you want to reset password for ${record.full_name}?`,
                onOk: () => resetPasswordMutation.mutate(record.id)
              });
            }}
            size="small"
            danger
            style={{ borderRadius: 6 }}
          >
            Reset
          </Button>
        </Space>
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
          <span>Identity & Access Control (IAM)</span>
        </div>

        <Title level={2} className="page-title" style={{ margin: '0 0 6px 0', fontSize: 28, fontWeight: 800, letterSpacing: '-0.025em' }}>
          User Accounts Management
        </Title>
        <Text className="page-subtitle" style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Manage team member accounts, assign RBAC security roles, and handle password resets.
        </Text>
      </div>

      {/* Pill Navigation Bar */}
      <Card bodyStyle={{ padding: '8px 12px' }} style={{ borderRadius: 16, marginBottom: 24, background: 'var(--solid-bg)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
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
            <UserOutlined />
            <span>User Accounts</span>
            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: 'var(--brand-50)', color: 'var(--brand-600)' }}>
              {users.length}
            </span>
          </button>

          <button
            onClick={() => navigate('/admin/roles')}
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
            <TeamOutlined />
            <span>Roles & Permissions</span>
          </button>
        </div>
      </Card>

      <Card bodyStyle={{ padding: 20 }} style={{ borderRadius: 20, background: 'var(--solid-bg)' }}>
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search by name or email..."
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
            Add New User
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={filteredUsers}
          rowKey="id"
          loading={usersLoading}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 10 }}
          size="middle"
          style={{ background: 'var(--solid-bg)', borderRadius: 14, overflow: 'hidden' }}
        />
      </Card>

      <Modal
        title={editingUserId ? "Edit User Account" : "Add New User Account"}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={500}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="John Doe" style={{ borderRadius: 8 }} />
          </Form.Item>
          <Form.Item name="email" label="Email Address" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
            <Input disabled={!!editingUserId} placeholder="john@example.com" style={{ borderRadius: 8 }} />
          </Form.Item>
          {!editingUserId && (
            <Form.Item name="password" label="Temporary Password" rules={[{ required: true, message: 'Required' }]}>
              <Input.Password placeholder="Min 8 characters" style={{ borderRadius: 8 }} />
            </Form.Item>
          )}
          <Form.Item name="role_ids" label="Assigned System Roles">
            <Select mode="multiple" placeholder="Select roles" style={{ borderRadius: 8 }}>
              {roles.map((r: any) => (
                <Option key={r.id} value={r.id}>{r.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="Account Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagementPage;
