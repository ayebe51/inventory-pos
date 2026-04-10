import { UUID } from '../../../common/types/uuid.type';

export type InvoiceStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'PARTIAL'
  | 'PAID'
  | 'OVERDUE'
  | 'DISPUTED'
  | 'CANCELLED'
  | 'WRITTEN_OFF';

export type PaymentStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'POSTED'
  | 'RECONCILED'
  | 'REVERSED';

export type InvoiceType = 'SALES' | 'PURCHASE';

export interface Invoice {
  id: UUID;
  invoice_number: string;
  invoice_type: InvoiceType;
  customer_id: UUID | null;
  supplier_id: UUID | null;
  branch_id: UUID;
  status: InvoiceStatus;
  invoice_date: Date;
  due_date: Date;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  reference_type: string | null;
  reference_id: UUID | null;
  notes: string | null;
  created_by: UUID;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface InvoiceAllocation {
  id: UUID;
  invoice_id: UUID;
  payment_id: UUID;
  amount: number;
  allocated_at: Date;
  created_by: UUID;
}

export interface Payment {
  id: UUID;
  payment_number: string;
  payment_type: 'RECEIPT' | 'VOUCHER';
  customer_id: UUID | null;
  supplier_id: UUID | null;
  branch_id: UUID;
  status: PaymentStatus;
  payment_date: Date;
  amount: number;
  allocated_amount: number;
  unallocated_amount: number;
  bank_account_id: UUID | null;
  reference: string | null;
  notes: string | null;
  approved_by: UUID | null;
  approved_at: Date | null;
  posted_by: UUID | null;
  posted_at: Date | null;
  reversed_by: UUID | null;
  reversed_at: Date | null;
  created_by: UUID;
  created_at: Date;
  updated_at: Date;
}

export interface BankStatement {
  id: UUID;
  bank_account_id: UUID;
  statement_date: Date;
  opening_balance: number;
  closing_balance: number;
  imported_at: Date;
  imported_by: UUID;
}

export interface ReconciliationResult {
  matched: number;
  unmatched: number;
  total_matched_amount: number;
}

export interface OutstandingItems {
  deposits_in_transit: Payment[];
  outstanding_checks: Payment[];
  bank_charges: unknown[];
}

export interface CreateSalesInvoiceDTO {
  customer_id: UUID;
  branch_id: UUID;
  invoice_date: Date;
  due_date: Date;
  reference_type?: string;
  reference_id?: UUID;
  lines: InvoiceLineDTO[];
}

export interface CreatePurchaseInvoiceDTO {
  supplier_id: UUID;
  branch_id: UUID;
  invoice_date: Date;
  due_date: Date;
  po_id?: UUID;
  lines: InvoiceLineDTO[];
}

export interface InvoiceLineDTO {
  product_id: UUID;
  description?: string;
  qty: number;
  unit_price: number;
  tax_pct: number;
}

export interface AllocationDTO {
  invoice_id: UUID;
  amount: number;
}

export interface CreatePaymentDTO {
  payment_type: 'RECEIPT' | 'VOUCHER';
  customer_id?: UUID;
  supplier_id?: UUID;
  branch_id: UUID;
  payment_date: Date;
  amount: number;
  bank_account_id?: UUID;
  reference?: string;
  notes?: string;
}

export interface BankStatementDTO {
  bank_account_id: UUID;
  statement_date: Date;
  opening_balance: number;
  closing_balance: number;
  lines: BankStatementLineDTO[];
}

export interface BankStatementLineDTO {
  transaction_date: Date;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  reference: string | null;
}

export interface InvoiceService {
  createSalesInvoice(data: CreateSalesInvoiceDTO): Promise<Invoice>;
  createPurchaseInvoice(data: CreatePurchaseInvoiceDTO): Promise<Invoice>;
  post(id: UUID, userId: UUID): Promise<Invoice>;
  applyPayment(invoiceId: UUID, paymentId: UUID, amount: number): Promise<InvoiceAllocation>;
  dispute(id: UUID, reason: string): Promise<Invoice>;
  writeOff(id: UUID, userId: UUID, reason: string): Promise<Invoice>;
}

export interface PaymentService {
  createPayment(data: CreatePaymentDTO): Promise<Payment>;
  approve(id: UUID, approverId: UUID): Promise<Payment>;
  post(id: UUID, userId: UUID): Promise<Payment>;
  allocateToInvoices(paymentId: UUID, allocations: AllocationDTO[]): Promise<void>;
  reverse(id: UUID, userId: UUID, reason: string): Promise<Payment>;
  reconcile(id: UUID, bankStatementRef: string): Promise<Payment>;
}

export interface BankReconciliationService {
  importBankStatement(data: BankStatementDTO): Promise<BankStatement>;
  autoMatch(statementId: UUID): Promise<ReconciliationResult>;
  manualMatch(statementLineId: UUID, paymentId: UUID): Promise<void>;
  getOutstandingItems(bankAccountId: UUID): Promise<OutstandingItems>;
}
