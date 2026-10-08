import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router-dom/') ||
              id.includes('/zustand/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('/antd/') || id.includes('@ant-design')) {
              return 'vendor-antd';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('echarts') || id.includes('zrender')) {
              return 'vendor-charts';
            }
            if (
              id.includes('xlsx') ||
              id.includes('jspdf') ||
              id.includes('jspdf-autotable') ||
              id.includes('html2canvas') ||
              id.includes('canvg')
            ) {
              return 'vendor-export';
            }
            if (id.includes('@zxing') || id.includes('qrcode')) {
              return 'vendor-scanner';
            }
          }
        },
      },
    },
  },
});
