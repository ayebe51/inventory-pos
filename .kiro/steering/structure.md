# Project Structure

## Domain Organization

9 bounded domain, masing-masing memiliki service interface TypeScript sendiri.

```
src/
├── modules/
│   ├── master-data/        # Product, Customer, Supplier, COA, Warehouse, PriceList, UOM
│   ├── purchase/           # PR, PO, GoodsReceipt, 3-way matching
│   ├── inventory/          # Stock ledger (append-only), Transfer, Adjustment, Opname
│   ├── pos/                # Shift, POSTransaction, SalesOrder, SalesReturn
│   ├── invoicing/          # Invoice (sales/purchase), Payment, BankReconciliation
│   ├── accounting/         # JournalEntry, FiscalPeriod, COA, TrialBalance
│   ├── reporting/          # Dashboard, FinancialStatements, StockReports, SalesReports
│   └── governance/         # RBAC, AuditTrail, ApprovalMatrix
│
├── services/               # Shared domain services (injected, never instantiated inline)
│   ├── auth/               # JWT, MFA, session invalidation
│   ├── rbac/               # Permission enforcement (MODULE.ACTION format)
│   ├── audit/              # Immutable audit logging
│   ├── numbering/          # Document number generation (DB unique constraint + retry)
│   ├── journal-engine/     # Auto double-entry journal (20 event types)
│   ├── approval-engine/    # Threshold-based approval matrix
│   └── period-manager/     # Fiscal period open/close lifecycle
│
├── common/                 # Base types, error classes, shared utilities
└── config/                 # App config, DB connections (primary + read replica)
```

## Spec Files

```
.kiro/specs/enterprise-inventory-pos-finance/
├── requirements.md     # Persyaratan fungsional & non-fungsional (Bahasa Indonesia)
├── design.md           # Arsitektur, data model, interface, algoritma, API contract
└── tasks.md            # Implementation task list
```

## Key Structural Rules

- Setiap modul mengekspos typed `interface` TypeScript — lihat `design.md` untuk semua definisi
- Domain services diinjeksikan ke modul, tidak pernah diinstansiasi inline
- Reporting module SELALU baca dari **read replica** — tidak boleh dari primary DB
- Audit logging HARUS dalam **transaksi DB yang sama** dengan operasi bisnis
- Inventory ledger entries **tidak pernah diupdate atau dihapus** — append-only
- Semua entitas menggunakan **UUID** sebagai primary key
- Soft delete via `deleted_at` — tidak ada hard delete

## Database Schema Overview

40+ tabel, dikelompokkan per domain:

| Grup | Tabel Utama |
|------|-------------|
| Core | branches, warehouses, users, roles, permissions, role_permissions, user_roles |
| Master Data | products, categories, brands, units_of_measure, customers, suppliers, price_lists, chart_of_accounts, fiscal_periods, payment_methods |
| Purchase | purchase_requests, purchase_orders, purchase_order_lines, goods_receipts, goods_receipt_lines |
| Inventory | **inventory_ledger** (append-only), stock_transfers, stock_adjustments, stock_opnames |
| Sales/POS | shifts, pos_transactions, pos_transaction_lines, pos_payments, sales_orders, delivery_orders, sales_returns |
| Invoicing | invoices, invoice_lines, invoice_allocations, payments, payment_allocations, bank_statements, bank_reconciliations |
| Accounting | journal_entries, journal_entry_lines, auto_journal_templates |
| Governance | audit_logs, approval_requests, approval_request_steps |

## Database Indexing Strategy

```sql
-- Inventory Ledger (query paling sering)
CREATE INDEX idx_inv_ledger_product_warehouse ON inventory_ledger(product_id, warehouse_id);
CREATE INDEX idx_inv_ledger_reference ON inventory_ledger(reference_type, reference_id);
CREATE INDEX idx_inv_ledger_date ON inventory_ledger(movement_date DESC);

-- Journal Entries
CREATE INDEX idx_je_lines_account_period ON journal_entry_lines(account_id, je_id);
CREATE INDEX idx_je_period ON journal_entries(period_id, status);

-- POS
CREATE INDEX idx_pos_shift ON pos_transactions(shift_id, status);
CREATE INDEX idx_pos_date ON pos_transactions(transaction_date DESC);

-- Partial index untuk active records
CREATE INDEX idx_products_active ON products(code, name) WHERE deleted_at IS NULL AND is_active = true;
```

