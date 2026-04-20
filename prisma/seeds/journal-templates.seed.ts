// Load .env before anything else
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Auto Journal Templates for Task 6.4
 * 
 * These templates define the default debit/credit account pairs for each
 * business event that triggers an automatic journal entry.
 * 
 * Template format:
 * - event_type: The business event that triggers the journal
 * - description: Human-readable description of the journal
 * - debit_account_code: Account to debit
 * - credit_account_code: Account to credit
 * 
 * Note: For multi-line journals (e.g., POS Sale with COGS), the journal engine
 * will use the event.lines array from the BusinessEvent instead of the simple
 * debit/credit template.
 */

interface JournalTemplateSeed {
  event_type: string;
  description: string;
  debit_account_code: string;
  credit_account_code: string;
}

const JOURNAL_TEMPLATES: JournalTemplateSeed[] = [
  // ============================================================
  // Task 6.4 Templates (10 templates)
  // ============================================================
  
  /**
   * GOODS_RECEIPT
   * Triggered when: Goods Receipt is confirmed
   * Journal: Debit Persediaan Barang, Credit GR Clearing
   * Value: qty_received * unit_cost
   */
  {
    event_type: 'GOODS_RECEIPT',
    description: 'Penerimaan barang dari supplier',
    debit_account_code: '1.103.001',  // Persediaan Barang Dagang
    credit_account_code: '1.104.001', // GR Clearing
  },

  /**
   * SUPPLIER_INVOICE
   * Triggered when: Purchase Invoice is posted
   * Journal: Debit GR Clearing, Credit Hutang Dagang
   * Value: invoice total (including tax)
   */
  {
    event_type: 'SUPPLIER_INVOICE',
    description: 'Faktur pembelian dari supplier',
    debit_account_code: '1.104.001',  // GR Clearing
    credit_account_code: '2.101.001', // Hutang Dagang
  },

  /**
   * PURCHASE_PAYMENT
   * Triggered when: Payment to supplier is posted
   * Journal: Debit Hutang Dagang, Credit Kas/Bank
   * Value: payment amount
   */
  {
    event_type: 'PURCHASE_PAYMENT',
    description: 'Pembayaran ke supplier',
    debit_account_code: '2.101.001',  // Hutang Dagang
    credit_account_code: '1.101.003', // Bank - Rekening Utama
  },

  /**
   * SALES_INVOICE
   * Triggered when: Sales Invoice is posted
   * Journal: Debit Piutang Dagang, Credit Pendapatan Penjualan + PPN Keluaran
   * Note: Multi-line journal, uses event.lines
   */
  {
    event_type: 'SALES_INVOICE',
    description: 'Faktur penjualan ke customer',
    debit_account_code: '1.102.001',  // Piutang Dagang
    credit_account_code: '4.101.000', // Pendapatan Penjualan
  },

  /**
   * SALES_INVOICE_COGS
   * Triggered when: Sales Invoice is posted (separate journal for COGS)
   * Journal: Debit HPP, Credit Persediaan Barang
   * Value: qty_sold * average_cost
   */
  {
    event_type: 'SALES_INVOICE_COGS',
    description: 'HPP penjualan',
    debit_account_code: '5.100.000',  // HPP
    credit_account_code: '1.103.001', // Persediaan Barang Dagang
  },

  /**
   * POS_SALE
   * Triggered when: POS transaction is completed
   * Journal: Debit Kas/EDC/Bank, Credit Pendapatan Penjualan + PPN Keluaran
   * Note: Multi-line journal, uses event.lines
   */
  {
    event_type: 'POS_SALE',
    description: 'Penjualan POS',
    debit_account_code: '1.101.001',  // Kas Kecil (default, overridden by payment method)
    credit_account_code: '4.101.000', // Pendapatan Penjualan
  },

  /**
   * POS_SALE_COGS
   * Triggered when: POS transaction is completed (separate journal for COGS)
   * Journal: Debit HPP, Credit Persediaan Barang
   * Value: qty_sold * average_cost
   */
  {
    event_type: 'POS_SALE_COGS',
    description: 'HPP penjualan POS',
    debit_account_code: '5.100.000',  // HPP
    credit_account_code: '1.103.001', // Persediaan Barang Dagang
  },

  /**
   * SALES_RETURN
   * Triggered when: Sales Return is confirmed
   * Journal: Debit Retur Penjualan + PPN Keluaran, Credit Piutang/Kas
   * Note: Multi-line journal, uses event.lines
   */
  {
    event_type: 'SALES_RETURN',
    description: 'Retur penjualan',
    debit_account_code: '4.103.000',  // Retur Penjualan
    credit_account_code: '1.102.001', // Piutang Dagang
  },

  /**
   * SALES_RETURN_STOCK
   * Triggered when: Sales Return is confirmed (separate journal for stock return)
   * Journal: Debit Persediaan Barang, Credit HPP
   * Value: qty_returned * average_cost
   */
  {
    event_type: 'SALES_RETURN_STOCK',
    description: 'Pengembalian stok dari retur penjualan',
    debit_account_code: '1.103.001',  // Persediaan Barang Dagang
    credit_account_code: '5.100.000', // HPP
  },

  /**
   * PAYMENT_RECEIPT
   * Triggered when: Payment receipt from customer is posted
   * Journal: Debit Kas/Bank, Credit Piutang Dagang
   * Value: payment amount
   */
  {
    event_type: 'PAYMENT_RECEIPT',
    description: 'Penerimaan pembayaran dari customer',
    debit_account_code: '1.101.003',  // Bank - Rekening Utama
    credit_account_code: '1.102.001', // Piutang Dagang
  },

  // ============================================================
  // Additional Templates (Task 6.5 - for future implementation)
  // ============================================================

  /**
   * STOCK_ADJUSTMENT_POSITIVE
   * Triggered when: Positive stock adjustment is approved
   * Journal: Debit Persediaan Barang, Credit Selisih Persediaan
   * Value: qty_difference * average_cost
   */
  {
    event_type: 'STOCK_ADJUSTMENT_POSITIVE',
    description: 'Penyesuaian stok positif',
    debit_account_code: '1.103.001',  // Persediaan Barang Dagang
    credit_account_code: '6.203.000', // Selisih Persediaan
  },

  /**
   * STOCK_ADJUSTMENT_NEGATIVE
   * Triggered when: Negative stock adjustment is approved
   * Journal: Debit Selisih Persediaan, Credit Persediaan Barang
   * Value: qty_difference * average_cost
   */
  {
    event_type: 'STOCK_ADJUSTMENT_NEGATIVE',
    description: 'Penyesuaian stok negatif',
    debit_account_code: '6.203.000',  // Selisih Persediaan
    credit_account_code: '1.103.001', // Persediaan Barang Dagang
  },

  /**
   * STOCK_OPNAME_SURPLUS
   * Triggered when: Stock opname shows surplus
   * Journal: Debit Persediaan Barang, Credit Keuntungan Opname
   * Value: surplus_qty * average_cost
   */
  {
    event_type: 'STOCK_OPNAME_SURPLUS',
    description: 'Selisih lebih stock opname',
    debit_account_code: '1.103.001',  // Persediaan Barang Dagang
    credit_account_code: '4.201.000', // Keuntungan Opname
  },

  /**
   * STOCK_OPNAME_DEFICIT
   * Triggered when: Stock opname shows deficit
   * Journal: Debit Kerugian Opname, Credit Persediaan Barang
   * Value: deficit_qty * average_cost
   */
  {
    event_type: 'STOCK_OPNAME_DEFICIT',
    description: 'Selisih kurang stock opname',
    debit_account_code: '6.201.000',  // Kerugian Opname
    credit_account_code: '1.103.001', // Persediaan Barang Dagang
  },

  /**
   * PERIOD_CLOSING_REVENUE
   * Triggered when: Fiscal period is closed
   * Journal: Debit Pendapatan, Credit Ikhtisar Laba Rugi
   * Value: total revenue for the period
   */
  {
    event_type: 'PERIOD_CLOSING_REVENUE',
    description: 'Penutupan akun pendapatan',
    debit_account_code: '4.101.000',  // Pendapatan Penjualan
    credit_account_code: '3.103.000', // Ikhtisar Laba Rugi
  },

  /**
   * PERIOD_CLOSING_EXPENSE
   * Triggered when: Fiscal period is closed
   * Journal: Debit Ikhtisar Laba Rugi, Credit Beban
   * Value: total expenses for the period
   */
  {
    event_type: 'PERIOD_CLOSING_EXPENSE',
    description: 'Penutupan akun beban',
    debit_account_code: '3.103.000',  // Ikhtisar Laba Rugi
    credit_account_code: '6.100.000', // Beban Operasional
  },

  /**
   * PERIOD_CLOSING_NET
   * Triggered when: Fiscal period is closed (net income/loss)
   * Journal: Debit/Credit Ikhtisar Laba Rugi, Credit/Debit Laba Ditahan
   * Value: net income or loss
   */
  {
    event_type: 'PERIOD_CLOSING_NET',
    description: 'Penutupan ikhtisar laba rugi',
    debit_account_code: '3.103.000',  // Ikhtisar Laba Rugi
    credit_account_code: '3.102.000', // Laba Ditahan
  },

  /**
   * DEPRECIATION
   * Triggered when: Depreciation is recorded
   * Journal: Debit Beban Penyusutan, Credit Akumulasi Penyusutan
   * Value: depreciation amount
   */
  {
    event_type: 'DEPRECIATION',
    description: 'Penyusutan aset tetap',
    debit_account_code: '6.103.000',  // Beban Penyusutan
    credit_account_code: '1.205.000', // Akumulasi Penyusutan
  },

  /**
   * BANK_RECONCILIATION_ADJ
   * Triggered when: Bank reconciliation adjustment is made
   * Journal: Debit/Credit Selisih Bank, Credit/Debit Kas/Bank
   * Value: adjustment amount
   */
  {
    event_type: 'BANK_RECONCILIATION_ADJ',
    description: 'Penyesuaian rekonsiliasi bank',
    debit_account_code: '6.204.000',  // Selisih Bank
    credit_account_code: '1.101.003', // Bank - Rekening Utama
  },

  /**
   * WRITE_OFF_AR
   * Triggered when: AR invoice is written off
   * Journal: Debit Beban Piutang Tak Tertagih, Credit Piutang Dagang
   * Value: written off amount
   */
  {
    event_type: 'WRITE_OFF_AR',
    description: 'Penghapusan piutang tak tertagih',
    debit_account_code: '6.202.000',  // Beban Piutang Tak Tertagih
    credit_account_code: '1.102.001', // Piutang Dagang
  },
];

