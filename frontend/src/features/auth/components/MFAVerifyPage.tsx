import React, { useState } from 'react';
import { Card, Typography, Button, Input, message, Space } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../../store/authStore';
import api from '../../../lib/api';

const { Title, Text } = Typography;

export const MFAVerifyPage: React.FC = () => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleVerify = async () => {
    if (token.length !== 6) return message.warning('Token must be 6 digits');
    
    setLoading(true);
    try {
      // Mocked endpoint for MFA verification during login
      // const res = await api.post('/auth/mfa/verify-login', { token });
      
      // Simulating success
      setTimeout(() => {
        message.success('Verification successful');
        // We simulate that the user was in a partial login state and now we fully authenticate them
        setAuth({ id: '1', name: 'Admin User', role: 'ADMIN' }, 'mock-jwt-token-after-mfa');
        navigate('/');
        setLoading(false);
      }, 1000);
    } catch (e) {
      message.error('Invalid token. Please try again.');
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
            prefix={<KeyOutlined style={{ color: '#64748B' }} />} 
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
          <Button type="link" onClick={() => navigate('/login')} style={{ color: '#64748B' }}>
            Back to Login
          </Button>
        </Space>
      </Card>
    </div>
  );
};
