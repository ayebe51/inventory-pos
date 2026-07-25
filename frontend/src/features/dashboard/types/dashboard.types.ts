export interface ExecutiveDashboardData {
  total_sales: number;
  total_purchases: number;
  cash_position: number;
  ar_outstanding: number;
  ap_outstanding: number;
  top_products: any[];
  generated_at: Date;
}

export interface DashboardResponse {
  data: ExecutiveDashboardData;
  message?: string;
}
