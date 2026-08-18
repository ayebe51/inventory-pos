import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Loader } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useCreatePurchaseOrder } from '../hooks/usePurchase';
import type { PurchaseOrderLine } from '../types/purchase.types';
import styles from './PurchaseDrawer.module.css';

const { Option } = Select;

interface PurchaseDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PurchaseDrawer: React.FC<PurchaseDrawerProps> = ({ isOpen, onClose }) => {
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<PurchaseOrderLine[]>([
    { product_id: '', qty_ordered: 1, uom_id: '', unit_price: 0 }
  ]);

  const { data: suppliersResponse } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/api/v1/master-data/suppliers').then((r) => r.data),
  });
  const suppliers = suppliersResponse?.data || [];

  const { data: productsResponse } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get('/api/v1/master-data/products').then((r) => r.data),
  });
  const products = productsResponse?.data || [];

  const { data: branchesResponse } = useQuery({
    queryKey: ['branches'],
    queryFn: () => api.get('/api/v1/master-data/branches').then((r) => r.data),
  });
  const branches = branchesResponse?.data || [];

  const { data: warehousesResponse } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/api/v1/master-data/warehouses').then((r) => r.data),
  });
  const warehouses = warehousesResponse?.data || [];

  const { mutate, isPending } = useCreatePurchaseOrder();

  const handleLineChange = (index: number, field: keyof PurchaseOrderLine, value: string | number) => {
    const newLines = [...lines];
    if (field === 'qty_ordered' || field === 'unit_price') {
      newLines[index][field] = Number(value) || 0;
    } else {
      (newLines[index] as any)[field] = value;
    }
    setLines(newLines);
  };

  const addLine = () => {
    setLines([...lines, { product_id: '', qty_ordered: 1, uom_id: '', unit_price: 0 }]);
  };

  const removeLine = (index: number) => {
    if (lines.length > 1) {
      setLines(lines.filter((_, i) => i !== index));
    }
  };

  const totalAmount = useMemo(() => {
    return lines.reduce((sum, line) => sum + (line.qty_ordered * line.unit_price), 0);
  }, [lines]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutate({
      supplier_id: supplierId,
      branch_id: branches[0]?.id || '00000000-0000-0000-0000-000000000000',
      warehouse_id: warehouses[0]?.id || '00000000-0000-0000-0000-000000000000',
      order_date: orderDate,
      lines
    }, {
      onSuccess: () => {
        onClose();
        // reset form
        setLines([{ product_id: '', qty_ordered: 1, uom_id: '', unit_price: 0 }]);
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create Purchase Order</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form id="poForm" className={styles.content} onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Order Date</label>
              <Input 
                type="date" 
                value={orderDate} 
                onChange={(e) => setOrderDate(e.target.value)} 
                required 
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label}>Supplier</label>
              <Select 
                value={supplierId} 
                onChange={(value) => setSupplierId(value)}
                style={{ width: '100%' }}
                placeholder="Select a supplier"
              >
                {suppliers.map((s: any) => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
            </div>
          </div>

          <h3 className={styles.sectionTitle}>Order Lines</h3>
          
          <table className={styles.linesTable}>
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ width: '80px' }}>Qty</th>
                <th style={{ width: '120px' }}>Unit Price</th>
                <th style={{ width: '120px' }}>Subtotal</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index}>
                  <td>
                    <Select 
                      value={line.product_id}
                      onChange={(value) => {
                        const product = products.find((p: any) => p.id === value);
                        handleLineChange(index, 'product_id', value);
                        if (product) {
                          handleLineChange(index, 'uom_id', product.uom_id);
                          handleLineChange(index, 'unit_price', product.standard_cost || 0);
                        }
                      }}
                      style={{ width: '100%' }}
                      placeholder="Select product"
                    >
                      {products.map((p: any) => (
                        <Option key={p.id} value={p.id}>{p.name}</Option>
                      ))}
                    </Select>
                  </td>
                  <td>
                    <input 
                      type="number" 
                      className={styles.lineInput} 
                      value={line.qty_ordered || ''}
                      onChange={(e) => handleLineChange(index, 'qty_ordered', e.target.value)}
                      required
                    />
                  </td>
                  <td>
                    <input 
                      type="number" 
                      className={styles.lineInput} 
                      value={line.unit_price || ''}
                      onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)}
                      required
                    />
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--color-text-secondary)', paddingLeft: '8px' }}>
                    Rp {(line.qty_ordered * line.unit_price).toLocaleString('id-ID')}
                  </td>
                  <td>
                    <button 
                      type="button"
                      className={styles.iconBtn} 
                      onClick={() => removeLine(index)}
                      disabled={lines.length <= 1}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className={styles.addLineBtn} onClick={addLine}>
            <Plus size={16} /> Add Item
          </button>
        </form>

        <div className={styles.footer}>
          <div className={styles.totals}>
            Total Amount: <strong>Rp {totalAmount.toLocaleString('id-ID')}</strong>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
            <Button variant="primary" type="submit" form="poForm" disabled={isPending || totalAmount <= 0}>
              {isPending ? <Loader size={16} className={styles.spinner} /> : 'Create PO'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
