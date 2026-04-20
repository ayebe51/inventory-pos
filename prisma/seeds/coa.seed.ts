// Load .env before anything else
import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Standard Indonesian Chart of Accounts (COA)
 * Format: X.XXX.XXX (hierarki 5 level)
 * 
 * Account Types:
 * - ASSET: Aset (Debit normal)
 * - LIABILITY: Kewajiban (Credit normal)
 * - EQUITY: Ekuitas (Credit normal)
 * - REVENUE: Pendapatan (Credit normal)
 * - EXPENSE: Beban (Debit normal)
 * - COGS: Harga Pokok Penjualan (Debit normal)
 * - OTHER_INCOME: Pendapatan Lain-lain (Credit normal)
 * - OTHER_EXPENSE: Beban Lain-lain (Debit normal)
 */

interface COAAccount {
  account_code: string;
  account_name: string;
  account_type: string;
  account_category?: string;
  parent_code?: string;
  level: number;
  is_header: boolean;
  normal_balance: 'DEBIT' | 'CREDIT';
  is_system?: boolean;
}

const COA_ACCOUNTS: COAAccount[] = [
  // ============================================================
  // 1. ASET (ASSET)
  // ============================================================
  
  // 1.1 Aset Lancar
  { account_code: '1.000.000', account_name: 'Aset', account_type: 'ASSET', level: 1, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '1.100.000', account_name: 'Aset Lancar', account_type: 'ASSET', account_category: 'CURRENT_ASSET', parent_code: '1.000.000', level: 2, is_header: true, normal_balance: 'DEBIT' },
  
  // Kas & Bank
  { account_code: '1.101.000', account_name: 'Kas dan Bank', account_type: 'ASSET', account_category: 'CASH', parent_code: '1.100.000', level: 3, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '1.101.001', account_name: 'Kas Kecil', account_type: 'ASSET', account_category: 'CASH', parent_code: '1.101.000', level: 4, is_header: false, normal_balance: 'DEBIT', is_system: true },
  { account_code: '1.101.002', account_name: 'Kas Besar', account_type: 'ASSET', account_category: 'CASH', parent_code: '1.101.000', level: 4, is_header: false, normal_balance: 'DEBIT', is_system: true },
  { account_code: '1.101.003', account_name: 'Bank - Rekening Utama', account_type: 'ASSET', account_category: 'CASH', parent_code: '1.101.000', level: 4, is_header: false, normal_balance: 'DEBIT', is_system: true },
  { account_code: '1.101.004', account_name: 'Bank - Rekening Operasional', account_type: 'ASSET', account_category: 'CASH', parent_code: '1.101.000', level: 4, is_header: false, normal_balance: 'DEBIT', is_system: true },
  { account_code: '1.101.005', account_name: 'EDC Settlement', account_type: 'ASSET', account_category: 'CASH', parent_code: '1.101.000', level: 4, is_header: false, normal_balance: 'DEBIT', is_system: true },
  
  // Piutang
  { account_code: '1.102.000', account_name: 'Piutang Usaha', account_type: 'ASSET', account_category: 'RECEIVABLE', parent_code: '1.100.000', level: 3, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '1.102.001', account_name: 'Piutang Dagang', account_type: 'ASSET', account_category: 'RECEIVABLE', parent_code: '1.102.000', level: 4, is_header: false, normal_balance: 'DEBIT', is_system: true },
  { account_code: '1.102.002', account_name: 'Piutang Karyawan', account_type: 'ASSET', account_category: 'RECEIVABLE', parent_code: '1.102.000', level: 4, is_header: false, normal_balance: 'DEBIT' },
  { account_code: '1.102.003', account_name: 'Uang Muka Pembelian', account_type: 'ASSET', account_category: 'RECEIVABLE', parent_code: '1.102.000', level: 4, is_header: false, normal_balance: 'DEBIT' },
  
  // Persediaan
  { account_code: '1.103.000', account_name: 'Persediaan', account_type: 'ASSET', account_category: 'INVENTORY', parent_code: '1.100.000', level: 3, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '1.103.001', account_name: 'Persediaan Barang Dagang', account_type: 'ASSET', account_category: 'INVENTORY', parent_code: '1.103.000', level: 4, is_header: false, normal_balance: 'DEBIT', is_system: true },
  { account_code: '1.103.002', account_name: 'Persediaan Bahan Baku', account_type: 'ASSET', account_category: 'INVENTORY', parent_code: '1.103.000', level: 4, is_header: false, normal_balance: 'DEBIT' },
  { account_code: '1.103.003', account_name: 'Persediaan Barang Dalam Proses', account_type: 'ASSET', account_category: 'INVENTORY', parent_code: '1.103.000', level: 4, is_header: false, normal_balance: 'DEBIT' },
  
  // GR Clearing (untuk Goods Receipt)
  { account_code: '1.104.000', account_name: 'Akun Kliring', account_type: 'ASSET', account_category: 'CLEARING', parent_code: '1.100.000', level: 3, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '1.104.001', account_name: 'GR Clearing', account_type: 'ASSET', account_category: 'CLEARING', parent_code: '1.104.000', level: 4, is_header: false, normal_balance: 'DEBIT', is_system: true },
  
  // Pajak Dibayar Dimuka
  { account_code: '1.105.000', account_name: 'Pajak Dibayar Dimuka', account_type: 'ASSET', account_category: 'PREPAID_TAX', parent_code: '1.100.000', level: 3, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '1.105.001', account_name: 'PPN Masukan', account_type: 'ASSET', account_category: 'PREPAID_TAX', parent_code: '1.105.000', level: 4, is_header: false, normal_balance: 'DEBIT', is_system: true },
  { account_code: '1.105.002', account_name: 'PPh 23 Dibayar Dimuka', account_type: 'ASSET', account_category: 'PREPAID_TAX', parent_code: '1.105.000', level: 4, is_header: false, normal_balance: 'DEBIT' },
  
  // 1.2 Aset Tetap
  { account_code: '1.200.000', account_name: 'Aset Tetap', account_type: 'ASSET', account_category: 'FIXED_ASSET', parent_code: '1.000.000', level: 2, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '1.201.000', account_name: 'Tanah', account_type: 'ASSET', account_category: 'FIXED_ASSET', parent_code: '1.200.000', level: 3, is_header: false, normal_balance: 'DEBIT' },
  { account_code: '1.202.000', account_name: 'Bangunan', account_type: 'ASSET', account_category: 'FIXED_ASSET', parent_code: '1.200.000', level: 3, is_header: false, normal_balance: 'DEBIT' },
  { account_code: '1.203.000', account_name: 'Peralatan Kantor', account_type: 'ASSET', account_category: 'FIXED_ASSET', parent_code: '1.200.000', level: 3, is_header: false, normal_balance: 'DEBIT' },
  { account_code: '1.204.000', account_name: 'Kendaraan', account_type: 'ASSET', account_category: 'FIXED_ASSET', parent_code: '1.200.000', level: 3, is_header: false, normal_balance: 'DEBIT' },
  { account_code: '1.205.000', account_name: 'Akumulasi Penyusutan', account_type: 'ASSET', account_category: 'ACCUMULATED_DEPRECIATION', parent_code: '1.200.000', level: 3, is_header: false, normal_balance: 'CREDIT', is_system: true },
  
  // ============================================================
  // 2. KEWAJIBAN (LIABILITY)
  // ============================================================
  
  { account_code: '2.000.000', account_name: 'Kewajiban', account_type: 'LIABILITY', level: 1, is_header: true, normal_balance: 'CREDIT' },
  { account_code: '2.100.000', account_name: 'Kewajiban Lancar', account_type: 'LIABILITY', account_category: 'CURRENT_LIABILITY', parent_code: '2.000.000', level: 2, is_header: true, normal_balance: 'CREDIT' },
  
  // Hutang Usaha
  { account_code: '2.101.000', account_name: 'Hutang Usaha', account_type: 'LIABILITY', account_category: 'PAYABLE', parent_code: '2.100.000', level: 3, is_header: true, normal_balance: 'CREDIT' },
  { account_code: '2.101.001', account_name: 'Hutang Dagang', account_type: 'LIABILITY', account_category: 'PAYABLE', parent_code: '2.101.000', level: 4, is_header: false, normal_balance: 'CREDIT', is_system: true },
  { account_code: '2.101.002', account_name: 'Hutang Wesel', account_type: 'LIABILITY', account_category: 'PAYABLE', parent_code: '2.101.000', level: 4, is_header: false, normal_balance: 'CREDIT' },
  
  // Hutang Pajak
  { account_code: '2.102.000', account_name: 'Hutang Pajak', account_type: 'LIABILITY', account_category: 'TAX_PAYABLE', parent_code: '2.100.000', level: 3, is_header: true, normal_balance: 'CREDIT' },
  { account_code: '2.102.001', account_name: 'PPN Keluaran', account_type: 'LIABILITY', account_category: 'TAX_PAYABLE', parent_code: '2.102.000', level: 4, is_header: false, normal_balance: 'CREDIT', is_system: true },
  { account_code: '2.102.002', account_name: 'Hutang PPh 21', account_type: 'LIABILITY', account_category: 'TAX_PAYABLE', parent_code: '2.102.000', level: 4, is_header: false, normal_balance: 'CREDIT' },
  { account_code: '2.102.003', account_name: 'Hutang PPh 23', account_type: 'LIABILITY', account_category: 'TAX_PAYABLE', parent_code: '2.102.000', level: 4, is_header: false, normal_balance: 'CREDIT' },
  { account_code: '2.102.004', account_name: 'Hutang PPh Badan', account_type: 'LIABILITY', account_category: 'TAX_PAYABLE', parent_code: '2.102.000', level: 4, is_header: false, normal_balance: 'CREDIT' },
  
  // Hutang Lain-lain
  { account_code: '2.103.000', account_name: 'Hutang Lain-lain', account_type: 'LIABILITY', account_category: 'OTHER_PAYABLE', parent_code: '2.100.000', level: 3, is_header: true, normal_balance: 'CREDIT' },
  { account_code: '2.103.001', account_name: 'Uang Muka Penjualan', account_type: 'LIABILITY', account_category: 'OTHER_PAYABLE', parent_code: '2.103.000', level: 4, is_header: false, normal_balance: 'CREDIT' },
  { account_code: '2.103.002', account_name: 'Hutang Gaji', account_type: 'LIABILITY', account_category: 'OTHER_PAYABLE', parent_code: '2.103.000', level: 4, is_header: false, normal_balance: 'CREDIT' },
  
  // 2.2 Kewajiban Jangka Panjang
  { account_code: '2.200.000', account_name: 'Kewajiban Jangka Panjang', account_type: 'LIABILITY', account_category: 'LONG_TERM_LIABILITY', parent_code: '2.000.000', level: 2, is_header: true, normal_balance: 'CREDIT' },
  { account_code: '2.201.000', account_name: 'Hutang Bank', account_type: 'LIABILITY', account_category: 'LONG_TERM_LIABILITY', parent_code: '2.200.000', level: 3, is_header: false, normal_balance: 'CREDIT' },
  
  // ============================================================
  // 3. EKUITAS (EQUITY)
  // ============================================================
  
  { account_code: '3.000.000', account_name: 'Ekuitas', account_type: 'EQUITY', level: 1, is_header: true, normal_balance: 'CREDIT' },
  { account_code: '3.100.000', account_name: 'Modal', account_type: 'EQUITY', account_category: 'CAPITAL', parent_code: '3.000.000', level: 2, is_header: true, normal_balance: 'CREDIT' },
  { account_code: '3.101.000', account_name: 'Modal Disetor', account_type: 'EQUITY', account_category: 'CAPITAL', parent_code: '3.100.000', level: 3, is_header: false, normal_balance: 'CREDIT' },
  { account_code: '3.102.000', account_name: 'Laba Ditahan', account_type: 'EQUITY', account_category: 'RETAINED_EARNINGS', parent_code: '3.100.000', level: 3, is_header: false, normal_balance: 'CREDIT', is_system: true },
  { account_code: '3.103.000', account_name: 'Ikhtisar Laba Rugi', account_type: 'EQUITY', account_category: 'INCOME_SUMMARY', parent_code: '3.100.000', level: 3, is_header: false, normal_balance: 'CREDIT', is_system: true },
  
  // ============================================================
  // 4. PENDAPATAN (REVENUE)
  // ============================================================
  
  { account_code: '4.000.000', account_name: 'Pendapatan', account_type: 'REVENUE', level: 1, is_header: true, normal_balance: 'CREDIT' },
  { account_code: '4.100.000', account_name: 'Pendapatan Usaha', account_type: 'REVENUE', account_category: 'OPERATING_REVENUE', parent_code: '4.000.000', level: 2, is_header: true, normal_balance: 'CREDIT' },
  { account_code: '4.101.000', account_name: 'Pendapatan Penjualan', account_type: 'REVENUE', account_category: 'OPERATING_REVENUE', parent_code: '4.100.000', level: 3, is_header: false, normal_balance: 'CREDIT', is_system: true },
  { account_code: '4.102.000', account_name: 'Potongan Penjualan', account_type: 'REVENUE', account_category: 'OPERATING_REVENUE', parent_code: '4.100.000', level: 3, is_header: false, normal_balance: 'DEBIT' },
  { account_code: '4.103.000', account_name: 'Retur Penjualan', account_type: 'REVENUE', account_category: 'OPERATING_REVENUE', parent_code: '4.100.000', level: 3, is_header: false, normal_balance: 'DEBIT', is_system: true },
  
  { account_code: '4.200.000', account_name: 'Pendapatan Lain-lain', account_type: 'OTHER_INCOME', account_category: 'OTHER_REVENUE', parent_code: '4.000.000', level: 2, is_header: true, normal_balance: 'CREDIT' },
  { account_code: '4.201.000', account_name: 'Keuntungan Opname', account_type: 'OTHER_INCOME', account_category: 'OTHER_REVENUE', parent_code: '4.200.000', level: 3, is_header: false, normal_balance: 'CREDIT', is_system: true },
  { account_code: '4.202.000', account_name: 'Pendapatan Bunga', account_type: 'OTHER_INCOME', account_category: 'OTHER_REVENUE', parent_code: '4.200.000', level: 3, is_header: false, normal_balance: 'CREDIT' },
  
  // ============================================================
  // 5. HARGA POKOK PENJUALAN (COGS)
  // ============================================================
  
  { account_code: '5.000.000', account_name: 'Harga Pokok Penjualan', account_type: 'COGS', level: 1, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '5.100.000', account_name: 'HPP', account_type: 'COGS', account_category: 'COST_OF_SALES', parent_code: '5.000.000', level: 2, is_header: false, normal_balance: 'DEBIT', is_system: true },
  
  // ============================================================
  // 6. BEBAN (EXPENSE)
  // ============================================================
  
  { account_code: '6.000.000', account_name: 'Beban', account_type: 'EXPENSE', level: 1, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '6.100.000', account_name: 'Beban Operasional', account_type: 'EXPENSE', account_category: 'OPERATING_EXPENSE', parent_code: '6.000.000', level: 2, is_header: true, normal_balance: 'DEBIT' },
  
  // Beban Personalia
  { account_code: '6.101.000', account_name: 'Beban Personalia', account_type: 'EXPENSE', account_category: 'OPERATING_EXPENSE', parent_code: '6.100.000', level: 3, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '6.101.001', account_name: 'Beban Gaji', account_type: 'EXPENSE', account_category: 'OPERATING_EXPENSE', parent_code: '6.101.000', level: 4, is_header: false, normal_balance: 'DEBIT' },
  { account_code: '6.101.002', account_name: 'Beban Tunjangan', account_type: 'EXPENSE', account_category: 'OPERATING_EXPENSE', parent_code: '6.101.000', level: 4, is_header: false, normal_balance: 'DEBIT' },
  
  // Beban Umum
  { account_code: '6.102.000', account_name: 'Beban Umum', account_type: 'EXPENSE', account_category: 'OPERATING_EXPENSE', parent_code: '6.100.000', level: 3, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '6.102.001', account_name: 'Beban Listrik', account_type: 'EXPENSE', account_category: 'OPERATING_EXPENSE', parent_code: '6.102.000', level: 4, is_header: false, normal_balance: 'DEBIT' },
  { account_code: '6.102.002', account_name: 'Beban Air', account_type: 'EXPENSE', account_category: 'OPERATING_EXPENSE', parent_code: '6.102.000', level: 4, is_header: false, normal_balance: 'DEBIT' },
  { account_code: '6.102.003', account_name: 'Beban Telepon dan Internet', account_type: 'EXPENSE', account_category: 'OPERATING_EXPENSE', parent_code: '6.102.000', level: 4, is_header: false, normal_balance: 'DEBIT' },
  { account_code: '6.102.004', account_name: 'Beban Sewa', account_type: 'EXPENSE', account_category: 'OPERATING_EXPENSE', parent_code: '6.102.000', level: 4, is_header: false, normal_balance: 'DEBIT' },
  
  // Beban Penyusutan
  { account_code: '6.103.000', account_name: 'Beban Penyusutan', account_type: 'EXPENSE', account_category: 'DEPRECIATION', parent_code: '6.100.000', level: 3, is_header: false, normal_balance: 'DEBIT', is_system: true },
  
  // Beban Lain-lain
  { account_code: '6.200.000', account_name: 'Beban Lain-lain', account_type: 'OTHER_EXPENSE', account_category: 'OTHER_EXPENSE', parent_code: '6.000.000', level: 2, is_header: true, normal_balance: 'DEBIT' },
  { account_code: '6.201.000', account_name: 'Kerugian Opname', account_type: 'OTHER_EXPENSE', account_category: 'OTHER_EXPENSE', parent_code: '6.200.000', level: 3, is_header: false, normal_balance: 'DEBIT', is_system: true },
  { account_code: '6.202.000', account_name: 'Beban Piutang Tak Tertagih', account_type: 'OTHER_EXPENSE', account_category: 'OTHER_EXPENSE', parent_code: '6.200.000', level: 3, is_header: false, normal_balance: 'DEBIT', is_system: true },
  { account_code: '6.203.000', account_name: 'Selisih Persediaan', account_type: 'OTHER_EXPENSE', account_category: 'OTHER_EXPENSE', parent_code: '6.200.000', level: 3, is_header: false, normal_balance: 'DEBIT', is_system: true },
  { account_code: '6.204.000', account_name: 'Selisih Bank', account_type: 'OTHER_EXPENSE', account_category: 'OTHER_EXPENSE', parent_code: '6.200.000', level: 3, is_header: false, normal_balance: 'DEBIT', is_system: true },
];

