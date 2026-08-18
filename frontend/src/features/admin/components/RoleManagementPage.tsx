import React, { useState } from 'react';
import {
  Table, Typography, Button, Input, Space, Tag, Modal, Form, Select, Switch, message
} from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusOutlined, EditOutlined
} from '@ant-design/icons';
import { api } from '../../../lib/api';
import dayjs from 'dayjs';

const { Title } = Typography;

export const RoleManagementPage: React.FC = () => {
  const qc = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // Queries
  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => api.get('/api/v1/admin/roles').then((r: any) => r.data)
  });

  const { data: permissions } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () => api.get('/api/v1/admin/permissions').then((r: any) => r.data)
  });

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

  const columns = [
    { title: 'Role Name', dataIndex: 'name' },
    { title: 'Description', dataIndex: 'description' },
    { 
      title: 'Users Count', 
      dataIndex: '_count', 
      render: (v: any) => <Tag color="blue">{v?.user_roles || 0} users</Tag> 
    },
    { 
      title: 'Status', 
      dataIndex: 'is_active', 
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? 'ACTIVE' : 'INACTIVE'}</Tag>
      ) 
    },
    { 
      title: 'Created', 
      dataIndex: 'created_at', 
      render: (v: string) => dayjs(v).format('DD MMM YYYY') 
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} size="small" />
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>Role Management</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
          Add Role
        </Button>
      </div>

      <Table 
        columns={columns} 
        dataSource={roles?.data} 
        rowKey="id" 
        loading={rolesLoading} 
      />

      <Modal
        title={editingRoleId ? "Edit Role" : "Add Role"}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Role Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="permission_ids" label="Permissions">
            <Select 
              mode="multiple" 
              placeholder="Select permissions" 
              options={permissions?.data?.map((p: any) => ({
                label: `${p.module}.${p.action}`,
                value: p.id
              }))}
              filterOption={(input, option) =>
                String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="is_active" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
