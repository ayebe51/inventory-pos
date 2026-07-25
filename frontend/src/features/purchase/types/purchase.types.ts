export interface PurchaseOrderLine {
  product_id: string;
  qty_ordered: number;
  uom_id: string;
  unit_price: number;
  discount_pct?: number;
  tax_pct?: number;
  description?: string;
}

export interface CreatePurchaseOrderPayload {
  pr_id?: string;
  supplier_id: string;
  branch_id: string;
  warehouse_id: string;
  order_date: string;
  expected_delivery_date?: string;
  currency?: string;
  exchange_rate?: number;
  additional_cost?: number;
  notes?: string;
  lines: PurchaseOrderLine[];
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  branch_id: string;
  warehouse_id: string;
  order_date: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED' | 'CANCELLED' | 'CLOSED';
  total_amount: number;
  created_at: string;
}

export interface PaginatedPurchaseOrders {
  data: PurchaseOrder[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}