## State Machines

Selalu validasi transisi status — tidak boleh update status secara arbitrary.

| Entitas | Status Flow |
|---------|-------------|
| Purchase Order | DRAFT → PENDING_APPROVAL → APPROVED → PARTIALLY_RECEIVED / FULLY_RECEIVED → CLOSED \| CANCELLED |
| Invoice | DRAFT → OPEN → PARTIAL / PAID / OVERDUE / DISPUTED / CANCELLED → WRITTEN_OFF |
| Payment | DRAFT → PENDING_APPROVAL → APPROVED → POSTED → RECONCILED / REVERSED |
| POS Transaction | OPEN → HELD / COMPLETED / VOIDED |
| Shift | OPEN → CLOSED / AUTO_CLOSED |
| Stock Opname | INITIATED → IN_PROGRESS → COMPLETED |
| Fiscal Period | DRAFT → OPEN → CLOSED |

## Business Rules Reference

### Inventory (BR-INV)
- **BR-INV-001**: Stok tidak boleh negatif (kecuali backorder aktif)
- **BR-INV-002**: Inventory ledger append-only; tidak ada UPDATE/DELETE
- **BR-INV-003**: Average cost >= 0
- **BR-INV-005**: Warehouse terkunci (opname) tidak bisa terima/keluarkan stok
- **BR-INV-008**: Stok in-transit tidak bisa dijual

### Purchase (BR-PUR)
- **BR-PUR-003**: 3-way matching: PO qty, GR qty, Invoice qty harus cocok (dalam toleransi)
- **BR-PUR-007**: Approval threshold berdasarkan total amount termasuk pajak
- **BR-PUR-008**: Supplier invoice tidak bisa melebihi PO amount + 5%

### Sales (BR-SAL)
- **BR-SAL-001**: Kasir harus buka shift sebelum transaksi POS
- **BR-SAL-002**: Harga jual tidak boleh di bawah floor price tanpa `PRICE.OVERRIDE`
- **BR-SAL-003**: Credit limit customer diperiksa sebelum SO disetujui
- **BR-SAL-004**: Void POS hanya oleh Supervisor (`POS.VOID`)

### Accounting (BR-ACC)
- **BR-ACC-001**: Journal entry harus balance (toleransi <= Rp 0,01)
- **BR-ACC-002**: Tidak ada transaksi di period yang sudah ditutup
- **BR-ACC-005**: COA dengan journal history tidak bisa dihapus (soft delete only)
- **BR-ACC-006**: Akun header (`is_header=true`) tidak bisa dipakai di journal line
- **BR-ACC-007**: Fiscal period ditutup secara berurutan
- **BR-ACC-008**: Bank reconciliation harus selesai sebelum period closing

## Separation of Duties (SOD)

Wajib di-enforce di **service layer**, bukan hanya UI.

| Rule | Constraint |
|------|-----------|
| SOD-001 | Pembuat PO tidak bisa menjadi approver PO yang sama |
| SOD-002 | Pembuat payment tidak bisa menjadi approver payment |
| SOD-003 | Kasir tidak bisa void transaksinya sendiri |

## RBAC Permission Format

Format: `MODULE.ACTION`

**Modul**: PURCHASE, INVENTORY, SALES, POS, INVOICE, PAYMENT, ACCOUNTING, REPORT, ADMIN

**Aksi Standar**: READ, CREATE, UPDATE, DELETE, APPROVE, VOID, POST, LOCK, EXPORT, IMPORT

**Permission Khusus**: PRICE.OVERRIDE, DISCOUNT.OVERRIDE, STOCK.ADJUST, STOCK.OPNAME, PERIOD.CLOSE, JOURNAL.REVERSE, REPORT.FINANCIAL, REPORT.EXECUTIVE, ADMIN.SETTINGS, ADMIN.USER

## Approval Matrix Purchase Order

| Level | Threshold | Approver |
|-------|-----------|---------|
| Level 1 | < Rp 5.000.000 | Supervisor Cabang |
| Level 2 | Rp 5.000.000 – Rp 50.000.000 | Finance Manager |
| Level 3 | > Rp 50.000.000 | Owner/Direktur |
