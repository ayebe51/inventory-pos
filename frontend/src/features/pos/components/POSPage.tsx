import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Card, Row, Col, Button, Typography, Divider, Tag,
  Space, Modal, InputNumber, Statistic, Input,
  message, theme as antTheme, Badge, Grid, Segmented, Tooltip,
} from 'antd';
import type { InputRef } from 'antd';
import {
  ShoppingCartOutlined, DeleteOutlined, PlayCircleOutlined,
  DollarOutlined, QrcodeOutlined, BarcodeOutlined,
  MinusOutlined, PlusOutlined, PrinterOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { usePOSStore } from '../store/posStore';
import { useProducts } from '../../inventory/hooks/useInventory';
import { useActiveShift, useCheckout, usePOSConfig } from '../hooks/usePOS';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { useAuthStore } from '../../../store/authStore';

const { Title, Text } = Typography;

const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash', icon: <DollarOutlined /> },
  { key: 'TRANSFER', label: 'Transfer', icon: <QrcodeOutlined /> },
  { key: 'CARD', label: 'Card / EDC', icon: <BarcodeOutlined /> },
];

interface CompletedReceipt {
  transaction_number: string;
  transaction_id: string;
  date: Date;
  cashier: string;
  branch: string;
  items: Array<{ name: string; qty: number; price: number; subtotal: number }>;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  change: number;
  paymentMethod: string;
}

