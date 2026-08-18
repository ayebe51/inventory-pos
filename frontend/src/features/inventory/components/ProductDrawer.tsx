import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import type { Product } from '../types/inventory.types';
import { useCreateProduct, useUpdateProduct } from '../hooks/useInventory';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import styles from './ProductDrawer.module.css';

interface ProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
}

export const ProductDrawer: React.FC<ProductDrawerProps> = ({ isOpen, onClose, product }) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    code: '',
    name: '',
    selling_price: 0,
    cost_method: 'WAC',
    standard_cost: 0,
    min_selling_price: 0,
    reorder_point: 0,
    reorder_qty: 0,
    is_active: true,
    is_serialized: false,
    is_batch_tracked: false,
    category_id: '',
    uom_id: '',
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/api/v1/master-data/categories').then((r) => r.data),
  });

  const { data: uoms } = useQuery({
    queryKey: ['uoms'],
    queryFn: () => api.get('/api/v1/master-data/uoms').then((r) => r.data),
  });

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();

  useEffect(() => {
    if (product) {
      setFormData(product);
    } else {
      setFormData({
        code: '',
        name: '',
        selling_price: 0,
        cost_method: 'WAC',
        standard_cost: 0,
        min_selling_price: 0,
        reorder_point: 0,
        reorder_qty: 0,
        is_active: true,
        is_serialized: false,
        is_batch_tracked: false,
        category_id: categories?.data?.[0]?.id || '', 
        uom_id: uoms?.data?.[0]?.id || '', 
      });
    }
  }, [product, isOpen, categories, uoms]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let checked = false;
    if (e.target instanceof HTMLInputElement && type === 'checkbox') {
      checked = e.target.checked;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (product) {
      updateMutation.mutate({ ...formData, id: product.id }, {
        onSuccess: onClose,
      });
    } else {
      createMutation.mutate(formData, {
        onSuccess: onClose,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className={styles.drawerOverlay} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{product ? 'Edit Product' : 'Add New Product'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form className={styles.content} id="productForm" onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.label}>SKU / Code</label>
            <Input 
              name="code" 
              value={formData.code || ''} 
              onChange={handleChange} 
              placeholder="e.g. SKU-1001" 
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Product Name</label>
            <Input 
              name="name" 
              value={formData.name || ''} 
              onChange={handleChange} 
              placeholder="Enter product name" 
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Selling Price (Rp)</label>
            <Input 
              type="number" 
              name="selling_price" 
              value={formData.selling_price || 0} 
              onChange={handleChange} 
              required
            />
          </div>
          
          <div className={styles.formGroup}>
            <label className={styles.label}>Standard Cost (Rp)</label>
            <Input 
              type="number" 
              name="standard_cost" 
              value={formData.standard_cost || 0} 
              onChange={handleChange} 
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                name="is_active" 
                checked={formData.is_active} 
                onChange={handleChange} 
              />
              <span className={styles.label}>Active Product</span>
            </label>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Category</label>
            <select 
              name="category_id" 
              value={formData.category_id || ''} 
              onChange={handleChange} 
              required
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.1)',
                background: 'rgba(255,255,255,0.7)',
                fontSize: '0.875rem'
              }}
            >
              <option value="" disabled>Select a category</option>
              {categories?.data?.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>Unit of Measure</label>
            <select 
              name="uom_id" 
              value={formData.uom_id || ''} 
              onChange={handleChange} 
              required
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.1)',
                background: 'rgba(255,255,255,0.7)',
                fontSize: '0.875rem'
              }}
            >
              <option value="" disabled>Select a UOM</option>
              {uoms?.data?.map((uom: any) => (
                <option key={uom.id} value={uom.id}>{uom.name}</option>
              ))}
            </select>
          </div>
        </form>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose} type="button">Cancel</Button>
          <Button variant="primary" type="submit" form="productForm" disabled={isPending}>
            {isPending ? <Loader size={16} className={styles.spinner} /> : 'Save Product'}
          </Button>
        </div>
      </div>
    </div>
  );
};
