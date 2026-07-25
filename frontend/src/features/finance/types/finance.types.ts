export interface Transaction {
  id: string;
  date: string;
  desc: string;
  amount: number;
  type: 'credit' | 'debit';
}

export interface FinanceData {
  currentCashBalance: number;
  recentTransactions: Transaction[];
}

export interface JournalEntryLine {
  accountId: string;
  debit: number;
  credit: number;
}

export interface CreateJournalEntryPayload {
  date: string;
  description: string;
  lines: JournalEntryLine[];
}
