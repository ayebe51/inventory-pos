import React, { useState } from 'react';
import {
  Table, Typography, Button, Input, Space, Tag, Modal, Form, Select, Switch, message
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusOutlined, EditOutlined, KeyOutlined
} from '@ant-design/icons';
import { api } from '../../../lib/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

export const UserManagementPage: React.FC = () => {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // Queries
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/api/v1/admin/users').then((r: any) => r.data)
  });

  const { data: roles } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/api/v1/admin/roles').then((r: any) => r.data)
  });

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
          <div>
            <p>Please provide this temporary password to the user securely:</p>
            <Text copyable style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {data.data.temp_password}
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

  const columns = [
    { title: 'Name', dataIndex: 'full_name' },
    { title: 'Email', dataIndex: 'email' },
    { 
      title: 'Status', 
      dataIndex: 'is_active', 
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? 'ACTIVE' : 'INACTIVE'}</Tag>
      ) 
    },
    { 
      title: 'Roles', 
      key: 'roles', 
      render: (_: any, record: any) => (
        <Space wrap>
          {record.user_roles?.map((ur: any) => (
            <Tag key={ur.role.id} color="blue">{ur.role.name}</Tag>
          ))}
        </Space>
      ) 
    },
    { 
      title: 'Joined', 
      dataIndex: 'created_at', 
      render: (v: string) => dayjs(v).format('DD MMM YYYY') 
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} size="small" />
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
          >
            Reset
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>User Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Add User
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={users?.data} 
        rowKey="id" 
        loading={usersLoading} 
      />

      <Modal
        title={editingUserId ? "Edit User" : "Add User"}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="full_name" label="Full Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input disabled={!!editingUserId} />
          </Form.Item>
          {!editingUserId && (
            <Form.Item name="password" label="Temporary Password" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="role_ids" label="Roles">
            <Select mode="multiple" placeholder="Select roles">
              {roles?.data?.map((r: any) => (
                <Option key={r.id} value={r.id}>{r.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="is_active" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
