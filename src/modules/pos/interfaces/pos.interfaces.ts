import { UUID } from '../../../common/types/uuid.type';

export type POSTransactionStatus = 'OPEN' | 'HELD' | 'COMPLETED' | 'VOIDED';
export type ShiftStatus = 'OPEN' | 'CLOSED' | 'AUTO_CLOSED';
export type SOStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'FULFILLED' | 'CANCELLED';

export interface Shift {
  id: UUID;
  cashier_id: UUID;
  branch_id: UUID;
  opening_balance: number;
  closing_balance: number | null;
  status: ShiftStatus;
  opened_at: Date;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface POSTransaction {
  id: UUID;
  transaction_number: string;
  shift_id: UUID;
  cashier_id: UUID;
  customer_id: UUID | null;
  transaction_date: Date;
  status: POSTransactionStatus;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  void_reason: string | null;
  voided_by: UUID | null;
  voided_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SalesOrder {
  id: UUID;
  so_number: string;
  customer_id: UUID;
  branch_id: UUID;
  status: SOStatus;
  order_date: Date;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  created_by: UUID;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface DeliveryOrder {
  id: UUID;
  do_number: string;
  so_id: UUID;
  warehouse_id: UUID;
  delivery_date: Date;
  status: 'DRAFT' | 'SHIPPED' | 'DELIVERED';
  created_by: UUID;
  created_at: Date;
  updated_at: Date;
}

export interface SalesReturn {
  id: UUID;
  return_number: string;
  so_id: UUID | null;
  pos_transaction_id: UUID | null;
  customer_id: UUID;
  return_date: Date;
  reason: string;
  total_amount: number;
  created_by: UUID;
  created_at: Date;
  updated_at: Date;
}

export interface Receipt {
  transaction_id: UUID;
  transaction_number: string;
  total_amount: number;
  paid_amount: number;
  change_amount: number;
  issued_at: Date;
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

export interface OpenShiftDTO {
  cashier_id: UUID;
  branch_id: UUID;
  warehouse_id: UUID;
  opening_balance: number;
}

export interface POSTransactionDTO {
  customer_id?: UUID;
}

export interface POSLineItemDTO {
  product_id: UUID;
  qty: number;
  uom_id: UUID;
  unit_price: number;
  discount_pct?: number;
  tax_pct?: number;
  price_override?: boolean;
  price_override_by?: UUID;
  version: number;
}

export interface PaymentMethodDTO {
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'EDC';
  amount: number;
  reference?: string;
  version: number;
}

export interface CreateSODTO {
  customer_id: UUID;
  branch_id: UUID;
  order_date: Date;
  lines: CreateSOLineDTO[];
}

export interface CreateSOLineDTO {
  product_id: UUID;
  qty: number;
  uom_id: UUID;
  unit_price: number;
}

export interface FulfillmentDTO {
  warehouse_id: UUID;
  delivery_date: Date;
  lines: FulfillmentLineDTO[];
}

export interface FulfillmentLineDTO {
  so_line_id: UUID;
  qty_fulfilled: number;
}

export interface SalesReturnDTO {
  customer_id: UUID;
  warehouse_id: UUID;
  reference_type: string;
  reference_id: UUID;
  return_date: Date;
  reason?: string;
  lines: SalesReturnLineDTO[];
}

export interface SalesReturnLineDTO {
  product_id: UUID;
  qty: number;
  uom_id: UUID;
  unit_price: number;
}

export interface POSService {
  openShift(data: OpenShiftDTO): Promise<Shift>;
  createTransaction(shiftId: UUID, data: POSTransactionDTO): Promise<POSTransaction>;
  addItem(transactionId: UUID, item: POSLineItemDTO): Promise<POSTransaction>;
  holdTransaction(transactionId: UUID, version: number): Promise<void>;
  resumeTransaction(transactionId: UUID, version: number): Promise<POSTransaction>;
  applyPayment(transactionId: UUID, payments: PaymentMethodDTO[]): Promise<Receipt>;
  voidTransaction(transactionId: UUID, supervisorId: UUID, reason: string, version?: number): Promise<void>;
  closeShift(shiftId: UUID, closingBalance: number): Promise<ShiftReport>;
  
  // Added missing methods
  listShifts(query: { status?: string; page: number; per_page: number }): Promise<{ data: Shift[]; meta: { total: number; page: number; per_page: number } }>;
  getShift(id: UUID): Promise<Shift>;
  listTransactions(query: { shift_id?: UUID; status?: string; page: number; per_page: number }): Promise<{ data: POSTransaction[]; meta: { total: number; page: number; per_page: number } }>;
  processFullTransaction(data: { shift_id: UUID; cashier_id: UUID; customer_id?: UUID; items: any[]; payments: any[] }): Promise<Receipt>;
  listSalesReturns(query: { page: number; per_page: number }): Promise<{ data: SalesReturn[]; meta: { total: number; page: number; per_page: number } }>;
  createSalesReturn(userId: UUID, data: SalesReturnDTO): Promise<SalesReturn>;
}

export interface SalesOrderService {
  create(data: CreateSODTO): Promise<SalesOrder>;
  approve(id: UUID, userId: UUID): Promise<SalesOrder>;
  fulfill(id: UUID, data: FulfillmentDTO): Promise<DeliveryOrder>;
  createReturn(soId: UUID, data: SalesReturnDTO): Promise<SalesReturn>;
}
