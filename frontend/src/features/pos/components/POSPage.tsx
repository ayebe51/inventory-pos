import React, { useState } from 'react';
import {
  Card, Row, Col, Button, Typography, Divider, Tag,
  Space, Modal, InputNumber, Form, List, Badge, Statistic,
  message, Drawer, Tabs,
} from 'antd';
import {
  PlusOutlined, ShoppingCartOutlined, DeleteOutlined,
  PauseCircleOutlined, PlayCircleOutlined, StopOutlined,
  DollarOutlined, QrcodeOutlined, BarcodeOutlined,
} from '@ant-design/icons';
import { usePOSStore } from '../store/posStore';
import { useProducts } from '../../inventory/hooks/useInventory';
import { useActiveShift, useCheckout } from '../hooks/usePOS';
import { BarcodeScannerModal } from './BarcodeScannerModal';

const { Title, Text } = Typography;

const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash', icon: <DollarOutlined /> },
  { key: 'TRANSFER', label: 'Transfer', icon: <QrcodeOutlined /> },
  { key: 'EDC', label: 'Card/EDC', icon: <BarcodeOutlined /> },
];

export const POSPage: React.FC = () => {
  const { cartItems, addItem, removeItem, clearCart } = usePOSStore();
  const { data: activeShift, isLoading: shiftLoading } = useActiveShift();
  const { data: products } = useProducts({});
  const checkout = useCheckout();

  const [paymentModal, setPaymentModal] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cashPaid, setCashPaid] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string>('CASH');

  const subtotal = cartItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const tax = Math.round(subtotal * 0.11);
  const total = subtotal + tax;
  const change = cashPaid - total;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 to clear cart
      if (e.key === 'F2') {
        e.preventDefault();
        clearCart();
        message.info('Cart cleared');
      }
      // F4 to open barcode scanner
      if (e.key === 'F4') {
        e.preventDefault();
        setScannerOpen(true);
      }
      // F12 to process payment
      if (e.key === 'F12') {
        e.preventDefault();
        if (cartItems.length > 0) setPaymentModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cartItems.length, clearCart]);

  const handleAddItem = (product: any) => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.selling_price,
      quantity: 1,
    });
  };

  const handleScan = (code: string) => {
    const product = products?.data?.find((p: any) => p.code === code || p.barcode === code);
    if (product) {
      handleAddItem(product);
      message.success(`Scanned: ${product.name}`);
    } else {
      message.warning(`Product with code ${code} not found`);
    }
  };

  const handleCheckout = async () => {
    if (!activeShift) return message.error('No active shift!');
    try {
      await checkout.mutateAsync({
        shift_id: activeShift.id,
        items: cartItems.map((i) => ({
          product_id: i.id,
          quantity: i.quantity,
          unit_price: i.price,
        })),
        payments: [{ method: selectedMethod, amount: cashPaid }],
      });
      message.success('Transaction completed!');
      clearCart();
      setPaymentModal(false);
    } catch (err: any) {
      message.error(err?.message || 'Checkout failed');
    }
  };

  // If no shift or loading, show shift gate
  if (!shiftLoading && !activeShift) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 64px)' }}>
        <Card className="stat-card" style={{ maxWidth: 420, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
          <Title level={4} style={{ color: '#E2E8F0', marginBottom: 8 }}>No Active Shift</Title>
          <Text style={{ color: '#64748B', display: 'block', marginBottom: 24 }}>
            You must open a shift before processing POS transactions.
          </Text>
          <Button type="primary" size="large" icon={<PlayCircleOutlined />}>
            Open Shift
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', overflow: 'hidden' }}>
      {/* Left: Product Catalog */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Title level={5} style={{ color: '#E2E8F0', margin: 0 }}>Product Catalog</Title>
          {activeShift && (
            <Tag style={{ color: '#34D399', background: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.2)' }}>
              Shift Active
            </Tag>
          )}
        </div>
        <Row gutter={[8, 8]}>
          {products?.data?.map((product: any) => (
            <Col key={product.id} xs={12} sm={8} md={8} lg={6}>
              <Card
                className="stat-card"
                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                bodyStyle={{ padding: 12 }}
                onClick={() => handleAddItem(product)}
                hoverable
              >
                <Text style={{ color: '#A78BFA', fontSize: 10, display: 'block' }}>{product.code}</Text>
                <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 500, display: 'block', marginTop: 2 }}>
                  {product.name}
                </Text>
                <Text style={{ color: '#8B5CF6', fontSize: 13, fontWeight: 700, display: 'block', marginTop: 4 }}>
                  Rp {product.selling_price?.toLocaleString('id-ID')}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* Right: Cart */}
      <div style={{
        width: 360,
        background: '#12121A',
        borderLeft: '1px solid #2D2D3F',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Cart Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #1E1E2E' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <ShoppingCartOutlined style={{ color: '#8B5CF6', fontSize: 18 }} />
              <Text style={{ color: '#E2E8F0', fontWeight: 600 }}>Current Order</Text>
              <Badge count={cartItems.length} style={{ background: '#8B5CF6' }} />
            </Space>
            <Button type="text" size="small" onClick={clearCart} style={{ color: '#F43F5E' }}>
              Clear
            </Button>
          </div>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {cartItems.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 40, color: '#475569' }}>
              <ShoppingCartOutlined style={{ fontSize: 36, opacity: 0.3 }} />
              <div style={{ marginTop: 12, fontSize: 13 }}>Cart is empty</div>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid #1E1E2E',
              }}>
                <div style={{ flex: 1 }}>
                  <Text style={{ color: '#E2E8F0', fontSize: 13, display: 'block' }}>{item.name}</Text>
                  <Text style={{ color: '#64748B', fontSize: 12 }}>
                    {item.quantity} × Rp {item.price.toLocaleString('id-ID')}
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: '#8B5CF6', fontWeight: 600, minWidth: 80, textAlign: 'right' }}>
                    Rp {(item.quantity * item.price).toLocaleString('id-ID')}
                  </Text>
                  <Button type="text" size="small" icon={<DeleteOutlined />} danger onClick={() => removeItem(item.id)} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div style={{ padding: 16, borderTop: '1px solid #1E1E2E' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Row justify="space-between">
              <Text style={{ color: '#64748B' }}>Subtotal</Text>
              <Text className="number-display" style={{ color: '#E2E8F0' }}>Rp {subtotal.toLocaleString('id-ID')}</Text>
            </Row>
            <Row justify="space-between">
              <Text style={{ color: '#64748B' }}>PPN (11%)</Text>
              <Text className="number-display" style={{ color: '#FBBF24' }}>Rp {tax.toLocaleString('id-ID')}</Text>
            </Row>
            <Divider style={{ borderColor: '#2D2D3F', margin: '8px 0' }} />
            <Row justify="space-between">
              <Text style={{ color: '#E2E8F0', fontWeight: 700, fontSize: 16 }}>TOTAL</Text>
              <Text className="number-display" style={{ color: '#8B5CF6', fontWeight: 700, fontSize: 18 }}>
                Rp {total.toLocaleString('id-ID')}
              </Text>
            </Row>
            <Button
              type="primary"
              size="large"
              block
              disabled={cartItems.length === 0}
              onClick={() => setPaymentModal(true)}
              style={{ marginTop: 8, height: 48, fontSize: 16 }}
            >
              Process Payment
            </Button>
          </Space>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        title="Process Payment"
        open={paymentModal}
        onCancel={() => setPaymentModal(false)}
        footer={null}
        width={420}
      >
        <div style={{ marginBottom: 20 }}>
          <Text style={{ color: '#64748B', display: 'block', marginBottom: 12 }}>Payment Method</Text>
          <Row gutter={8}>
            {PAYMENT_METHODS.map((method) => (
              <Col span={8} key={method.key}>
                <Card
                  className="stat-card"
                  style={{
                    cursor: 'pointer',
                    textAlign: 'center',
                    borderColor: selectedMethod === method.key ? '#8B5CF6' : '#2D2D3F',
                    boxShadow: selectedMethod === method.key ? '0 0 16px rgba(139,92,246,0.3)' : 'none',
                  }}
                  bodyStyle={{ padding: 12 }}
                  onClick={() => setSelectedMethod(method.key)}
                >
                  <div style={{ color: '#8B5CF6', fontSize: 20 }}>{method.icon}</div>
                  <Text style={{ color: '#E2E8F0', fontSize: 12 }}>{method.label}</Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        <Statistic
          title="Total to Pay"
          value={total}
          prefix="Rp"
          formatter={(v) => (v as number).toLocaleString('id-ID')}
          valueStyle={{ color: '#8B5CF6', fontSize: 28, fontWeight: 700 }}
          style={{ marginBottom: 16 }}
        />

        {selectedMethod === 'CASH' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <Text style={{ color: '#64748B', display: 'block', marginBottom: 8 }}>Cash Received (Rp)</Text>
              <InputNumber
                size="large"
                style={{ width: '100%' }}
                value={cashPaid}
                onChange={(v) => setCashPaid(v || 0)}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                min={0}
              />
            </div>
            {cashPaid >= total && (
              <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                <Text style={{ color: '#34D399', fontSize: 16, fontWeight: 600 }}>
                  Change: Rp {change.toLocaleString('id-ID')}
                </Text>
              </div>
            )}
          </>
        )}

        <Button
          type="primary"
          size="large"
          block
          disabled={selectedMethod === 'CASH' && cashPaid < total}
          loading={checkout.isPending}
          onClick={handleCheckout}
          style={{ height: 48 }}
        >
          Confirm Payment
        </Button>
      </Modal>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  );
};
