# Finance Domain Boundary & Architectural Specification

## Overview

Aplikasi ini dikembangkan dengan pendekatan **Modular Monolith** dengan tiga bounded context utama:
1. **POS (Point of Sale)**
2. **Inventory & Purchasing**
3. **Finance & Accounting**

Secara arsitektural, **Finance** bukanlah modul yang "menempel" secara sederhana ke POS, melainkan **Financial & Accounting Engine** yang berdiri independen dengan posting engine terkontrol.

---

## Domain Boundary & Ownership

### Finance Domain OWNS:
- **Chart of Accounts (COA)** — Master data akun keuangan & hierarki.
- **Journal Entries & General Ledger (GL)** — Single source of truth seluruh transaksi keuangan.
- **Fiscal Periods** — Manajemen periode fiskal, validasi status open/close, dan closing entry.
- **Accounts Receivable (AR)** — Tracking piutang dagang, AR aging report, write-off bad debt.
- **Accounts Payable (AP)** — Tracking hutang supplier, AP aging report, supplier payment.
- **Cash & Bank Accounts** — Running balance kas/bank, kas kecil, settlement EDC, transfer antar rekening.
- **Operational Expense Records** — Pencatatan beban operasional per kategori & cost center.
- **Tax Management** — PPN Keluaran vs PPN Masukan & setor kas negara.
- **Fixed Assets & Depreciation** — Aset tetap dan beban penyusutan periodik.
- **Bank Reconciliation** — Import & matching rekening koran.

### Finance Domain DOES NOT OWN (Read-only reference):
- **POS Transactions** (Milik POS domain)
- **Products, Stock & Warehouses** (Milik Inventory domain)
- **Purchase Orders & Goods Receipts** (Milik Purchase/Inventory domain)

---

## Accounting Posting Engine Rules

1. **No Direct Insert**: Domain lain (POS, Inventory, Purchase, Invoicing) **DILARANG** melakukan direct `INSERT` ke tabel `journal_entries` atau `journal_entry_lines`.
2. **Event-Driven Posting**: Semua transaksi keuangan dari domain luar dikirimkan sebagai `BusinessEvent` ke `JournalEngineService.processEvent(event, tx)`.
3. **Database-Driven Template Rules**: `JournalEngineService` menggunakan `AutoJournalTemplate` di database untuk menentukan aturan debit & kredit (misalnya `POS_SALE`, `GOODS_RECEIPT`, `SUPPLIER_INVOICE`, `POS_SALE_REVERSAL`).
4. **Transaction Atomicity**: `processEvent()` menerima optional Prisma transaction client (`tx`). Transaksi bisnis (misalnya POS Sale completion) dan posting jurnal dikomit atau dirollback secara atomik dalam satu DB transaction.
5. **Balance Validation (BR-ACC-001)**: Setiap jurnal wajib memiliki `|SUM(debit) - SUM(credit)| <= 0.01`. Jika tidak balance, transaksi bisnis akan langsung dirollback.
6. **Open Period Enforcement (BR-ACC-002)**: Posting jurnal hanya diizinkan pada periode fiskal dengan status `OPEN`.

---

## Integration Flow Example

### POS Transaction Flow:
```
[ POS UI ] 
    │
    ▼
[ POSTransaction Service ]
    │
    ├── Update POS Transaction Status -> COMPLETED
    ├── Insert Inventory Ledger (qty_out, running_qty, running_cost)
    │
    ▼ (Call Finance Posting Engine)
[ JournalEngineService.processEvent() ]
    │
    ├── 1. POS_SALE Event       -> Dr Cash/Bank/EDC , Cr Revenue & PPN Keluaran
    └── 2. POS_SALE_COGS Event  -> Dr HPP Expense    , Cr Persediaan Asset
    │
    ▼
[ General Ledger & Financial Reports ]
```

### Void POS Transaction Flow (Fix P0):
```
[ POS Void Action ] 
    │
    ▼
[ POSTransaction Service ]
    │
    ├── Update POS Transaction Status -> VOIDED
    ├── Insert Inventory Ledger (qty_in, running_qty, running_cost)
    │
    ▼ (Call Finance Posting Engine)
[ JournalEngineService.processEvent() ]
    │
    ├── 1. POS_SALE_REVERSAL      -> Dr Revenue          , Cr Cash/Bank
    └── 2. POS_SALE_COGS_REVERSAL -> Dr Persediaan Asset , Cr HPP Expense
    │
    ▼
[ General Ledger (Balanced Position) ]
```

---

## Technical File Locations

- **Accounting Posting Engine**: `src/services/journal-engine/journal-engine.service.ts`
- **Finance Module**: `src/modules/accounting/accounting.module.ts`
- **AR Service**: `src/modules/accounting/services/ar.service.ts`
- **AP Service**: `src/modules/accounting/services/ap.service.ts`
- **Cash & Bank Service**: `src/modules/accounting/services/cash-bank.service.ts`
- **Expense Service**: `src/modules/accounting/services/expense.service.ts`
- **Tax Service**: `src/modules/accounting/services/tax.service.ts`
- **Financial Reporting**: `src/modules/reporting/services/reporting.service.ts`
- **Finance Frontend UI**: `frontend/src/features/finance/components/FinancePage.tsx`
