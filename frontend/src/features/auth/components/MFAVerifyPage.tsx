import React, { useState } from 'react';
import { Card, Typography, Button, Input, message, Space } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';

const { Title, Text } = Typography;

import api from '../../../lib/api';

export const MFAVerifyPage: React.FC = () => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleVerify = async () => {
    if (token.length !== 6) return message.warning('Token must be 6 digits');
    
    const mfaToken = localStorage.getItem('mfa_token');
    if (!mfaToken) {
      message.error('Session expired, please login again.');
      return navigate('/login');
    }

    setLoading(true);
    try {
      const res = await api.post('/api/v1/auth/mfa/verify', { mfaToken, totpCode: token });
      const data = res.data.data;
      
      localStorage.removeItem('mfa_token');
      localStorage.setItem('refresh_token', data.refreshToken || '');
      
      setAuth({
        id: data.user.id,
        name: data.user.full_name,
        email: data.user.email,
        role: data.user.roles?.[0] || 'admin'
      } as any, data.accessToken);
      
      message.success('Verification successful');
      navigate('/');
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Invalid token. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0F0F13' }}>
      <Card className="stat-card" style={{ padding: '32px 24px', width: 400, textAlign: 'center' }}>
        <KeyOutlined style={{ fontSize: 48, color: '#8B5CF6', marginBottom: 16 }} />
        <Title level={3} style={{ marginBottom: 16 }}>Two-Step Verification</Title>
        <Text style={{ display: 'block', marginBottom: 24, color: '#94A3B8' }}>
          Enter the 6-digit verification code from your authenticator app to continue.
        </Text>
        
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Input 
            size="large"
            prefix={<KeyOutlined style={{ }} />} 
            placeholder="000000" 
            value={token}
            onChange={e => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ textAlign: 'center', letterSpacing: 8, fontSize: 24, height: 50 }}
            maxLength={6}
            onPressEnter={handleVerify}
          />
          <Button type="primary" size="large" block onClick={handleVerify} loading={loading}>
            Verify
          </Button>
          <Button type="link" onClick={() => navigate('/login')} style={{ }}>
            Back to Login
          </Button>
        </Space>
      </Card>
    </div>
  );
};
