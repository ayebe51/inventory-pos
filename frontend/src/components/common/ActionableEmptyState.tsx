import React from 'react';
import { Empty, Typography, Button, theme as antTheme } from 'antd';
import { FileSearchOutlined, PlusOutlined } from '@ant-design/icons';
import { useThemeStore } from '../../store/themeStore';

const { Title, Text } = Typography;

interface ActionableEmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const ActionableEmptyState: React.FC<ActionableEmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  const { token } = antTheme.useToken();
  const { isDarkMode } = useThemeStore();

  return (
    <div style={{
      padding: '48px 24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      borderRadius: 16,
      border: `1px dashed ${token.colorBorderSecondary}`,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'var(--brand-50)', color: 'var(--brand-500)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28, marginBottom: 24,
      }}>
        {icon || <FileSearchOutlined />}
      </div>
      
      <Title level={4} style={{ marginBottom: 8, fontWeight: 600 }}>{title}</Title>
      <Text type="secondary" style={{ textAlign: 'center', maxWidth: 400, marginBottom: 24 }}>
        {description}
      </Text>

      {actionLabel && onAction && (
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={onAction}
          style={{ borderRadius: 8, padding: '0 32px' }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