async function main() {
  console.log('🌱 Seeding Auto Journal Templates...');

  for (const template of JOURNAL_TEMPLATES) {
    // Find the account IDs
    const debitAccount = await prisma.chartOfAccount.findUnique({
      where: { account_code: template.debit_account_code },
    });

    const creditAccount = await prisma.chartOfAccount.findUnique({
      where: { account_code: template.credit_account_code },
    });

    if (!debitAccount) {
      console.warn(`  ⚠ Debit account not found: ${template.debit_account_code} for ${template.event_type}`);
      continue;
    }

    if (!creditAccount) {
      console.warn(`  ⚠ Credit account not found: ${template.credit_account_code} for ${template.event_type}`);
      continue;
    }

    await prisma.autoJournalTemplate.upsert({
      where: { event_type: template.event_type },
      update: {
        description: template.description,
        debit_account_id: debitAccount.id,
        credit_account_id: creditAccount.id,
        is_active: true,
      },
      create: {
        event_type: template.event_type,
        description: template.description,
        debit_account_id: debitAccount.id,
        credit_account_id: creditAccount.id,
        is_active: true,
      },
    });
  }

  console.log(`  ✓ Created ${JOURNAL_TEMPLATES.length} journal templates`);
  console.log('✅ Journal templates seed completed successfully');
}

main()
  .catch((e) => {
    console.error('❌ Journal templates seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
