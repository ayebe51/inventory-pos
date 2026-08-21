export interface TopProduct {
  product_id: string;
  product_name: string;
  total_qty: number;
  total_revenue: number;
}

export interface ExecutiveDashboard {
  total_sales: number;
  total_purchases: number;
  cash_position: number;
  ar_outstanding: number;
  ap_outstanding: number;
  top_products: TopProduct[];
  generated_at: string;
}

export interface InventoryPositionItem {
  product_id: string;
  product_code: string;
  product_name: string;
  warehouse_id: string;
  warehouse_name: string;
  qty_on_hand: number;
  average_cost: number;
  total_value: number;
}

export interface InventoryPositionReport {
  as_of_date: string;
  items: InventoryPositionItem[];
}
