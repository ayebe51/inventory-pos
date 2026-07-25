import React from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';
import styles from './LoginPage.module.css';

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const login = useLogin();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // We'll intercept the normal login mutation here for the demo 
      // to route to MFA if they use a specific email or just always route to MFA
      if (values.email === 'admin@kiro.com') {
        // Mock MFA required
        message.info('MFA required for this account');
        navigate('/verify-mfa');
      } else {
        login.mutate({ email: values.email, password: values.password });
      }
    } catch (_) {}
  };

  return (
    <div className={styles.container}>
      <div className={styles.orb1}></div>
      <div className={styles.orb2}></div>

      <div className={styles.card} style={{ padding: '40px 32px' }}>
        <div className={styles.logoArea} style={{ justifyContent: 'center', marginBottom: 32 }}>
          <div className={styles.logoMark}>K</div>
          <div className={styles.logoText}>
            <span className={styles.logoName}>KIRO</span>
            <span className={styles.logoSub}>Enterprise ERP</span>
          </div>
        </div>

        <div className={styles.titleArea} style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ marginBottom: 4, color: '#E2E8F0' }}>Welcome back</Title>
          <Text style={{ color: '#94A3B8' }}>Sign in to access your workspace</Text>
        </div>

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Invalid email format!' }
            ]}
          >
            <Input 
              prefix={<MailOutlined style={{ color: '#64748B' }} />} 
              placeholder="you@company.com" 
              size="large"
              style={{ background: '#12121A', borderColor: '#2D2D3F', color: '#fff' }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#64748B' }} />}
              placeholder="••••••••"
              size="large"
              style={{ background: '#12121A', borderColor: '#2D2D3F', color: '#fff' }}
            />
          </Form.Item>

          <Button 
            type="primary" 
            htmlType="submit" 
            block 
            size="large" 
            loading={login.isPending}
            style={{ marginTop: 8 }}
          >
            Sign in
          </Button>
        </Form>
        
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text style={{ color: '#94A3B8', fontSize: 13 }}>
            Use <Text code>admin@kiro.com</Text> to test MFA flow.
          </Text>
        </div>

        <p className={styles.footer} style={{ marginTop: 40, color: '#475569' }}>
          KIRO ERP &copy; {new Date().getFullYear()} — All rights reserved
        </p>
      </div>
    </div>
  );
};
