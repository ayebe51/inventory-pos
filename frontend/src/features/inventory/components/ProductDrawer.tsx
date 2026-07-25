import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Product } from '../types/inventory.types';
import { useCreateProduct, useUpdateProduct } from '../hooks/useInventory';
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
    category_id: 'b75f5b61-9c1d-4074-b4a1-874271701e67', // Hardcoded mock category for now
    uom_id: 'e6b8c4c7-124b-4a55-89f5-373a0a38b1d4', // Hardcoded mock UOM for now
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
        category_id: 'b75f5b61-9c1d-4074-b4a1-874271701e67', 
        uom_id: 'e6b8c4c7-124b-4a55-89f5-373a0a38b1d4', 
      });
    }
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
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
