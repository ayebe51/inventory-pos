import React, { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { Mail, Lock, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { useLogin } from '../hooks/useAuth';

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const login = useLogin();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      login.reset();
      setIsLoading(true);
      const values = await form.validateFields();
      login.mutate({ email: values.email, password: values.password });
    } catch (_) {
      // Form validation error
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    login.reset();
    form.setFieldsValue({
      email: 'admin@example.com',
      password: 'Admin@123456',
    });
  };

  const getErrorMessage = () => {
    if (!login.error) return null;
    const err = login.error as any;
    return err.response?.data?.message || err.response?.data?.error?.message || 'Invalid email or password. Please try again.';
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
      {/* Dynamic Background Glow Mesh */}
      <div style={{
        position: 'absolute',
        top: '-15%',
        left: '20%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.03) 50%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-15%',
        right: '20%',
        width: '450px',
        height: '450px',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(99, 102, 241, 0.02) 50%, transparent 70%)',
        filter: 'blur(60px)',
        pointerEvents: 'none',
      }} />

      {/* Login Card */}
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--solid-bg)',
        border: '1px solid var(--solid-border)',
        borderRadius: 24,
        boxShadow: 'var(--shadow-lg), 0 0 0 1px rgba(255,255,255,0.05)',
        padding: '40px 36px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 800,
              color: '#ffffff',
              boxShadow: '0 4px 14px var(--brand-glow)',
              letterSpacing: '-0.03em',
              flexShrink: 0,
            }}>
              K
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                Kiro ERP
              </div>
              <div style={{ fontSize: 11, color: 'var(--brand-500)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                Enterprise OS
              </div>
            </div>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 999,
            background: 'var(--brand-50)',
            border: '1px solid var(--brand-200)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--brand-600)',
          }}>
            <ShieldCheck size={13} />
            <span>Secure SSL</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            margin: '0 0 6px 0',
            lineHeight: 1.2,
          }}>
            Sign in to Workspace
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
            Enter your credentials to access inventory, POS, & financial analytics.
          </p>
        </div>

        {/* Error Feedback */}
        {login.isError && (
          <Alert
            type="error"
            showIcon
            message={getErrorMessage()}
            style={{ marginBottom: 20, borderRadius: 10 }}
          />
        )}

        {/* Form */}
        <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="email"
            label="Work Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Enter a valid email address' },
            ]}
            style={{ marginBottom: 18 }}
          >
            <Input
              prefix={<Mail size={16} style={{ color: 'var(--text-tertiary)', marginRight: 6 }} />}
              placeholder="admin@example.com"
              size="large"
              autoComplete="email"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
            style={{ marginBottom: 26 }}
          >
            <Input.Password
              prefix={<Lock size={16} style={{ color: 'var(--text-tertiary)', marginRight: 6 }} />}
              placeholder="••••••••••••"
              size="large"
              autoComplete="current-password"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>

          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={login.isPending || isLoading}
            style={{
              height: 46,
              fontSize: 15,
              fontWeight: 700,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span>Sign In</span>
            <ArrowRight size={16} />
          </Button>
        </Form>

        {/* Demo Credentials Box with 1-Click Auto Fill */}
        <div style={{
          marginTop: 24,
          padding: '16px 18px',
          background: 'var(--solid-bg-subtle)',
          border: '1px solid var(--solid-border)',
          borderRadius: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Demo Account
            </span>
            <Button
              type="link"
              size="small"
              onClick={handleFillDemo}
              icon={<Sparkles size={13} />}
              style={{ padding: 0, height: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--brand-500)' }}
            >
              Fill Credentials
            </Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Email:</span>
              <code style={{ fontSize: 12, color: 'var(--brand-600)', background: 'var(--brand-50)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>admin@example.com</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Password:</span>
              <code style={{ fontSize: 12, color: 'var(--brand-600)', background: 'var(--brand-50)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>Admin@123456</code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', margin: '24px 0 0' }}>
          Kiro ERP &copy; {new Date().getFullYear()} — Enterprise Inventory, POS & Finance
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
