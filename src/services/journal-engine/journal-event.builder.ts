import { UUID } from '../../common/types/uuid.type';
import {
  BusinessEvent,
  JournalEventType,
  JournalLine,
} from '../../modules/accounting/interfaces/accounting.interfaces';

/**
 * Builder for creating multi-line journal events.
 * 
 * Many business events require multiple journal lines (e.g., POS Sale needs
 * separate lines for cash/EDC, revenue, and tax). This builder provides a
 * fluent interface for constructing these complex events.
 * 
 * @example
 * const event = new JournalEventBuilder()
 *   .withEventType('POS_SALE')
 *   .withReference('POS', transactionId, transactionNumber)
 *   .withPeriod(periodId, transactionDate)
 *   .withCreatedBy(userId)
 *   .addLine(cashAccountId, paymentAmount, 0)
 *   .addLine(revenueAccountId, 0, subtotal)
 *   .addLine(ppnAccountId, 0, taxAmount)
 *   .build();
 */
export class JournalEventBuilder {
  private eventType: JournalEventType | null = null;
  private referenceType: string | null = null;
  private referenceId: UUID | null = null;
  private referenceNumber: string | null = null;
  private entryDate: Date | null = null;
  private periodId: UUID | null = null;
  private createdBy: UUID | null = null;
  private lines: JournalLine[] = [];
  private metadata: Record<string, unknown> = {};

  withEventType(eventType: JournalEventType): this {
    this.eventType = eventType;
    return this;
  }

  withReference(
    referenceType: string,
    referenceId: UUID,
    referenceNumber: string,
  ): this {
    this.referenceType = referenceType;
    this.referenceId = referenceId;
    this.referenceNumber = referenceNumber;
    return this;
  }

  withPeriod(periodId: UUID, entryDate: Date): this {
    this.periodId = periodId;
    this.entryDate = entryDate;
    return this;
  }

  withCreatedBy(userId: UUID): this {
    this.createdBy = userId;
    return this;
  }

  addLine(
    accountId: UUID,
    debit: number,
    credit: number,
    options?: {
      costCenterId?: UUID;
      description?: string;
    },
  ): this {
    this.lines.push({
      account_id: accountId,
      debit,
      credit,
      cost_center_id: options?.costCenterId,
      description: options?.description,
    });
    return this;
  }

  addDebitLine(
    accountId: UUID,
    amount: number,
    description?: string,
  ): this {
    return this.addLine(accountId, amount, 0, { description });
  }

  addCreditLine(
    accountId: UUID,
    amount: number,
    description?: string,
  ): this {
    return this.addLine(accountId, 0, amount, { description });
  }

  withMetadata(key: string, value: unknown): this {
    this.metadata[key] = value;
    return this;
  }

  /**
   * Validates that the journal lines are balanced.
   * @throws Error if lines are not balanced
   */
  validateBalance(): this {
    const totalDebit = this.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = this.lines.reduce((sum, line) => sum + line.credit, 0);
    const difference = Math.abs(totalDebit - totalCredit);

    if (difference > 0.01) {
      throw new Error(
        `Journal lines are not balanced. Debit=${totalDebit} Credit=${totalCredit} Difference=${difference}`,
      );
    }

    return this;
  }

  /**
   * Builds the BusinessEvent object.
   * @throws Error if required fields are missing
   */
  build(): BusinessEvent {
    if (!this.eventType) {
      throw new Error('Event type is required');
    }
    if (!this.referenceType || !this.referenceId || !this.referenceNumber) {
      throw new Error('Reference is required');
    }
    if (!this.periodId || !this.entryDate) {
      throw new Error('Period and entry date are required');
    }
    if (!this.createdBy) {
      throw new Error('Created by is required');
    }
    if (this.lines.length < 2) {
      throw new Error('At least 2 journal lines are required');
    }

    const totalDebit = this.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = this.lines.reduce((sum, line) => sum + line.credit, 0);

    return {
      event_type: this.eventType,
      reference_type: this.referenceType,
      reference_id: this.referenceId,
      reference_number: this.referenceNumber,
      entry_date: this.entryDate,
      period_id: this.periodId,
      amount: Math.max(totalDebit, totalCredit),
      lines: this.lines,
      metadata: Object.keys(this.metadata).length > 0 ? this.metadata : undefined,
      created_by: this.createdBy,
    };
  }
}

