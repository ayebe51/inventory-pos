import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import App from './App';
import './index.css';

const { darkAlgorithm } = theme;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: darkAlgorithm,
        token: {
          colorPrimary: '#8B5CF6',
          colorLink: '#8B5CF6',
          colorBgBase: '#0F0F13',
          colorBgContainer: '#1A1A24',
          colorBgElevated: '#1E1E2E',
          colorBorder: '#2D2D3F',
          colorBorderSecondary: '#252535',
          colorText: '#E2E8F0',
          colorTextSecondary: '#94A3B8',
          colorTextTertiary: '#64748B',
          fontFamily: "'Inter', 'Space Grotesk', -apple-system, sans-serif",
          borderRadius: 8,
          borderRadiusLG: 12,
          wireframe: false,
        },
        components: {
          Layout: {
            siderBg: '#12121A',
            triggerBg: '#8B5CF6',
          },
          Menu: {
            darkItemBg: '#12121A',
            darkSubMenuItemBg: '#0F0F13',
            darkItemSelectedBg: 'rgba(139, 92, 246, 0.15)',
            darkItemSelectedColor: '#8B5CF6',
            darkItemHoverBg: 'rgba(139, 92, 246, 0.08)',
            darkItemColor: '#94A3B8',
            itemHeight: 44,
          },
          Table: {
            headerBg: '#1A1A24',
            rowHoverBg: 'rgba(139, 92, 246, 0.05)',
          },
          Button: {
            primaryColor: '#fff',
          },
          Card: {
            colorBgContainer: '#1A1A24',
          },
          Modal: {
            contentBg: '#1A1A24',
            headerBg: '#1A1A24',
          },
          Drawer: {
            colorBgContainer: '#1A1A24',
          },
          Input: {
            colorBgContainer: '#12121A',
          },
          Select: {
            colorBgContainer: '#12121A',
          },
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