async function main() {
  console.log('🌱 Seeding Chart of Accounts...');

  // Build a map of account_code → id for parent lookups
  const codeToId = new Map<string, string>();

  // First pass: create all accounts without parent references
  for (const account of COA_ACCOUNTS) {
    const created = await prisma.chartOfAccount.upsert({
      where: { account_code: account.account_code },
      update: {
        account_name: account.account_name,
        account_type: account.account_type,
        account_category: account.account_category,
        level: account.level,
        is_header: account.is_header,
        normal_balance: account.normal_balance,
        is_system: account.is_system ?? false,
      },
      create: {
        account_code: account.account_code,
        account_name: account.account_name,
        account_type: account.account_type,
        account_category: account.account_category,
        level: account.level,
        is_header: account.is_header,
        normal_balance: account.normal_balance,
        is_system: account.is_system ?? false,
      },
    });
    codeToId.set(account.account_code, created.id);
  }
  console.log(`  ✓ Created ${COA_ACCOUNTS.length} COA accounts`);

  // Second pass: update parent references
  for (const account of COA_ACCOUNTS) {
    if (account.parent_code) {
      const parentId = codeToId.get(account.parent_code);
      if (parentId) {
        await prisma.chartOfAccount.update({
          where: { account_code: account.account_code },
          data: { parent_id: parentId },
        });
      }
    }
  }
  console.log('  ✓ Set parent references');

  console.log('✅ COA seed completed successfully');
}

main()
  .catch((e) => {
    console.error('❌ COA seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
