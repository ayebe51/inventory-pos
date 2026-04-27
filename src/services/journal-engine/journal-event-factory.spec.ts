import * as fc from 'fast-check';
import { JournalEventFactory } from './journal-event.builder';
import { JournalLine } from '../../modules/accounting/interfaces/accounting.interfaces';

/**
 * Task 6.4 — Journal Template Tests
 *
 * Verifies that each of the 10 journal event factory methods produces:
 *  1. The correct event_type
 *  2. The correct debit/credit account structure
 *  3. Balanced journal lines (|SUM(debit) - SUM(credit)| <= 0.01)
 *
 * Events covered:
 *  GOODS_RECEIPT, SUPPLIER_INVOICE, PURCHASE_PAYMENT,
 *  SALES_INVOICE, SALES_INVOICE_COGS, POS_SALE, POS_SALE_COGS,
 *  SALES_RETURN, SALES_RETURN_STOCK, PAYMENT_RECEIPT
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.random() * 16 | 0;
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
});

function isBalanced(lines: JournalLine[]): boolean {
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  return Math.abs(totalDebit - totalCredit) <= 0.01;
}

const BASE = {
  periodId: uuid(),
  entryDate: new Date('2026-01-15'),
  createdBy: uuid(),
};

// ── Arbitraries ───────────────────────────────────────────────────────────────

const arbAmount = fc.float({ min: Math.fround(0.01), max: Math.fround(1_000_000_000), noNaN: true });

// ── 1. GOODS_RECEIPT ─────────────────────────────────────────────────────────

describe('JournalEventFactory.createGoodsReceiptEvent', () => {
  const inventoryAccountId = uuid();
  const grClearingAccountId = uuid();

  it('produces event_type GOODS_RECEIPT', () => {
    const event = JournalEventFactory.createGoodsReceiptEvent({
      grId: uuid(), grNumber: 'GR-202601-00001',
      ...BASE,
      inventoryAccountId, grClearingAccountId,
      totalValue: 1_000_000,
    });
    expect(event.event_type).toBe('GOODS_RECEIPT');
  });

  it('debits Persediaan Barang and credits GR Clearing', () => {
    const event = JournalEventFactory.createGoodsReceiptEvent({
      grId: uuid(), grNumber: 'GR-202601-00001',
      ...BASE,
      inventoryAccountId, grClearingAccountId,
      totalValue: 500_000,
    });
    const debitLine = event.lines!.find((l) => l.debit > 0);
    const creditLine = event.lines!.find((l) => l.credit > 0);
    expect(debitLine?.account_id).toBe(inventoryAccountId);
    expect(creditLine?.account_id).toBe(grClearingAccountId);
  });

  it('PBT: always balanced for any positive amount', () => {
    fc.assert(fc.property(arbAmount, (amount) => {
      const event = JournalEventFactory.createGoodsReceiptEvent({
        grId: uuid(), grNumber: 'GR-202601-00001',
        ...BASE,
        inventoryAccountId, grClearingAccountId,
        totalValue: amount,
      });
      return isBalanced(event.lines!);
    }));
  });
});

// ── 2. SUPPLIER_INVOICE ───────────────────────────────────────────────────────

describe('JournalEventFactory.createSupplierInvoiceEvent', () => {
  const grClearingAccountId = uuid();
  const accountsPayableAccountId = uuid();

  it('produces event_type SUPPLIER_INVOICE', () => {
    const event = JournalEventFactory.createSupplierInvoiceEvent({
      invoiceId: uuid(), invoiceNumber: 'PINV-202601-00001',
      ...BASE,
      grClearingAccountId, accountsPayableAccountId,
      totalAmount: 2_000_000,
    });
    expect(event.event_type).toBe('SUPPLIER_INVOICE');
  });

  it('debits GR Clearing and credits Hutang Dagang', () => {
    const event = JournalEventFactory.createSupplierInvoiceEvent({
      invoiceId: uuid(), invoiceNumber: 'PINV-202601-00001',
      ...BASE,
      grClearingAccountId, accountsPayableAccountId,
      totalAmount: 2_000_000,
    });
    const debitLine = event.lines!.find((l) => l.debit > 0);
    const creditLine = event.lines!.find((l) => l.credit > 0);
    expect(debitLine?.account_id).toBe(grClearingAccountId);
    expect(creditLine?.account_id).toBe(accountsPayableAccountId);
  });

  it('PBT: always balanced for any positive amount', () => {
    fc.assert(fc.property(arbAmount, (amount) => {
      const event = JournalEventFactory.createSupplierInvoiceEvent({
        invoiceId: uuid(), invoiceNumber: 'PINV-202601-00001',
        ...BASE,
        grClearingAccountId, accountsPayableAccountId,
        totalAmount: amount,
      });
      return isBalanced(event.lines!);
    }));
  });
});

// ── 3. PURCHASE_PAYMENT ───────────────────────────────────────────────────────

describe('JournalEventFactory.createPurchasePaymentEvent', () => {
  const accountsPayableAccountId = uuid();
  const cashAccountId = uuid();

  it('produces event_type PURCHASE_PAYMENT', () => {
    const event = JournalEventFactory.createPurchasePaymentEvent({
      paymentId: uuid(), paymentNumber: 'PV-202601-00001',
      ...BASE,
      accountsPayableAccountId, cashAccountId,
      amount: 1_500_000,
    });
    expect(event.event_type).toBe('PURCHASE_PAYMENT');
  });

  it('debits Hutang Dagang and credits Kas/Bank', () => {
    const event = JournalEventFactory.createPurchasePaymentEvent({
      paymentId: uuid(), paymentNumber: 'PV-202601-00001',
      ...BASE,
      accountsPayableAccountId, cashAccountId,
      amount: 1_500_000,
    });
    const debitLine = event.lines!.find((l) => l.debit > 0);
    const creditLine = event.lines!.find((l) => l.credit > 0);
    expect(debitLine?.account_id).toBe(accountsPayableAccountId);
    expect(creditLine?.account_id).toBe(cashAccountId);
  });

  it('PBT: always balanced for any positive amount', () => {
    fc.assert(fc.property(arbAmount, (amount) => {
      const event = JournalEventFactory.createPurchasePaymentEvent({
        paymentId: uuid(), paymentNumber: 'PV-202601-00001',
        ...BASE,
        accountsPayableAccountId, cashAccountId,
        amount,
      });
      return isBalanced(event.lines!);
    }));
  });
});

// ── 4. SALES_INVOICE ─────────────────────────────────────────────────────────

describe('JournalEventFactory.createSalesInvoiceEvent', () => {
  const accountsReceivableAccountId = uuid();
  const revenueAccountId = uuid();
  const ppnOutputAccountId = uuid();

  it('produces event_type SALES_INVOICE', () => {
    const event = JournalEventFactory.createSalesInvoiceEvent({
      invoiceId: uuid(), invoiceNumber: 'INV-202601-00001',
      ...BASE,
      accountsReceivableAccountId, revenueAccountId, ppnOutputAccountId,
      subtotal: 1_000_000, taxAmount: 110_000,
    });
    expect(event.event_type).toBe('SALES_INVOICE');
  });

  it('debits Piutang Dagang for full amount (subtotal + tax)', () => {
    const subtotal = 1_000_000;
    const taxAmount = 110_000;
    const event = JournalEventFactory.createSalesInvoiceEvent({
      invoiceId: uuid(), invoiceNumber: 'INV-202601-00001',
      ...BASE,
      accountsReceivableAccountId, revenueAccountId, ppnOutputAccountId,
      subtotal, taxAmount,
    });
    const debitLine = event.lines!.find((l) => l.account_id === accountsReceivableAccountId);
    expect(debitLine?.debit).toBeCloseTo(subtotal + taxAmount, 2);
  });

  it('credits Pendapatan Penjualan and PPN Keluaran separately', () => {
    const subtotal = 1_000_000;
    const taxAmount = 110_000;
    const event = JournalEventFactory.createSalesInvoiceEvent({
      invoiceId: uuid(), invoiceNumber: 'INV-202601-00001',
      ...BASE,
      accountsReceivableAccountId, revenueAccountId, ppnOutputAccountId,
      subtotal, taxAmount,
    });
    const revLine = event.lines!.find((l) => l.account_id === revenueAccountId);
    const taxLine = event.lines!.find((l) => l.account_id === ppnOutputAccountId);
    expect(revLine?.credit).toBeCloseTo(subtotal, 2);
    expect(taxLine?.credit).toBeCloseTo(taxAmount, 2);
  });

  it('omits PPN line when taxAmount is 0', () => {
    const event = JournalEventFactory.createSalesInvoiceEvent({
      invoiceId: uuid(), invoiceNumber: 'INV-202601-00001',
      ...BASE,
      accountsReceivableAccountId, revenueAccountId, ppnOutputAccountId,
      subtotal: 500_000, taxAmount: 0,
    });
    const taxLine = event.lines!.find((l) => l.account_id === ppnOutputAccountId);
    expect(taxLine).toBeUndefined();
  });

  it('PBT: always balanced for any subtotal and tax rate 0-11%', () => {
    fc.assert(fc.property(
      arbAmount,
      fc.float({ min: 0, max: Math.fround(0.11), noNaN: true }),
      (subtotal, taxRate) => {
        const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
        const event = JournalEventFactory.createSalesInvoiceEvent({
          invoiceId: uuid(), invoiceNumber: 'INV-202601-00001',
          ...BASE,
          accountsReceivableAccountId, revenueAccountId, ppnOutputAccountId,
          subtotal, taxAmount,
        });
        return isBalanced(event.lines!);
      },
    ));
  });
});

// ── 5. SALES_INVOICE_COGS ────────────────────────────────────────────────────

describe('JournalEventFactory.createSalesInvoiceCOGSEvent', () => {
  const cogsAccountId = uuid();
  const inventoryAccountId = uuid();

  it('produces event_type SALES_INVOICE_COGS', () => {
    const event = JournalEventFactory.createSalesInvoiceCOGSEvent({
      invoiceId: uuid(), invoiceNumber: 'INV-202601-00001',
      ...BASE,
      cogsAccountId, inventoryAccountId,
      cogsValue: 700_000,
    });
    expect(event.event_type).toBe('SALES_INVOICE_COGS');
  });

  it('debits HPP and credits Persediaan Barang', () => {
    const event = JournalEventFactory.createSalesInvoiceCOGSEvent({
      invoiceId: uuid(), invoiceNumber: 'INV-202601-00001',
      ...BASE,
      cogsAccountId, inventoryAccountId,
      cogsValue: 700_000,
    });
    const debitLine = event.lines!.find((l) => l.debit > 0);
    const creditLine = event.lines!.find((l) => l.credit > 0);
    expect(debitLine?.account_id).toBe(cogsAccountId);
    expect(creditLine?.account_id).toBe(inventoryAccountId);
  });

  it('PBT: always balanced for any positive COGS value', () => {
    fc.assert(fc.property(arbAmount, (cogsValue) => {
      const event = JournalEventFactory.createSalesInvoiceCOGSEvent({
        invoiceId: uuid(), invoiceNumber: 'INV-202601-00001',
        ...BASE,
        cogsAccountId, inventoryAccountId,
        cogsValue,
      });
      return isBalanced(event.lines!);
    }));
  });
});

// ── 6. POS_SALE ───────────────────────────────────────────────────────────────

describe('JournalEventFactory.createPOSSaleEvent', () => {
  const cashAccountId = uuid();
  const revenueAccountId = uuid();
  const ppnOutputAccountId = uuid();

  it('produces event_type POS_SALE', () => {
    const event = JournalEventFactory.createPOSSaleEvent({
      transactionId: uuid(), transactionNumber: 'POS-20260115-00001',
      ...BASE,
      payments: [{ accountId: cashAccountId, amount: 1_110_000 }],
      revenueAccountId, ppnOutputAccountId,
      subtotal: 1_000_000, taxAmount: 110_000,
    });
    expect(event.event_type).toBe('POS_SALE');
  });

  it('debits each payment method account', () => {
    const cashId = uuid();
    const edcId = uuid();
    const event = JournalEventFactory.createPOSSaleEvent({
      transactionId: uuid(), transactionNumber: 'POS-20260115-00001',
      ...BASE,
      payments: [
        { accountId: cashId, amount: 600_000 },
        { accountId: edcId, amount: 510_000 },
      ],
      revenueAccountId, ppnOutputAccountId,
      subtotal: 1_000_000, taxAmount: 110_000,
    });
    const cashLine = event.lines!.find((l) => l.account_id === cashId);
    const edcLine = event.lines!.find((l) => l.account_id === edcId);
    expect(cashLine?.debit).toBeCloseTo(600_000, 2);
    expect(edcLine?.debit).toBeCloseTo(510_000, 2);
  });

  it('PBT: always balanced with multiple payment methods', () => {
    fc.assert(fc.property(
      arbAmount,
      fc.float({ min: 0, max: Math.fround(0.11), noNaN: true }),
      fc.array(fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true }), { minLength: 1, maxLength: 4 }),
      (subtotal, taxRate, weights) => {
        const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
        const total = subtotal + taxAmount;
        const weightSum = weights.reduce((a, b) => a + b, 0);
        const payments = weights.map((w, i) => ({
          accountId: `pay-${i}`,
          amount: Math.round((w / weightSum) * total * 100) / 100,
        }));
        // Adjust last payment to ensure exact total
        const payTotal = payments.reduce((s, p) => s + p.amount, 0);
        payments[payments.length - 1].amount += total - payTotal;

        const event = JournalEventFactory.createPOSSaleEvent({
          transactionId: uuid(), transactionNumber: 'POS-20260115-00001',
          ...BASE,
          payments,
          revenueAccountId, ppnOutputAccountId,
          subtotal, taxAmount,
        });
        return isBalanced(event.lines!);
      },
    ));
  });
});

// ── 7. POS_SALE_COGS ─────────────────────────────────────────────────────────

describe('JournalEventFactory.createPOSSaleCOGSEvent', () => {
  const cogsAccountId = uuid();
  const inventoryAccountId = uuid();

  it('produces event_type POS_SALE_COGS', () => {
    const event = JournalEventFactory.createPOSSaleCOGSEvent({
      transactionId: uuid(), transactionNumber: 'POS-20260115-00001',
      ...BASE,
      cogsAccountId, inventoryAccountId,
      cogsValue: 800_000,
    });
    expect(event.event_type).toBe('POS_SALE_COGS');
  });

  it('debits HPP and credits Persediaan Barang', () => {
    const event = JournalEventFactory.createPOSSaleCOGSEvent({
      transactionId: uuid(), transactionNumber: 'POS-20260115-00001',
      ...BASE,
      cogsAccountId, inventoryAccountId,
      cogsValue: 800_000,
    });
    const debitLine = event.lines!.find((l) => l.debit > 0);
    const creditLine = event.lines!.find((l) => l.credit > 0);
    expect(debitLine?.account_id).toBe(cogsAccountId);
    expect(creditLine?.account_id).toBe(inventoryAccountId);
  });

  it('PBT: always balanced for any positive COGS value', () => {
    fc.assert(fc.property(arbAmount, (cogsValue) => {
      const event = JournalEventFactory.createPOSSaleCOGSEvent({
        transactionId: uuid(), transactionNumber: 'POS-20260115-00001',
        ...BASE,
        cogsAccountId, inventoryAccountId,
        cogsValue,
      });
      return isBalanced(event.lines!);
    }));
  });
});

// ── 8. SALES_RETURN ───────────────────────────────────────────────────────────

describe('JournalEventFactory.createSalesReturnEvent', () => {
  const salesReturnAccountId = uuid();
  const ppnOutputAccountId = uuid();
  const accountsReceivableAccountId = uuid();

  it('produces event_type SALES_RETURN', () => {
    const event = JournalEventFactory.createSalesReturnEvent({
      returnId: uuid(), returnNumber: 'SR-202601-00001',
      ...BASE,
      salesReturnAccountId, ppnOutputAccountId, accountsReceivableAccountId,
      subtotal: 500_000, taxAmount: 55_000,
    });
    expect(event.event_type).toBe('SALES_RETURN');
  });

  it('debits Retur Penjualan + PPN and credits Piutang Dagang for full amount', () => {
    const subtotal = 500_000;
    const taxAmount = 55_000;
    const event = JournalEventFactory.createSalesReturnEvent({
      returnId: uuid(), returnNumber: 'SR-202601-00001',
      ...BASE,
      salesReturnAccountId, ppnOutputAccountId, accountsReceivableAccountId,
      subtotal, taxAmount,
    });
    const returnLine = event.lines!.find((l) => l.account_id === salesReturnAccountId);
    const taxLine = event.lines!.find((l) => l.account_id === ppnOutputAccountId);
    const arLine = event.lines!.find((l) => l.account_id === accountsReceivableAccountId);
    expect(returnLine?.debit).toBeCloseTo(subtotal, 2);
    expect(taxLine?.debit).toBeCloseTo(taxAmount, 2);
    expect(arLine?.credit).toBeCloseTo(subtotal + taxAmount, 2);
  });

  it('PBT: always balanced for any subtotal and tax rate 0-11%', () => {
    fc.assert(fc.property(
      arbAmount,
      fc.float({ min: 0, max: Math.fround(0.11), noNaN: true }),
      (subtotal, taxRate) => {
        const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
        const event = JournalEventFactory.createSalesReturnEvent({
          returnId: uuid(), returnNumber: 'SR-202601-00001',
          ...BASE,
          salesReturnAccountId, ppnOutputAccountId, accountsReceivableAccountId,
          subtotal, taxAmount,
        });
        return isBalanced(event.lines!);
      },
    ));
  });
});

// ── 9. SALES_RETURN_STOCK ────────────────────────────────────────────────────

describe('JournalEventFactory.createSalesReturnStockEvent', () => {
  const inventoryAccountId = uuid();
  const cogsAccountId = uuid();

  it('produces event_type SALES_RETURN_STOCK', () => {
    const event = JournalEventFactory.createSalesReturnStockEvent({
      returnId: uuid(), returnNumber: 'SR-202601-00001',
      ...BASE,
      inventoryAccountId, cogsAccountId,
      stockValue: 350_000,
    });
    expect(event.event_type).toBe('SALES_RETURN_STOCK');
  });

  it('debits Persediaan Barang and credits HPP', () => {
    const event = JournalEventFactory.createSalesReturnStockEvent({
      returnId: uuid(), returnNumber: 'SR-202601-00001',
      ...BASE,
      inventoryAccountId, cogsAccountId,
      stockValue: 350_000,
    });
    const debitLine = event.lines!.find((l) => l.debit > 0);
    const creditLine = event.lines!.find((l) => l.credit > 0);
    expect(debitLine?.account_id).toBe(inventoryAccountId);
    expect(creditLine?.account_id).toBe(cogsAccountId);
  });

  it('PBT: always balanced for any positive stock value', () => {
    fc.assert(fc.property(arbAmount, (stockValue) => {
      const event = JournalEventFactory.createSalesReturnStockEvent({
        returnId: uuid(), returnNumber: 'SR-202601-00001',
        ...BASE,
        inventoryAccountId, cogsAccountId,
        stockValue,
      });
      return isBalanced(event.lines!);
    }));
  });
});

// ── 10. PAYMENT_RECEIPT ───────────────────────────────────────────────────────

describe('JournalEventFactory.createPaymentReceiptEvent', () => {
  const cashAccountId = uuid();
  const accountsReceivableAccountId = uuid();

  it('produces event_type PAYMENT_RECEIPT', () => {
    const event = JournalEventFactory.createPaymentReceiptEvent({
      paymentId: uuid(), paymentNumber: 'RCV-202601-00001',
      ...BASE,
      cashAccountId, accountsReceivableAccountId,
      amount: 1_110_000,
    });
    expect(event.event_type).toBe('PAYMENT_RECEIPT');
  });

  it('debits Kas/Bank and credits Piutang Dagang', () => {
    const event = JournalEventFactory.createPaymentReceiptEvent({
      paymentId: uuid(), paymentNumber: 'RCV-202601-00001',
      ...BASE,
      cashAccountId, accountsReceivableAccountId,
      amount: 1_110_000,
    });
    const debitLine = event.lines!.find((l) => l.debit > 0);
    const creditLine = event.lines!.find((l) => l.credit > 0);
    expect(debitLine?.account_id).toBe(cashAccountId);
    expect(creditLine?.account_id).toBe(accountsReceivableAccountId);
  });

  it('PBT: always balanced for any positive amount', () => {
    fc.assert(fc.property(arbAmount, (amount) => {
      const event = JournalEventFactory.createPaymentReceiptEvent({
        paymentId: uuid(), paymentNumber: 'RCV-202601-00001',
        ...BASE,
        cashAccountId, accountsReceivableAccountId,
        amount,
      });
      return isBalanced(event.lines!);
    }));
  });
});

// ── Cross-cutting: reference_type correctness ─────────────────────────────────

describe('JournalEventFactory — reference_type conventions', () => {
  it('GOODS_RECEIPT uses reference_type GR', () => {
    const event = JournalEventFactory.createGoodsReceiptEvent({
      grId: uuid(), grNumber: 'GR-202601-00001', ...BASE,
      inventoryAccountId: uuid(), grClearingAccountId: uuid(), totalValue: 1,
    });
    expect(event.reference_type).toBe('GR');
  });

  it('SUPPLIER_INVOICE uses reference_type PINV', () => {
    const event = JournalEventFactory.createSupplierInvoiceEvent({
      invoiceId: uuid(), invoiceNumber: 'PINV-202601-00001', ...BASE,
      grClearingAccountId: uuid(), accountsPayableAccountId: uuid(), totalAmount: 1,
    });
    expect(event.reference_type).toBe('PINV');
  });

  it('PURCHASE_PAYMENT uses reference_type PV', () => {
    const event = JournalEventFactory.createPurchasePaymentEvent({
      paymentId: uuid(), paymentNumber: 'PV-202601-00001', ...BASE,
      accountsPayableAccountId: uuid(), cashAccountId: uuid(), amount: 1,
    });
    expect(event.reference_type).toBe('PV');
  });

  it('SALES_INVOICE uses reference_type INV', () => {
    const event = JournalEventFactory.createSalesInvoiceEvent({
      invoiceId: uuid(), invoiceNumber: 'INV-202601-00001', ...BASE,
      accountsReceivableAccountId: uuid(), revenueAccountId: uuid(),
      ppnOutputAccountId: uuid(), subtotal: 1, taxAmount: 0,
    });
    expect(event.reference_type).toBe('INV');
  });

  it('POS_SALE uses reference_type POS', () => {
    const event = JournalEventFactory.createPOSSaleEvent({
      transactionId: uuid(), transactionNumber: 'POS-20260115-00001', ...BASE,
      payments: [{ accountId: uuid(), amount: 1 }],
      revenueAccountId: uuid(), ppnOutputAccountId: uuid(),
      subtotal: 1, taxAmount: 0,
    });
    expect(event.reference_type).toBe('POS');
  });

  it('SALES_RETURN uses reference_type SR', () => {
    const event = JournalEventFactory.createSalesReturnEvent({
      returnId: uuid(), returnNumber: 'SR-202601-00001', ...BASE,
      salesReturnAccountId: uuid(), ppnOutputAccountId: uuid(),
      accountsReceivableAccountId: uuid(), subtotal: 1, taxAmount: 0,
    });
    expect(event.reference_type).toBe('SR');
  });

  it('PAYMENT_RECEIPT uses reference_type RCV', () => {
    const event = JournalEventFactory.createPaymentReceiptEvent({
      paymentId: uuid(), paymentNumber: 'RCV-202601-00001', ...BASE,
      cashAccountId: uuid(), accountsReceivableAccountId: uuid(), amount: 1,
    });
    expect(event.reference_type).toBe('RCV');
  });
});
