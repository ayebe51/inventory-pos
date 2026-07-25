import React, { useState } from 'react';
import { Tabs, Typography } from 'antd';
import { ProductManagement } from './ProductManagement';
import { StockTransferPage } from './StockTransferPage';
import { StockOpnamePage } from './StockOpnamePage';

const { Title, Text } = Typography;

export const InventoryPage: React.FC = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Title level={3} className="page-title" style={{ marginBottom: 4 }}>
            Inventory Management
          </Title>
          <Text className="page-subtitle">Manage products, stock balance, transfers, and opname</Text>
        </div>
      </div>

      <Tabs
        defaultActiveKey="products"
        className="neon-tabs"
        items={[
          {
            key: 'products',
            label: 'Products',
            children: <ProductManagement />,
          },
          {
            key: 'transfers',
            label: 'Stock Transfers',
            children: <StockTransferPage />,
          },
          {
            key: 'opname',
            label: 'Stock Opname',
            children: <StockOpnamePage />,
          },
        ]}
      />
    </div>
  );
};