/**
 * Factory functions for common journal events.
 * These are convenience methods for creating standard journal events.
 */
export class JournalEventFactory {
  /**
   * Creates a Goods Receipt journal event.
   * 
   * Journal:
   * - Debit: Persediaan Barang (inventory value)
   * - Credit: GR Clearing (inventory value)
   */
  static createGoodsReceiptEvent(params: {
    grId: UUID;
    grNumber: string;
    periodId: UUID;
    entryDate: Date;
    inventoryAccountId: UUID;
    grClearingAccountId: UUID;
    totalValue: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('GOODS_RECEIPT')
      .withReference('GR', params.grId, params.grNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.inventoryAccountId, params.totalValue, 'Penerimaan barang')
      .addCreditLine(params.grClearingAccountId, params.totalValue, 'GR Clearing')
      .build();
  }

  /**
   * Creates a Supplier Invoice journal event.
   * 
   * Journal:
   * - Debit: GR Clearing (invoice total)
   * - Credit: Hutang Dagang (invoice total)
   */
  static createSupplierInvoiceEvent(params: {
    invoiceId: UUID;
    invoiceNumber: string;
    periodId: UUID;
    entryDate: Date;
    grClearingAccountId: UUID;
    accountsPayableAccountId: UUID;
    totalAmount: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('SUPPLIER_INVOICE')
      .withReference('PINV', params.invoiceId, params.invoiceNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.grClearingAccountId, params.totalAmount, 'GR Clearing')
      .addCreditLine(params.accountsPayableAccountId, params.totalAmount, 'Hutang Dagang')
      .build();
  }

  /**
   * Creates a Purchase Payment journal event.
   * 
   * Journal:
   * - Debit: Hutang Dagang (payment amount)
   * - Credit: Kas/Bank (payment amount)
   */
  static createPurchasePaymentEvent(params: {
    paymentId: UUID;
    paymentNumber: string;
    periodId: UUID;
    entryDate: Date;
    accountsPayableAccountId: UUID;
    cashAccountId: UUID;
    amount: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('PURCHASE_PAYMENT')
      .withReference('PV', params.paymentId, params.paymentNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.accountsPayableAccountId, params.amount, 'Hutang Dagang')
      .addCreditLine(params.cashAccountId, params.amount, 'Pembayaran supplier')
      .build();
  }

  /**
   * Creates a Sales Invoice journal event (revenue side).
   * 
   * Journal:
   * - Debit: Piutang Dagang (invoice total)
   * - Credit: Pendapatan Penjualan (subtotal)
   * - Credit: PPN Keluaran (tax amount)
   */
  static createSalesInvoiceEvent(params: {
    invoiceId: UUID;
    invoiceNumber: string;
    periodId: UUID;
    entryDate: Date;
    accountsReceivableAccountId: UUID;
    revenueAccountId: UUID;
    ppnOutputAccountId: UUID;
    subtotal: number;
    taxAmount: number;
    createdBy: UUID;
  }): BusinessEvent {
    const builder = new JournalEventBuilder()
      .withEventType('SALES_INVOICE')
      .withReference('INV', params.invoiceId, params.invoiceNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.accountsReceivableAccountId, params.subtotal + params.taxAmount, 'Piutang Dagang')
      .addCreditLine(params.revenueAccountId, params.subtotal, 'Pendapatan Penjualan');

    if (params.taxAmount > 0) {
      builder.addCreditLine(params.ppnOutputAccountId, params.taxAmount, 'PPN Keluaran');
    }

    return builder.build();
  }

  /**
   * Creates a Sales Invoice COGS journal event.
   * 
   * Journal:
   * - Debit: HPP (cost of goods sold)
   * - Credit: Persediaan Barang (cost of goods sold)
   */
  static createSalesInvoiceCOGSEvent(params: {
    invoiceId: UUID;
    invoiceNumber: string;
    periodId: UUID;
    entryDate: Date;
    cogsAccountId: UUID;
    inventoryAccountId: UUID;
    cogsValue: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('SALES_INVOICE_COGS')
      .withReference('INV', params.invoiceId, params.invoiceNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.cogsAccountId, params.cogsValue, 'HPP')
      .addCreditLine(params.inventoryAccountId, params.cogsValue, 'Persediaan Barang')
      .build();
  }

  /**
   * Creates a POS Sale journal event (revenue side).
   * Supports multiple payment methods.
   * 
   * Journal:
   * - Debit: Kas/EDC/Bank (per payment method)
   * - Credit: Pendapatan Penjualan (subtotal)
   * - Credit: PPN Keluaran (tax amount)
   */
  static createPOSSaleEvent(params: {
    transactionId: UUID;
    transactionNumber: string;
    periodId: UUID;
    entryDate: Date;
    payments: Array<{
      accountId: UUID;
      amount: number;
      description?: string;
    }>;
    revenueAccountId: UUID;
    ppnOutputAccountId: UUID;
    subtotal: number;
    taxAmount: number;
    createdBy: UUID;
  }): BusinessEvent {
    const builder = new JournalEventBuilder()
      .withEventType('POS_SALE')
      .withReference('POS', params.transactionId, params.transactionNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addCreditLine(params.revenueAccountId, params.subtotal, 'Pendapatan Penjualan');

    if (params.taxAmount > 0) {
      builder.addCreditLine(params.ppnOutputAccountId, params.taxAmount, 'PPN Keluaran');
    }

    // Add debit lines for each payment method
    for (const payment of params.payments) {
      builder.addDebitLine(payment.accountId, payment.amount, payment.description);
    }

    return builder.build();
  }

  /**
   * Creates a POS Sale COGS journal event.
   * 
   * Journal:
   * - Debit: HPP (cost of goods sold)
   * - Credit: Persediaan Barang (cost of goods sold)
   */
  static createPOSSaleCOGSEvent(params: {
    transactionId: UUID;
    transactionNumber: string;
    periodId: UUID;
    entryDate: Date;
    cogsAccountId: UUID;
    inventoryAccountId: UUID;
    cogsValue: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('POS_SALE_COGS')
      .withReference('POS', params.transactionId, params.transactionNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.cogsAccountId, params.cogsValue, 'HPP')
      .addCreditLine(params.inventoryAccountId, params.cogsValue, 'Persediaan Barang')
      .build();
  }

  /**
   * Creates a Sales Return journal event (revenue side).
   * 
   * Journal:
   * - Debit: Retur Penjualan (return subtotal)
   * - Debit: PPN Keluaran (return tax)
   * - Credit: Piutang Dagang/Kas (return total)
   */
  static createSalesReturnEvent(params: {
    returnId: UUID;
    returnNumber: string;
    periodId: UUID;
    entryDate: Date;
    salesReturnAccountId: UUID;
    ppnOutputAccountId: UUID;
    accountsReceivableAccountId: UUID;
    subtotal: number;
    taxAmount: number;
    createdBy: UUID;
  }): BusinessEvent {
    const builder = new JournalEventBuilder()
      .withEventType('SALES_RETURN')
      .withReference('SR', params.returnId, params.returnNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.salesReturnAccountId, params.subtotal, 'Retur Penjualan')
      .addCreditLine(params.accountsReceivableAccountId, params.subtotal + params.taxAmount, 'Piutang Dagang');

    if (params.taxAmount > 0) {
      builder.addDebitLine(params.ppnOutputAccountId, params.taxAmount, 'PPN Keluaran');
    }

    return builder.build();
  }

  /**
   * Creates a Sales Return Stock journal event.
   * 
   * Journal:
   * - Debit: Persediaan Barang (returned stock value)
   * - Credit: HPP (returned stock value)
   */
  static createSalesReturnStockEvent(params: {
    returnId: UUID;
    returnNumber: string;
    periodId: UUID;
    entryDate: Date;
    inventoryAccountId: UUID;
    cogsAccountId: UUID;
    stockValue: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('SALES_RETURN_STOCK')
      .withReference('SR', params.returnId, params.returnNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.inventoryAccountId, params.stockValue, 'Persediaan Barang')
      .addCreditLine(params.cogsAccountId, params.stockValue, 'HPP')
      .build();
  }

  /**
   * Creates a Payment Receipt journal event.
   * 
   * Journal:
   * - Debit: Kas/Bank (payment amount)
   * - Credit: Piutang Dagang (payment amount)
   */
  static createPaymentReceiptEvent(params: {
    paymentId: UUID;
    paymentNumber: string;
    periodId: UUID;
    entryDate: Date;
    cashAccountId: UUID;
    accountsReceivableAccountId: UUID;
    amount: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('PAYMENT_RECEIPT')
      .withReference('RCV', params.paymentId, params.paymentNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.cashAccountId, params.amount, 'Penerimaan pembayaran')
      .addCreditLine(params.accountsReceivableAccountId, params.amount, 'Piutang Dagang')
      .build();
  }

  // ============================================================
  // Task 6.5: Additional Journal Event Factory Methods
  // ============================================================

  /**
   * Creates a Stock Adjustment Positive journal event.
   * 
   * Journal:
   * - Debit: Persediaan Barang (adjustment value)
   * - Credit: Selisih Persediaan (adjustment value)
   */
  static createStockAdjustmentPositiveEvent(params: {
    adjustmentId: UUID;
    adjustmentNumber: string;
    periodId: UUID;
    entryDate: Date;
    inventoryAccountId: UUID;
    varianceAccountId: UUID;
    adjustmentValue: number;
    description?: string;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('STOCK_ADJUSTMENT_POSITIVE')
      .withReference('SA', params.adjustmentId, params.adjustmentNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.inventoryAccountId, params.adjustmentValue, 'Persediaan Barang')
      .addCreditLine(params.varianceAccountId, params.adjustmentValue, params.description ?? 'Selisih Persediaan')
      .build();
  }

  /**
   * Creates a Stock Adjustment Negative journal event.
   * 
   * Journal:
   * - Debit: Selisih Persediaan (adjustment value)
   * - Credit: Persediaan Barang (adjustment value)
   */
  static createStockAdjustmentNegativeEvent(params: {
    adjustmentId: UUID;
    adjustmentNumber: string;
    periodId: UUID;
    entryDate: Date;
    inventoryAccountId: UUID;
    varianceAccountId: UUID;
    adjustmentValue: number;
    description?: string;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('STOCK_ADJUSTMENT_NEGATIVE')
      .withReference('SA', params.adjustmentId, params.adjustmentNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.varianceAccountId, params.adjustmentValue, params.description ?? 'Selisih Persediaan')
      .addCreditLine(params.inventoryAccountId, params.adjustmentValue, 'Persediaan Barang')
      .build();
  }

  /**
   * Creates a Stock Opname Surplus journal event.
   * 
   * Journal:
   * - Debit: Persediaan Barang (surplus value)
   * - Credit: Keuntungan Opname (surplus value)
   */
  static createStockOpnameSurplusEvent(params: {
    opnameId: UUID;
    opnameNumber: string;
    periodId: UUID;
    entryDate: Date;
    inventoryAccountId: UUID;
    opnameGainAccountId: UUID;
    surplusValue: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('STOCK_OPNAME_SURPLUS')
      .withReference('SO', params.opnameId, params.opnameNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.inventoryAccountId, params.surplusValue, 'Persediaan Barang')
      .addCreditLine(params.opnameGainAccountId, params.surplusValue, 'Keuntungan Opname')
      .build();
  }

  /**
   * Creates a Stock Opname Deficit journal event.
   * 
   * Journal:
   * - Debit: Kerugian Opname (deficit value)
   * - Credit: Persediaan Barang (deficit value)
   */
  static createStockOpnameDeficitEvent(params: {
    opnameId: UUID;
    opnameNumber: string;
    periodId: UUID;
    entryDate: Date;
    inventoryAccountId: UUID;
    opnameLossAccountId: UUID;
    deficitValue: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('STOCK_OPNAME_DEFICIT')
      .withReference('SO', params.opnameId, params.opnameNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.opnameLossAccountId, params.deficitValue, 'Kerugian Opname')
      .addCreditLine(params.inventoryAccountId, params.deficitValue, 'Persediaan Barang')
      .build();
  }

  /**
   * Creates a Period Closing Revenue journal event.
   * Closes all revenue accounts to Income Summary.
   * 
   * Journal:
   * - Debit: Pendapatan (total revenue)
   * - Credit: Ikhtisar Laba Rugi (total revenue)
   */
  static createPeriodClosingRevenueEvent(params: {
    periodId: UUID;
    entryDate: Date;
    revenueAccountId: UUID;
    incomeSummaryAccountId: UUID;
    totalRevenue: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('PERIOD_CLOSING_REVENUE')
      .withReference('PERIOD', params.periodId, `CLOSE-${params.periodId}`)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.revenueAccountId, params.totalRevenue, 'Penutupan Pendapatan')
      .addCreditLine(params.incomeSummaryAccountId, params.totalRevenue, 'Ikhtisar Laba Rugi')
      .build();
  }

  /**
   * Creates a Period Closing Expense journal event.
   * Closes all expense accounts to Income Summary.
   * 
   * Journal:
   * - Debit: Ikhtisar Laba Rugi (total expenses)
   * - Credit: Beban (total expenses)
   */
  static createPeriodClosingExpenseEvent(params: {
    periodId: UUID;
    entryDate: Date;
    incomeSummaryAccountId: UUID;
    expenseAccountId: UUID;
    totalExpenses: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('PERIOD_CLOSING_EXPENSE')
      .withReference('PERIOD', params.periodId, `CLOSE-${params.periodId}`)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.incomeSummaryAccountId, params.totalExpenses, 'Ikhtisar Laba Rugi')
      .addCreditLine(params.expenseAccountId, params.totalExpenses, 'Penutupan Beban')
      .build();
  }

  /**
   * Creates a Period Closing Net journal event.
   * Transfers net income/loss from Income Summary to Retained Earnings.
   * 
   * For Net Income:
   * - Debit: Ikhtisar Laba Rugi (net income)
   * - Credit: Laba Ditahan (net income)
   * 
   * For Net Loss:
   * - Debit: Laba Ditahan (net loss)
   * - Credit: Ikhtisar Laba Rugi (net loss)
   */
  static createPeriodClosingNetEvent(params: {
    periodId: UUID;
    entryDate: Date;
    incomeSummaryAccountId: UUID;
    retainedEarningsAccountId: UUID;
    netIncome: number; // Positive for net income, negative for net loss
    createdBy: UUID;
  }): BusinessEvent {
    const isNetIncome = params.netIncome >= 0;
    const amount = Math.abs(params.netIncome);

    const builder = new JournalEventBuilder()
      .withEventType('PERIOD_CLOSING_NET')
      .withReference('PERIOD', params.periodId, `CLOSE-${params.periodId}`)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy);

    if (isNetIncome) {
      // Net Income: Debit Income Summary, Credit Retained Earnings
      builder
        .addDebitLine(params.incomeSummaryAccountId, amount, 'Ikhtisar Laba Rugi')
        .addCreditLine(params.retainedEarningsAccountId, amount, 'Laba Ditahan');
    } else {
      // Net Loss: Debit Retained Earnings, Credit Income Summary
      builder
        .addDebitLine(params.retainedEarningsAccountId, amount, 'Laba Ditahan')
        .addCreditLine(params.incomeSummaryAccountId, amount, 'Ikhtisar Laba Rugi');
    }

    return builder.build();
  }

  /**
   * Creates a Depreciation journal event.
   * 
   * Journal:
   * - Debit: Beban Penyusutan (depreciation amount)
   * - Credit: Akumulasi Penyusutan (depreciation amount)
   */
  static createDepreciationEvent(params: {
    assetId: UUID;
    assetCode: string;
    periodId: UUID;
    entryDate: Date;
    depreciationExpenseAccountId: UUID;
    accumulatedDepreciationAccountId: UUID;
    depreciationAmount: number;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('DEPRECIATION')
      .withReference('ASSET', params.assetId, params.assetCode)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.depreciationExpenseAccountId, params.depreciationAmount, 'Beban Penyusutan')
      .addCreditLine(params.accumulatedDepreciationAccountId, params.depreciationAmount, 'Akumulasi Penyusutan')
      .build();
  }

  /**
   * Creates a Bank Reconciliation Adjustment journal event.
   * 
   * Journal:
   * - Debit: Selisih Bank (adjustment amount) - if bank balance > book balance
   * - Credit: Kas/Bank (adjustment amount)
   * 
   * Or the reverse if book balance > bank balance.
   */
  static createBankReconciliationAdjEvent(params: {
    reconciliationId: UUID;
    reconciliationNumber: string;
    periodId: UUID;
    entryDate: Date;
    bankVarianceAccountId: UUID;
    bankAccountId: UUID;
    adjustmentAmount: number;
    isBankHigher: boolean; // true if bank balance > book balance
    description?: string;
    createdBy: UUID;
  }): BusinessEvent {
    const builder = new JournalEventBuilder()
      .withEventType('BANK_RECONCILIATION_ADJ')
      .withReference('BREC', params.reconciliationId, params.reconciliationNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy);

    if (params.isBankHigher) {
      // Bank balance is higher: Debit Bank, Credit Variance
      builder
        .addDebitLine(params.bankAccountId, params.adjustmentAmount, 'Kas/Bank')
        .addCreditLine(params.bankVarianceAccountId, params.adjustmentAmount, params.description ?? 'Selisih Bank');
    } else {
      // Book balance is higher: Debit Variance, Credit Bank
      builder
        .addDebitLine(params.bankVarianceAccountId, params.adjustmentAmount, params.description ?? 'Selisih Bank')
        .addCreditLine(params.bankAccountId, params.adjustmentAmount, 'Kas/Bank');
    }

    return builder.build();
  }

  /**
   * Creates a Write-off AR journal event.
   * 
   * Journal:
   * - Debit: Beban Piutang Tak Tertagih (write-off amount)
   * - Credit: Piutang Dagang (write-off amount)
   */
  static createWriteOffAREvent(params: {
    invoiceId: UUID;
    invoiceNumber: string;
    periodId: UUID;
    entryDate: Date;
    badDebtExpenseAccountId: UUID;
    accountsReceivableAccountId: UUID;
    writeOffAmount: number;
    reason?: string;
    createdBy: UUID;
  }): BusinessEvent {
    return new JournalEventBuilder()
      .withEventType('WRITE_OFF_AR')
      .withReference('INV', params.invoiceId, params.invoiceNumber)
      .withPeriod(params.periodId, params.entryDate)
      .withCreatedBy(params.createdBy)
      .addDebitLine(params.badDebtExpenseAccountId, params.writeOffAmount, 'Beban Piutang Tak Tertagih')
      .addCreditLine(params.accountsReceivableAccountId, params.writeOffAmount, params.reason ?? 'Penghapusan Piutang')
      .build();
  }
}
