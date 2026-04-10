import { UUID } from '../../../common/types/uuid.type';

export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export type AccountType =
  | 'ASSET'
  | 'LIABILITY'
  | 'EQUITY'
  | 'REVENUE'
  | 'EXPENSE'
  | 'COGS'
  | 'OTHER_INCOME'
  | 'OTHER_EXPENSE';

export type JournalEventType =
  | 'GOODS_RECEIPT'
  | 'SUPPLIER_INVOICE'
  | 'PURCHASE_PAYMENT'
  | 'SALES_INVOICE'
  | 'SALES_INVOICE_COGS'
  | 'POS_SALE'
  | 'POS_SALE_COGS'
  | 'SALES_RETURN'
  | 'SALES_RETURN_STOCK'
  | 'PAYMENT_RECEIPT'
  | 'STOCK_ADJUSTMENT_PLUS'
  | 'STOCK_ADJUSTMENT_MINUS'
  | 'STOCK_OPNAME_SURPLUS'
  | 'STOCK_OPNAME_DEFICIT'
  | 'PERIOD_CLOSING_REVENUE'
  | 'PERIOD_CLOSING_EXPENSE'
  | 'PERIOD_CLOSING_NET'
  | 'DEPRECIATION'
  | 'BANK_RECONCILIATION_ADJ'
  | 'WRITE_OFF_AR';

export interface JournalEntry {
  id: UUID;
  je_number: string;
  entry_date: Date;
  period_id: UUID;
  reference_type: string;
  reference_id: UUID;
  reference_number: string;
  description: string;
  total_debit: number;
  total_credit: number;
  status: JournalEntryStatus;
  is_auto_generated: boolean;
  reversed_by: UUID | null;
  reversed_at: Date | null;
  posted_by: UUID | null;
  posted_at: Date | null;
  created_by: UUID;
  created_at: Date;
  updated_at: Date;
}

export interface JournalLine {
  account_id: UUID;
  cost_center_id?: UUID;
  description?: string;
  debit: number;
  credit: number;
}

export interface JournalTemplate {
  event_type: JournalEventType;
  debit_account_code: string;
  credit_account_code: string;
  description_template: string;
}

export interface BusinessEvent {
  event_type: JournalEventType;
  reference_type: string;
  reference_id: UUID;
  reference_number: string;
  entry_date: Date;
  period_id: UUID;
  amount: number;
  lines?: JournalLine[];
  metadata?: Record<string, unknown>;
  created_by: UUID;
}

export interface TrialBalance {
  period_id: UUID;
  accounts: TrialBalanceAccount[];
  total_debit: number;
  total_credit: number;
  generated_at: Date;
}

export interface TrialBalanceAccount {
  account_id: UUID;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  debit_balance: number;
  credit_balance: number;
}

export interface AccountBalance {
  account_id: UUID;
  account_code: string;
  account_name: string;
  balance: number;
  normal_balance: 'DEBIT' | 'CREDIT';
  as_of_date: Date;
}

export interface FiscalPeriod {
  id: UUID;
  period_name: string;
  start_date: Date;
  end_date: Date;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  closed_by: UUID | null;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface JournalEntryDTO {
  entry_date: Date;
  period_id: UUID;
  reference_type: string;
  reference_id: UUID;
  reference_number: string;
  description: string;
  lines: JournalLine[];
  is_auto_generated?: boolean;
  created_by: UUID;
}

export interface AccountingService {
  postJournalEntry(data: JournalEntryDTO): Promise<JournalEntry>;
  reverseJournalEntry(id: UUID, userId: UUID, reason: string): Promise<JournalEntry>;
  getTrialBalance(periodId: UUID, branchId?: UUID): Promise<TrialBalance>;
  closePeriod(periodId: UUID, userId: UUID): Promise<FiscalPeriod>;
  getAccountBalance(accountId: UUID, asOfDate: Date): Promise<AccountBalance>;
}

export interface AutoJournalEngine {
  processEvent(event: BusinessEvent): Promise<JournalEntry[]>;
  getJournalTemplate(eventType: JournalEventType): Promise<JournalTemplate>;
  validateBalance(entries: JournalLine[]): boolean;
}

export interface BankReconciliationService {
  importBankStatement(data: unknown): Promise<unknown>;
  autoMatch(statementId: UUID): Promise<unknown>;
  manualMatch(statementLineId: UUID, paymentId: UUID): Promise<void>;
  getOutstandingItems(bankAccountId: UUID): Promise<unknown>;
}