export const POSPage: React.FC = () => {
  const { cart, addItem, removeItem, clearCart, updatePrice, updateQty } = usePOSStore();
  const { user } = useAuthStore();
  const { data: activeShift, isLoading: shiftLoading } = useActiveShift();
  const { data: products } = useProducts({});
  const { data: posConfig } = usePOSConfig();
  const checkout = useCheckout();
  const { token } = antTheme.useToken();
  const navigate = useNavigate();

  const [paymentModal, setPaymentModal] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<CompletedReceipt | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cashPaid, setCashPaid] = useState(0);
  const [selectedMethod, setSelectedMethod] = useState<string>('CASH');
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<InputRef>(null);

  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');

  // Query inventory balance for the shift's warehouse
  const { data: stockReport } = useQuery({
    queryKey: ['pos', 'stock-position', activeShift?.warehouse_id],
    queryFn: () => {
      const qs = activeShift?.warehouse_id ? `?warehouse_id=${activeShift.warehouse_id}` : '';
      return api.get(`/api/v1/reporting/inventory/position${qs}`).then((r) => r.data?.data?.items || []);
    },
    enabled: !!activeShift,
  });

  const stockMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (Array.isArray(stockReport)) {
      for (const item of stockReport) {
        map[item.product_id] = (map[item.product_id] || 0) + Number(item.qty_on_hand || 0);
      }
    }
    return map;
  }, [stockReport]);

  const getProductStock = (productId: string): number => {
    if (productId in stockMap) {
      return stockMap[productId];
    }
    if (stockReport && Array.isArray(stockReport) && stockReport.length > 0) {
      return 0;
    }
    return 999;
  };

  const canVoid = ['Owner', 'Supervisor', 'admin', 'manager', 'Sys_Admin'].includes(user?.role || '');
  const canOverridePrice = ['Owner', 'Supervisor', 'admin', 'manager', 'Sys_Admin'].includes(user?.role || '');

  const subtotal = cart.reduce((sum: number, item: any) => sum + item.qty * item.price, 0);
  const taxPct = (posConfig?.tax_pct ?? 11) / 100;
  const tax = Math.round(subtotal * taxPct);
  const total = subtotal + tax;
  const change = cashPaid - total;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if inside an input or modal, unless it's a global hotkey that should override
      const activeEl = document.activeElement as HTMLElement;
      const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';

      // F2 to process payment
      if (e.key === 'F2') {
        e.preventDefault();
        if (cart.length > 0) setPaymentModal(true);
      }
      // F3 to focus search
      if (e.key === 'F3') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // F4 to open barcode scanner
      if (e.key === 'F4') {
        e.preventDefault();
        setScannerOpen(true);
      }
      // ESC to clear cart (only if no modal is open and not typing)
      if (e.key === 'Escape' && !isInput && !paymentModal && !scannerOpen) {
        e.preventDefault();
        if (cart.length > 0) {
          clearCart();
          message.info('Cart cleared');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, clearCart, paymentModal, scannerOpen]);

  const filteredProducts = products?.data?.filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddItem = (product: any) => {
    const stock = getProductStock(product.id);
    if (stock <= 0) {
      message.warning(`Stok "${product.name}" habis di gudang kasir`);
      return;
    }
    const currentInCart = cart.find((i) => i.id === product.id)?.qty || 0;
    if (currentInCart + 1 > stock) {
      message.warning(`Stok tidak mencukupi (Tersedia: ${stock})`);
      return;
    }
    addItem({
      id: product.id,
      name: product.name,
      price: product.selling_price,
      sku: product.sku || '',
      uom_id: product.uom_id || '00000000-0000-0000-0000-000000000000',
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
      const paymentAmount = selectedMethod === 'CASH' ? cashPaid : total;
      const res = await checkout.mutateAsync({
        shift_id: activeShift.id,
        items: cart.map((i) => ({
          product_id: i.id,
          quantity: i.qty,
          unit_price: i.price,
        })),
        payments: [{ method: selectedMethod, amount: paymentAmount }],
      });

      const receiptTxNumber = res?.transaction_number || `TRX-${Date.now().toString().slice(-6)}`;
      const completed: CompletedReceipt = {
        transaction_number: receiptTxNumber,
        transaction_id: res?.transaction_id || '',
        date: new Date(),
        cashier: user?.name || user?.email || 'Kasir',
        branch: activeShift?.branch?.name || 'Main Branch',
        items: cart.map((i) => ({
          name: i.name,
          qty: i.qty,
          price: i.price,
          subtotal: i.qty * i.price,
        })),
        subtotal,
        tax,
        total,
        paid: paymentAmount,
        change: Math.max(0, paymentAmount - total),
        paymentMethod: selectedMethod,
      };

      setCompletedReceipt(completed);
      setReceiptModal(true);
      clearCart();
      setPaymentModal(false);
      setCashPaid(0);
      message.success('Transaksi berhasil diselesaikan!');
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
          <Title level={4} style={{ marginBottom: 8 }}>No Active Shift</Title>
          <Text style={{ display: 'block', marginBottom: 24 }}>
            You must open a shift before processing POS transactions.
          </Text>
          <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={() => navigate('/pos/shift')}>
            Open Shift
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', minHeight: 0, flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden', position: 'relative' }}>
      {/* Mobile Segmented Control */}
      {isMobile && (
        <div style={{ padding: '8px 12px', background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}`, flexShrink: 0 }}>
          <Segmented
            block
            value={mobileTab}
            onChange={(val) => setMobileTab(val as 'catalog' | 'cart')}
            options={[
              { label: 'Product Catalog', value: 'catalog', icon: <BarcodeOutlined /> },
              { label: `Current Order (${cart.length})`, value: 'cart', icon: <ShoppingCartOutlined /> },
            ]}
          />
        </div>
      )}

      {/* Left: Product Catalog */}
      {(!isMobile || mobileTab === 'catalog') && (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          paddingTop: isMobile ? 12 : 16,
          paddingLeft: isMobile ? 12 : 16,
          paddingRight: isMobile ? 12 : 16,
          paddingBottom: isMobile && cart.length > 0 ? 76 : (isMobile ? 12 : 16),
        }}>
          <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Title level={5} style={{ margin: 0 }}>Product Catalog</Title>
            {activeShift && (
              <Tag style={{ color: '#34D399', background: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.2)' }}>
                Shift Active
              </Tag>
            )}
          </div>
          <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
            <Input
              ref={searchInputRef}
              placeholder={isMobile ? "Search product..." : "Search product (F3)..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              style={{ flex: 1 }}
            />
            <Button
              icon={<BarcodeOutlined />}
              onClick={() => setScannerOpen(true)}
              aria-label={isMobile ? "Scan barcode" : "Scan barcode (F4)"}
            >
              {isMobile ? 'Scan' : 'Scan (F4)'}
            </Button>
          </div>
          <Row gutter={[8, 8]}>
            {filteredProducts?.map((product: any) => {
              const stock = getProductStock(product.id);
              const isOutOfStock = stock <= 0;
              return (
                <Col key={product.id} xs={12} sm={8} md={8} lg={6}>
                  <Card
                    className="stat-card"
                    style={{
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      opacity: isOutOfStock ? 0.6 : 1,
                      position: 'relative',
                    }}
                    styles={{ body: { padding: 12 } }}
                    onClick={() => {
                      if (isOutOfStock) {
                        message.warning(`Stok "${product.name}" habis di gudang kasir`);
                        return;
                      }
                      handleAddItem(product);
                    }}
                    hoverable={!isOutOfStock}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                      <Tooltip title={product.code}>
                        <Text
                          ellipsis
                          style={{
                            color: 'var(--brand-500)',
                            fontSize: 10,
                            fontWeight: 600,
                            maxWidth: '65%',
                            display: 'inline-block',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {product.code}
                        </Text>
                      </Tooltip>
                      {isOutOfStock ? (
                        <Tag color="error" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', borderRadius: 4, lineHeight: '18px' }}>
                          Habis
                        </Tag>
                      ) : stock <= 5 ? (
                        <Tag color="warning" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', borderRadius: 4, lineHeight: '18px' }}>
                          Sisa {stock}
                        </Tag>
                      ) : (
                        <Tag color="success" style={{ fontSize: 9.5, margin: 0, padding: '0 4px', borderRadius: 4, lineHeight: '18px' }}>
                          Stok {stock}
                        </Tag>
                      )}
                    </div>
                    <Text
                      ellipsis={{ tooltip: product.name }}
                      style={{ fontSize: 13, fontWeight: 500, display: 'block', marginTop: 4 }}
                    >
                      {product.name}
                    </Text>
                    <Text className="number-display" style={{ color: 'var(--brand-500)', fontSize: 13, fontWeight: 700, display: 'block', marginTop: 4 }}>
                      Rp {Number(product.selling_price || 0).toLocaleString('id-ID')}
                    </Text>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
      )}

      {/* Right: Cart */}
      {(!isMobile || mobileTab === 'cart') && (
        <div style={{
          width: isMobile ? '100%' : 360,
          flex: isMobile ? 1 : 'none',
          background: token.colorBgContainer,
          borderLeft: isMobile ? 'none' : `1px solid ${token.colorBorderSecondary}`,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* Cart Header */}
          <div style={{ padding: '16px', borderBottom: `1px solid ${token.colorBorderSecondary}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <ShoppingCartOutlined style={{ color: '#F05328', fontSize: 18 }} />
                <Text style={{ fontWeight: 600 }}>Current Order</Text>
                <Badge count={cart.length} style={{ background: '#F05328' }} />
              </Space>
              <Button type="text" size="small" onClick={clearCart} style={{ color: '#F43F5E' }} disabled={!canVoid && cart.length > 0}>
                Clear
              </Button>
            </div>
          </div>

          {/* Cart Items */}
          <div style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', padding: '8px 16px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', paddingTop: 40, color: '#475569' }}>
                <ShoppingCartOutlined style={{ fontSize: 36, opacity: 0.3 }} />
                <div style={{ marginTop: 12, fontSize: 13 }}>Cart is empty</div>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </Text>

                    {/* Stepper Controls & Price */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--solid-bg-subtle, #F1F5F9)', borderRadius: 8, border: `1px solid ${token.colorBorderSecondary}`, padding: '2px' }}>
                        <Button
                          type="text"
                          size="small"
                          icon={<MinusOutlined style={{ fontSize: 11 }} />}
                          onClick={() => {
                            if (item.qty <= 1 && !canVoid) {
                              message.warning('Minimal 1 item, atau butuh hak akses void');
                              return;
                            }
                            updateQty(item.id, item.qty - 1);
                          }}
                          style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
                          title="Kurangi kuantitas"
                        />
                        <InputNumber
                          size="small"
                          min={1}
                          max={getProductStock(item.id)}
                          value={item.qty}
                          onChange={(val) => {
                            if (val !== null && val > 0) {
                              const stock = getProductStock(item.id);
                              if (val > stock) {
                                message.warning(`Maksimal ${stock} item tersedia`);
                                updateQty(item.id, stock);
                              } else {
                                updateQty(item.id, Math.floor(val));
                              }
                            }
                          }}
                          controls={false}
                          style={{ width: 38, height: 28, textAlign: 'center', fontSize: 13, fontWeight: 600, padding: 0, border: 'none', background: 'transparent' }}
                        />
                        <Button
                          type="text"
                          size="small"
                          icon={<PlusOutlined style={{ fontSize: 11 }} />}
                          onClick={() => {
                            const stock = getProductStock(item.id);
                            if (item.qty + 1 > stock) {
                              message.warning(`Stok tidak mencukupi (Tersedia: ${stock})`);
                              return;
                            }
                            updateQty(item.id, item.qty + 1);
                          }}
                          style={{ width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
                          title="Tambah kuantitas"
                        />
                      </div>

                      {canOverridePrice ? (
                        <InputNumber 
                          size="small" 
                          prefix="Rp" 
                          value={item.price} 
                          onChange={(val) => val !== null && updatePrice(item.id, val)}
                          style={{ width: 90 }}
                        />
                      ) : (
                        <Text className="number-display" style={{ fontSize: 12, color: token.colorTextSecondary }}>
                          @ Rp {Number(item.price || 0).toLocaleString('id-ID')}
                        </Text>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <Text className="number-display" style={{ color: '#F05328', fontWeight: 700, minWidth: 70, textAlign: 'right', fontSize: 13 }}>
                      Rp {(item.qty * Number(item.price || 0)).toLocaleString('id-ID')}
                    </Text>
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      danger
                      onClick={() => removeItem(item.id)}
                      disabled={!canVoid}
                      style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Hapus baris item"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals & Checkout Button */}
          <div style={{ padding: 16, borderTop: `1px solid ${token.colorBorderSecondary}`, flexShrink: 0, background: token.colorBgContainer }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Row justify="space-between">
                <Text style={{ }}>Subtotal</Text>
                <Text className="number-display" style={{ }}>Rp {subtotal.toLocaleString('id-ID')}</Text>
              </Row>
              <Row justify="space-between">
                <Text style={{ }}>PPN (11%)</Text>
                <Text className="number-display" style={{ color: '#FBBF24' }}>Rp {tax.toLocaleString('id-ID')}</Text>
              </Row>
              <Divider style={{ borderColor: token.colorBorderSecondary, margin: '8px 0' }} />
              <Row justify="space-between">
                <Text style={{ fontWeight: 700, fontSize: 16 }}>TOTAL</Text>
                <Text className="number-display" style={{ color: '#F05328', fontWeight: 700, fontSize: 18 }}>
                  Rp {total.toLocaleString('id-ID')}
                </Text>
              </Row>
              <Button
                type="primary"
                size="large"
                block
                disabled={cart.length === 0}
                onClick={() => setPaymentModal(true)}
                style={{ marginTop: 8, height: 48, fontSize: 16 }}
              >
                Process Payment
              </Button>
            </Space>
          </div>
        </div>
      )}

      {/* Mobile Floating Bottom Bar when viewing Catalog with items in Cart */}
      {isMobile && mobileTab === 'catalog' && cart.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          right: 12,
          background: 'linear-gradient(135deg, #18181B 0%, #27272A 100%)',
          borderRadius: 14,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          zIndex: 100,
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#A1A1AA' }}>{cart.length} item di pesanan</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F05328' }}>Rp {total.toLocaleString('id-ID')}</div>
          </div>
          <Button
            type="primary"
            onClick={() => setMobileTab('cart')}
            style={{ borderRadius: 8, height: 36, fontWeight: 600, background: 'linear-gradient(135deg, #F05328 0%, #D94119 100%)', border: 'none' }}
          >
            Lihat Pesanan
          </Button>
        </div>
      )}

      {/* Payment Modal */}
      <Modal
        title="Process Payment"
        open={paymentModal}
        onCancel={() => setPaymentModal(false)}
        footer={null}
        destroyOnHidden
        width={420}
      >
        <div style={{ marginBottom: 20 }}>
          <Text style={{ display: 'block', marginBottom: 12 }}>Payment Method</Text>
          <Row gutter={8}>
            {PAYMENT_METHODS.map((method) => (
              <Col span={8} key={method.key}>
                <Card
                  className="stat-card"
                  style={{
                    cursor: 'pointer',
                    textAlign: 'center',
                    borderColor: selectedMethod === method.key ? '#F05328' : token.colorBorderSecondary,
                    boxShadow: selectedMethod === method.key ? '0 0 16px rgba(240,83,40,0.25)' : 'none',
                  }}
                  styles={{ body: { padding: 12 } }}
                  onClick={() => setSelectedMethod(method.key)}
                >
                  <div style={{ color: selectedMethod === method.key ? '#F05328' : token.colorTextSecondary, fontSize: 20 }}>{method.icon}</div>
                  <Text style={{ fontSize: 12, fontWeight: selectedMethod === method.key ? 600 : 400 }}>{method.label}</Text>
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
          styles={{ content: { color: '#F05328', fontSize: 28, fontWeight: 700 } }}
          style={{ marginBottom: 16 }}
        />

        {selectedMethod === 'CASH' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <Text style={{ display: 'block', marginBottom: 8 }}>Cash Received (Rp)</Text>
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

      {/* Receipt & Thermal Print Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PrinterOutlined style={{ color: '#F05328' }} />
            <span>Struk Pembayaran / Thermal Receipt</span>
          </div>
        }
        open={receiptModal}
        onCancel={() => setReceiptModal(false)}
        width={400}
        footer={[
          <Button
            key="new"
            size="large"
            onClick={() => {
              setReceiptModal(false);
              setMobileTab('catalog');
            }}
          >
            Transaksi Baru
          </Button>,
          <Button
            key="print"
            type="primary"
            size="large"
            icon={<PrinterOutlined />}
            onClick={() => window.print()}
            style={{ background: 'linear-gradient(135deg, #F05328 0%, #D94119 100%)', border: 'none' }}
          >
            Cetak Struk (Print)
          </Button>,
        ]}
        destroyOnHidden
      >
        <div id="thermal-receipt-wrapper" style={{ padding: '8px 0', display: 'flex', justifyContent: 'center' }}>
          <div
            id="thermal-receipt"
            style={{
              width: '100%',
              maxWidth: 320,
              background: '#FFFFFF',
              color: '#111827',
              padding: '16px 14px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
              fontSize: 12,
              lineHeight: 1.4,
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              border: '1px solid #E2E8F0',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.05em', color: '#0F172A' }}>
                INVENTORY + POS
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>{completedReceipt?.branch || 'STORE & RETAIL'}</div>
              <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Bukti Pembayaran Transaksi Kasir</div>
            </div>

            <div style={{ borderTop: '1px dashed #94A3B8', margin: '8px 0' }} />

            <div style={{ fontSize: 10.5, color: '#334155', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>No. Transaksi:</span>
                <span style={{ fontWeight: 700 }}>{completedReceipt?.transaction_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Waktu:</span>
                <span>{completedReceipt?.date ? new Date(completedReceipt.date).toLocaleString('id-ID') : '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Kasir:</span>
                <span>{completedReceipt?.cashier}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #94A3B8', margin: '8px 0' }} />

            {/* Item List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {completedReceipt?.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: '#1E293B' }}>{item.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569' }}>
                    <span>{item.qty} x Rp {item.price.toLocaleString('id-ID')}</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>Rp {item.subtotal.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px dashed #94A3B8', margin: '10px 0' }} />

            {/* Subtotal, Tax, Total, Payment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11, color: '#334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>Rp {completedReceipt?.subtotal.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>PPN / Pajak (11%):</span>
                <span>Rp {completedReceipt?.tax.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 13, borderTop: '1px solid #CBD5E1', paddingTop: 4, marginTop: 2, color: '#0F172A' }}>
                <span>TOTAL:</span>
                <span>Rp {completedReceipt?.total.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span>Bayar ({completedReceipt?.paymentMethod}):</span>
                <span>Rp {completedReceipt?.paid.toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0F172A' }}>
                <span>Kembalian:</span>
                <span>Rp {completedReceipt?.change.toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #94A3B8', margin: '12px 0 8px' }} />

            <div style={{ textAlign: 'center', fontSize: 10, color: '#475569' }}>
              <div style={{ fontWeight: 600 }}>*** TERIMA KASIH ***</div>
              <div style={{ fontSize: 9, marginTop: 2 }}>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</div>
            </div>
          </div>
        </div>
      </Modal>

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt, #thermal-receipt * {
            visibility: visible !important;
          }
          #thermal-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            box-shadow: none !important;
            border: none !important;
            padding: 4px !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  );
};
