export interface Product {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: string;
  brand_id: string | null;
  uom_id: string;
  cost_method: 'WAC' | 'FIFO';
  standard_cost: number;
  selling_price: number;
  min_selling_price: number;
  reorder_point: number;
  reorder_qty: number;
  max_stock: number | null;
  is_serialized: boolean;
  is_batch_tracked: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedProducts {
  data: Product[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}
