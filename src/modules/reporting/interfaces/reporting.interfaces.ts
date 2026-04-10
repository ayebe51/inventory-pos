import { UUID } from '../../../common/types/uuid.type';

export interface DashboardParams {
  branch_id?: UUID;
  as_of_date?: Date;
}

export interface TrialBalanceParams {
  period_id: UUID;
  branch_id?: UUID;
}

export interface PeriodParams {
  period_id: UUID;
  branch_id?: UUID;
}

export interface AsOfDateParams {
  as_of_date: Date;
  branch_id?: UUID;
}

export interface AgingParams {
  as_of_date: Date;
  branch_id?: UUID;
}

export interface StockParams {
  warehouse_id?: UUID;
  branch_id?: UUID;
  as_of_date?: Date;
}

export interface MovementParams {
  product_id?: UUID;
  warehouse_id?: UUID;
  from_date: Date;
  to_date: Date;
}

export interface SalesParams {
  from_date: Date;
  to_date: Date;
  branch_id?: UUID;
  product_id?: UUID;
  customer_id?: UUID;
}

export interface ExecutiveDashboard {
  total_sales: number;
  total_purchases: number;
  cash_position: number;
  ar_outstanding: number;
  ap_outstanding: number;
  top_products: TopProduct[];
  generated_at: Date;
}

export interface TopProduct {
  product_id: UUID;
  product_name: string;
  total_qty: number;
  total_revenue: number;
}

export interface TrialBalanceReport {
  period_id: UUID;
  accounts: TrialBalanceReportAccount[];
  total_debit: number;
  total_credit: number;
}

export interface TrialBalanceReportAccount {
  account_code: string;
  account_name: string;
  debit_balance: number;
  credit_balance: number;
}

export interface IncomeStatement {
  period_id: UUID;
  revenue: number;
  cogs: number;
  gross_profit: number;
  operating_expenses: number;
  net_income: number;
}

export interface BalanceSheet {
  as_of_date: Date;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
}

export interface CashFlowStatement {
  period_id: UUID;
  operating_activities: number;
  investing_activities: number;
  financing_activities: number;
  net_cash_flow: number;
}

export interface ARAgingReport {
  as_of_date: Date;
  buckets: AgingBucket[];
  total_outstanding: number;
}

export interface APAgingReport {
  as_of_date: Date;
  buckets: AgingBucket[];
  total_outstanding: number;
}

export interface AgingBucket {
  label: 'CURRENT' | '1-30' | '31-60' | '61-90' | '>90';
  amount: number;
  count: number;
}

export interface StockPositionReport {
  as_of_date: Date;
  items: StockPositionItem[];
}

export interface StockPositionItem {
  product_id: UUID;
  product_code: string;
  product_name: string;
  warehouse_id: UUID;
  warehouse_name: string;
  qty_on_hand: number;
  average_cost: number;
  total_value: number;
}

export interface StockMovementReport {
  from_date: Date;
  to_date: Date;
  movements: StockMovementItem[];
}

export interface StockMovementItem {
  product_id: UUID;
  product_name: string;
  warehouse_id: UUID;
  transaction_type: string;
  reference_number: string;
  movement_date: Date;
  qty_in: number;
  qty_out: number;
  running_qty: number;
}

export interface SalesReport {
  from_date: Date;
  to_date: Date;
  total_revenue: number;
  total_cogs: number;
  gross_margin: number;
  items: SalesReportItem[];
}

export interface SalesReportItem {
  product_id: UUID;
  product_name: string;
  qty_sold: number;
  revenue: number;
  cogs: number;
  margin: number;
}

export interface ShiftReport {
  shift_id: UUID;
  cashier_id: UUID;
  opening_balance: number;
  closing_balance: number;
  total_transactions: number;
  total_sales: number;
  cash_sales: number;
  card_sales: number;
  transfer_sales: number;
  cash_difference: number;
  opened_at: Date;
  closed_at: Date;
}

export interface ReportingService {
  getExecutiveDashboard(params: DashboardParams): Promise<ExecutiveDashboard>;
  getTrialBalance(params: TrialBalanceParams): Promise<TrialBalanceReport>;
  getIncomeStatement(params: PeriodParams): Promise<IncomeStatement>;
  getBalanceSheet(params: AsOfDateParams): Promise<BalanceSheet>;
  getCashFlow(params: PeriodParams): Promise<CashFlowStatement>;
  getARAgingReport(params: AgingParams): Promise<ARAgingReport>;
  getAPAgingReport(params: AgingParams): Promise<APAgingReport>;
  getStockPositionReport(params: StockParams): Promise<StockPositionReport>;
  getStockMovementReport(params: MovementParams): Promise<StockMovementReport>;
  getSalesReport(params: SalesParams): Promise<SalesReport>;
  getShiftReport(shiftId: UUID): Promise<ShiftReport>;
}
