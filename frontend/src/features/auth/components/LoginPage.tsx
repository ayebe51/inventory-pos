import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { Mail, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLogin } from '../hooks/useAuth';

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const login = useLogin();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsLoading(true);
      const values = await form.validateFields();
      if (values.email === 'admin@kiro.com') {
        message.info('MFA required for this account');
        navigate('/verify-mfa');
        return;
      }
      login.mutate({ email: values.email, password: values.password });
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-app)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Atmospheric orbs — subtle depth only */}
      <div style={{
        position: 'absolute',
        top: '-10%', left: '-5%',
        width: '50%', height: '60%',
        background: 'radial-gradient(ellipse, rgba(79,70,229,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%', right: '-5%',
        width: '45%', height: '55%',
        background: 'radial-gradient(ellipse, rgba(99,102,241,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Login Card — SOLID, not glass (it's a form = workspace) */}
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--solid-bg)',
        border: '1px solid var(--solid-border)',
        borderRadius: 24,
        boxShadow: 'var(--shadow-lg)',
        padding: '40px 36px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 42, height: 42,
            borderRadius: 12,
            background: 'var(--brand-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: '#fff',
            boxShadow: '0 4px 12px var(--brand-glow)',
            letterSpacing: '-0.03em',
            flexShrink: 0,
          }}>
            K
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Kiro ERP
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 500 }}>
              Enterprise
            </div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.025em',
            margin: 0, marginBottom: 5,
            lineHeight: 1.25,
          }}>
            Sign in to your account
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: 0 }}>
            Enter your credentials to access the workspace.
          </p>
        </div>

        {/* Form */}
        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="email"
            label="Work email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
            style={{ marginBottom: 16 }}
          >
            <Input
              prefix={<Mail size={14} style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="you@company.com"
              size="large"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Password is required' }]}
            style={{ marginBottom: 24 }}
          >
            <Input.Password
              prefix={<Lock size={14} style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="••••••••••"
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={login.isPending || isLoading}
            style={{ height: 44, fontSize: 14, fontWeight: 600, borderRadius: 10 }}
          >
            Sign in
          </Button>
        </Form>

        {/* Divider */}
        <div style={{
          margin: '24px 0 0',
          padding: '18px 16px',
          background: 'var(--solid-bg-subtle)',
          border: '1px solid var(--solid-border)',
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
            Demo credentials
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Email</span>
              <code style={{ fontSize: 11 }}>admin@example.com</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Password</span>
              <code style={{ fontSize: 11 }}>Admin@123456</code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', margin: '20px 0 0' }}>
          Kiro ERP &copy; {new Date().getFullYear()} — All rights reserved
        </p>
      </div>
    </div>
  );
};
