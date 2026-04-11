# Rencana Implementasi: Enterprise Inventory + POS + Finance

## Task 1: Project Foundation & Infrastructure Setup

- [x] 1.1 Inisialisasi NestJS project dengan TypeScript, konfigurasi Prisma ORM, dan koneksi PostgreSQL primary + read replica
- [x] 1.2 Setup Redis 7+ Cluster untuk caching dengan TTL 5 menit untuk master data
- [x] 1.3 Buat struktur folder domain: `src/modules/`, `src/services/`, `src/common/`, `src/config/`
- [x] 1.4 Implementasi standard API response envelope `APIResponse<T>` dan `APIError` dengan semua error codes
- [x] 1.5 Konfigurasi global exception filter untuk mapping HTTP status codes sesuai spesifikasi
- [x] 1.6 Setup Jest + fast-check untuk unit testing dan property-based testing
- [x] 1.7 Buat Prisma schema awal dengan semua 40+ tabel beserta indexes dan constraints

## Task 2: Database Schema & Migrations

- [x] 2.1 Buat migration untuk tabel core: `branches`, `warehouses`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`
- [x] 2.2 Buat migration untuk tabel master data: `products`, `categories`, `brands`, `units_of_measure`, `customers`, `suppliers`, `price_lists`, `chart_of_accounts`, `fiscal_periods`, `payment_methods`
- [x] 2.3 Buat migration untuk tabel purchase: `purchase_requests`, `purchase_orders`, `purchase_order_lines`, `goods_receipts`, `goods_receipt_lines`
- [x] 2.4 Buat migration untuk tabel inventory: `inventory_ledger` (append-only, tanpa updated_at/deleted_at), `stock_transfers`, `stock_adjustments`, `stock_opnames`
- [x] 2.5 Buat migration untuk tabel sales/POS: `shifts`, `pos_transactions`, `pos_transaction_lines`, `pos_payments`, `sales_orders`, `delivery_orders`, `sales_returns`
- [x] 2.6 Buat migration untuk tabel invoicing: `invoices`, `invoice_lines`, `invoice_allocations`, `payments`, `payment_allocations`, `bank_statements`, `bank_reconciliations`
- [x] 2.7 Buat migration untuk tabel accounting: `journal_entries`, `journal_entry_lines`, `auto_journal_templates`
- [x] 2.8 Buat migration untuk tabel governance: `audit_logs` (immutable, tanpa updated_at/deleted_at), `approval_requests`, `approval_request_steps`
- [x] 2.9 Tambahkan semua database indexes: inventory ledger, journal entries, POS, dan partial index untuk active records

## Task 3: Domain Services — Auth & RBAC

- [x] 3.1 Implementasi `AuthService`: login dengan bcrypt (cost factor 12), issue JWT access token (15 menit) dan refresh token (7 hari)
- [x] 3.2 Implementasi token refresh, logout, dan invalidasi semua sesi saat password diubah
- [x] 3.3 Implementasi MFA (TOTP) untuk role Owner, Finance_Manager, dan Auditor
- [x] 3.4 Implementasi `RBACService.checkPermission()` dengan format `MODULE.ACTION` dan semua permission khusus
- [x] 3.5 Buat NestJS Guard untuk RBAC yang digunakan sebagai decorator di semua endpoint
- [x] 3.6 Seed data roles dan permissions untuk 10 persona: Owner, Sys_Admin, Finance_Manager, Finance_Staff, Warehouse_Manager, Warehouse_Staff, Cashier, Supervisor, Purchasing_Staff, Auditor
- [x] 3.7 Property-based test: untuk setiap kombinasi role-permission, verifikasi `checkPermission` konsisten dengan matriks akses

## Task 4: Domain Services — Audit Trail

- [x] 4.1 Implementasi `AuditTrailService.record()` yang mencatat user_id, action, entity_type, entity_id, snapshot before/after, IP address, user agent, timestamp
- [x] 4.2 Pastikan audit log ditulis dalam transaksi DB yang sama dengan operasi bisnis (atomik)
- [ ] 4.3 Implementasi `AuditTrailService.query()` dengan filter dan pagination
- [ ] 4.4 Validasi bahwa tabel `audit_logs` tidak memiliki field `updated_at` atau `deleted_at` (immutable)
- [ ] 4.5 Unit test: verifikasi audit log tidak bisa diupdate atau dihapus setelah dibuat

## Task 5: Domain Services — Document Numbering

- [ ] 5.1 Implementasi `NumberingService` dengan format per dokumen: PR, PO, GR, INV, POS, RCV, PV, JE, SA, SO, CN, DN, TO
- [ ] 5.2 Implementasi DB unique constraint + exponential backoff retry (max 3x) untuk race condition
- [ ] 5.3 Property-based test: generate 1000 nomor dokumen secara concurrent, verifikasi tidak ada duplikat

## Task 6: Domain Services — Auto Journal Engine

- [ ] 6.1 Implementasi `AutoJournalEngine.processEvent()` dengan 20 jenis event journal sesuai tabel di design
- [ ] 6.2 Implementasi `validateJournalBalance()`: `|SUM(debit) - SUM(credit)| <= 0.01` (BR-ACC-001)
- [ ] 6.3 Pastikan auto journal dan transaksi bisnis dalam satu DB transaction — rollback keduanya jika gagal
- [ ] 6.4 Implementasi template journal untuk: Goods Receipt, Supplier Invoice, Purchase Payment, Sales Invoice, Sales Invoice COGS, POS Sale, POS Sale COGS, Sales Return, Sales Return Stock, Payment Receipt
- [ ] 6.5 Implementasi template journal untuk: Stock Adjustment (+/-), Stock Opname Surplus/Defisit, Period Closing Revenue/Expense/Net, Depreciation, Bank Reconciliation Adj, Write-off AR
- [ ] 6.6 Property-based test: untuk setiap event journal, verifikasi `SUM(debit) = SUM(credit)` selalu terpenuhi

## Task 7: Domain Services — Approval Engine & Period Manager

- [ ] 7.1 Implementasi `ApprovalMatrixService.getApprovalChain()` berdasarkan threshold: Level 1 < 5jt, Level 2 5-50jt, Level 3 > 50jt
- [ ] 7.2 Implementasi SOD enforcement: SOD-001 (pembuat PO ≠ approver), SOD-002 (pembuat payment ≠ approver), SOD-003 (kasir ≠ void sendiri)
- [ ] 7.3 Implementasi `PeriodManager`: buat, buka, tutup fiscal period dengan validasi urutan berurutan (BR-ACC-007)
- [ ] 7.4 Implementasi period locking: tolak transaksi ke period CLOSED dengan error `PERIOD_LOCKED` (BR-ACC-002)
- [ ] 7.5 Implementasi checklist period closing: validasi tidak ada open invoice, pending payment, unbalanced journal, incomplete reconciliation, incomplete opname

## Task 8: Master Data Module

- [ ] 8.1 Implementasi `ProductService`: CRUD produk dengan validasi (kode max 50 char, nama max 200 char, cost >= 0, price >= 0)
- [ ] 8.2 Implementasi soft delete produk via `deleted_at`, search dengan filter dan pagination
- [ ] 8.3 Implementasi `WarehouseService`: CRUD gudang, validasi kode unik per branch, lock/unlock warehouse
- [ ] 8.4 Implementasi hierarki organisasi: Head Office → Branch → Warehouse → Outlet dengan validasi parent-child
- [ ] 8.5 Implementasi `PriceListService.getActivePrice()`: resolusi harga berdasarkan produk, customer, dan tanggal
- [ ] 8.6 Implementasi COA management: hierarki 5 level, format kode X.XXX.XXX, validasi is_header tidak bisa diposting (BR-ACC-006)
- [ ] 8.7 Implementasi Customer dan Supplier CRUD dengan credit limit
- [ ] 8.8 Redis caching untuk master data (TTL 5 menit), invalidasi cache saat data diupdate
- [ ] 8.9 REST API endpoints untuk semua master data dengan RBAC guard
- [ ] 8.10 Unit test untuk semua validasi business rules master data

## Task 9: Purchase / Procurement Module

- [ ] 9.1 Implementasi `PurchaseRequestService`: buat PR dengan nomor PR-YYYYMM-XXXXX, status DRAFT
- [ ] 9.2 Implementasi `PurchaseOrderService`: buat PO dari PR, state machine DRAFT → PENDING_APPROVAL → APPROVED → PARTIALLY_RECEIVED/FULLY_RECEIVED → CLOSED/CANCELLED
- [ ] 9.3 Implementasi PO submit: tentukan approval level berdasarkan total amount termasuk pajak (BR-PUR-007)
- [ ] 9.4 Implementasi PO approve/reject dengan validasi RBAC (PURCHASE.APPROVE) dan SOD-001
- [ ] 9.5 Implementasi `GoodsReceiptService`: buat GR dari PO, validasi qty tidak melebihi PO qty × (1 + toleransi) (BR-PUR-003)
- [ ] 9.6 Implementasi GR confirm: update qty_received di PO lines, update status PO, trigger WAC recalculation, trigger auto journal GR
- [ ] 9.7 Implementasi 3-way matching: validasi PO qty vs GR qty vs supplier invoice qty dalam toleransi
- [ ] 9.8 Validasi supplier invoice tidak melebihi PO amount + 5% (BR-PUR-008)
- [ ] 9.9 REST API endpoints untuk PR, PO, GR dengan RBAC guard
- [ ] 9.10 Unit test state machine PO dan property-based test untuk approval threshold

## Task 10: Inventory Module

- [ ] 10.1 Implementasi `InventoryService.recordMovement()`: append-only insert ke `inventory_ledger`, tidak ada UPDATE/DELETE (BR-INV-002)
- [ ] 10.2 Implementasi `getStockBalance()`: `SUM(qty_in) - SUM(qty_out)` per (product_id, warehouse_id)
- [ ] 10.3 Implementasi negative stock check: tolak transaksi jika balance akan negatif dengan error `INSUFFICIENT_STOCK` (BR-INV-001)
- [ ] 10.4 Implementasi `calculateAverageCost()` dengan formula WAC: `ROUND((current_value + incoming_cost) / (current_qty + incoming_qty), 4)` (BR-INV-003)
- [ ] 10.5 Implementasi `transferStock()`: pessimistic locking (`SELECT FOR UPDATE NOWAIT`), atomik kurangi stok asal + tambah stok tujuan, verifikasi total stok tidak berubah
- [ ] 10.6 Implementasi `adjustStock()`: validasi permission STOCK.ADJUST, wajib ada alasan, trigger auto journal
- [ ] 10.7 Implementasi `StockOpnameService`: initiate (kunci warehouse), recordCount, requestRecount, finalize (buat adjustment + buka warehouse)
- [ ] 10.8 Implementasi status stok: Available, Reserved, Committed, Damaged, Quarantine, Frozen/Locked, In-Transit
- [ ] 10.9 Validasi stok In-Transit tidak bisa dijual (BR-INV-008), warehouse locked tidak bisa terima/keluarkan stok (BR-INV-005)
- [ ] 10.10 REST API endpoints untuk inventory dengan RBAC guard
- [ ] 10.11 Property-based test: verifikasi `SUM(qty_in) - SUM(qty_out)` selalu konsisten setelah setiap operasi

## Task 11: POS / Sales Module

- [ ] 11.1 Implementasi `POSService.openShift()`: catat opening balance, cashier_id, waktu buka; tolak jika shift sebelumnya masih aktif (BR-SAL-001)
- [ ] 11.2 Implementasi `createTransaction()` dan `addItem()`: cek stok tersedia, validasi floor price (BR-SAL-002), optimistic locking dengan version field
- [ ] 11.3 Implementasi price override (PRICE.OVERRIDE) dan discount override (DISCOUNT.OVERRIDE)
- [ ] 11.4 Implementasi `applyPayment()`: validasi total bayar >= total transaksi, multi-metode pembayaran (tunai, kartu, transfer, EDC), hitung kembalian
- [ ] 11.5 Implementasi complete transaction: kurangi stok di inventory ledger, trigger auto journal POS Sale + COGS dalam satu DB transaction
- [ ] 11.6 Implementasi `holdTransaction()` dan `resumeTransaction()`
- [ ] 11.7 Implementasi `voidTransaction()`: validasi POS.VOID permission (BR-SAL-004), enforce SOD-003 (kasir tidak bisa void sendiri)
- [ ] 11.8 Implementasi `closeShift()`: generate shift report (total transaksi, per metode pembayaran, selisih kas)
- [ ] 11.9 Implementasi force-close shift oleh Supervisor dengan status AUTO_CLOSED
- [ ] 11.10 Implementasi barcode scan via BarcodeDetector API dengan fallback @zxing/browser
- [ ] 11.11 REST API endpoints untuk POS dengan RBAC guard
- [ ] 11.12 Unit test semua business rules POS dan SOD enforcement

## Task 12: Sales Order (B2B) Module

- [ ] 12.1 Implementasi `SalesOrderService.create()`: validasi credit limit customer (BR-SAL-003), tolak jika terlampaui
- [ ] 12.2 Implementasi SO approve, fulfill (buat Delivery Order, kurangi stok)
- [ ] 12.3 Implementasi `createReturn()`: validasi referensi transaksi asal valid, trigger auto journal Sales Return + Stock Return
- [ ] 12.4 REST API endpoints untuk Sales Order dan Sales Return
- [ ] 12.5 Unit test credit limit check dan return flow

## Task 13: Invoicing & Payment Module

- [ ] 13.1 Implementasi `InvoiceService.createSalesInvoice()`: nomor INV-YYYYMM-XXXXX, status DRAFT
- [ ] 13.2 Implementasi `post()`: ubah status ke OPEN, trigger auto journal Sales Invoice
- [ ] 13.3 Implementasi `createPurchaseInvoice()`: validasi total tidak melebihi PO amount + 5% (BR-PUR-008)
- [ ] 13.4 Implementasi state machine invoice: DRAFT → OPEN → PARTIAL/PAID/OVERDUE/DISPUTED/CANCELLED → WRITTEN_OFF
- [ ] 13.5 Implementasi partial payment allocation: kurangi outstanding balance, auto-update status ke PARTIAL atau PAID
- [ ] 13.6 Implementasi multi-invoice allocation: validasi total alokasi tidak melebihi jumlah pembayaran
- [ ] 13.7 Implementasi overpayment: catat selisih sebagai advance payment customer
- [ ] 13.8 Implementasi auto-update status ke OVERDUE saat due date terlampaui
- [ ] 13.9 Implementasi `PaymentService`: buat payment (RCV/PV), state machine DRAFT → PENDING_APPROVAL → APPROVED → POSTED → RECONCILED/REVERSED
- [ ] 13.10 Implementasi payment approval dengan SOD-002 enforcement
- [ ] 13.11 Implementasi payment reversal dengan auto journal pembalik
- [ ] 13.12 Implementasi `BankReconciliationService`: import bank statement, auto-match berdasarkan jumlah dan tanggal, manual match, identifikasi outstanding items
- [ ] 13.13 Implementasi write-off AR dengan validasi permission dan auto journal
- [ ] 13.14 REST API endpoints untuk invoice, payment, bank reconciliation
- [ ] 13.15 Unit test semua state machine dan payment allocation logic

## Task 14: Accounting Module

- [ ] 14.1 Implementasi `AccountingService.postJournalEntry()`: validasi balance debit = credit (toleransi <= 0.01), set status POSTED, catat posted_by dan posted_at
- [ ] 14.2 Implementasi `reverseJournalEntry()`: validasi JOURNAL.REVERSE permission, buat journal baru dengan debit/credit dibalik, update status asal ke REVERSED
- [ ] 14.3 Implementasi reversal di period berbeda dari journal asal
- [ ] 14.4 Implementasi COA management: validasi is_header tidak bisa diposting (BR-ACC-006), soft delete only jika ada journal history (BR-ACC-005)
- [ ] 14.5 Implementasi `getTrialBalance()`: saldo semua akun aktif, verifikasi total debit = total credit
- [ ] 14.6 Implementasi `closePeriod()`: jalankan checklist wajib, posting closing entries (revenue/expense ke ikhtisar laba rugi), buka period berikutnya
- [ ] 14.7 Validasi fiscal period ditutup berurutan (BR-ACC-007)
- [ ] 14.8 REST API endpoints untuk journal entry, COA, fiscal period
- [ ] 14.9 Property-based test: untuk setiap journal entry yang valid, verifikasi `|SUM(debit) - SUM(credit)| <= 0.01`

## Task 15: Reporting Module

- [ ] 15.1 Implementasi `ReportingService` dengan koneksi ke **read replica** untuk semua query laporan
- [ ] 15.2 Implementasi `getExecutiveDashboard()`: total penjualan, pembelian, posisi kas, AR/AP outstanding, top 5 produk terlaris — hanya untuk REPORT.EXECUTIVE
- [ ] 15.3 Implementasi `getTrialBalance()`: saldo semua akun aktif per fiscal period
- [ ] 15.4 Implementasi `getIncomeStatement()`: pendapatan, HPP, laba kotor, beban operasional, laba bersih
- [ ] 15.5 Implementasi `getBalanceSheet()`: aset, liabilitas, ekuitas — verifikasi total aset = liabilitas + ekuitas
- [ ] 15.6 Implementasi `getCashFlow()`: klasifikasi arus kas ke aktivitas operasi, investasi, pendanaan
- [ ] 15.7 Implementasi `getARAgingReport()` dan `getAPAgingReport()`: bucket Current, 1-30, 31-60, 61-90, >90 hari
- [ ] 15.8 Implementasi `getStockPositionReport()`: saldo stok per produk per gudang konsisten dengan ledger
- [ ] 15.9 Implementasi `getStockMovementReport()`: semua pergerakan stok dengan running balance
- [ ] 15.10 Implementasi `getSalesReport()`: per produk, customer, cabang, periode dengan nilai, HPP, margin
- [ ] 15.11 Implementasi `getShiftReport()`: total transaksi, per metode pembayaran, opening/closing balance, selisih kas
- [ ] 15.12 Implementasi export laporan ke Excel (xlsx) dan PDF dengan header perusahaan, tanggal cetak, nomor halaman
- [ ] 15.13 Implementasi filter branch_id dengan hierarki (cabang + sub-cabang)
- [ ] 15.14 REST API endpoints untuk semua laporan dengan RBAC guard (REPORT.FINANCIAL, REPORT.EXECUTIVE)
- [ ] 15.15 Unit test verifikasi semua laporan membaca dari read replica, bukan primary DB

## Task 16: Governance Module

- [ ] 16.1 Implementasi `RBACService`: CRUD role dan permission, assign role ke user, validasi nama role unik
- [ ] 16.2 Implementasi `ApprovalMatrixService`: submit dokumen untuk approval, proses approval/reject, escalation
- [ ] 16.3 REST API endpoints untuk RBAC dan approval management
- [ ] 16.4 Unit test semua SOD rules di service layer (bukan hanya UI)

## Task 17: Frontend — Foundation & Auth

- [ ] 17.1 Inisialisasi React 18 + TypeScript project dengan Zustand, Ant Design, Axios
- [ ] 17.2 Implementasi login page dengan JWT handling, token refresh otomatis, MFA flow untuk Owner/Finance_Manager/Auditor
- [ ] 17.3 Implementasi route guard berdasarkan RBAC permission
- [ ] 17.4 Buat shared Axios instance dengan interceptor untuk token refresh dan error handling

## Task 18: Frontend — Master Data Pages

- [ ] 18.1 Halaman manajemen produk: list, create, edit, soft delete, search/filter
- [ ] 18.2 Halaman manajemen customer dan supplier
- [ ] 18.3 Halaman manajemen gudang dan cabang dengan hierarki organisasi
- [ ] 18.4 Halaman COA management dengan tree view hierarki 5 level
- [ ] 18.5 Halaman price list management

## Task 19: Frontend — Purchase Module Pages

- [ ] 19.1 Halaman Purchase Request: list, create, edit
- [ ] 19.2 Halaman Purchase Order: list, create, submit, approval workflow, status tracking
- [ ] 19.3 Halaman Goods Receipt: create dari PO, konfirmasi penerimaan, 3-way matching view

## Task 20: Frontend — Inventory Module Pages

- [ ] 20.1 Halaman stock balance per produk per gudang
- [ ] 20.2 Halaman stock transfer antar gudang
- [ ] 20.3 Halaman stock adjustment dengan alasan wajib
- [ ] 20.4 Halaman stock opname: initiate, input count, recount, finalize

## Task 21: Frontend — POS Terminal

- [ ] 21.1 Implementasi POS terminal UI: open shift, scan barcode (BarcodeDetector API + @zxing/browser fallback), tambah item, hold/resume
- [ ] 21.2 Implementasi payment screen: multi-metode pembayaran, kalkulasi kembalian
- [ ] 21.3 Implementasi void transaksi dengan supervisor authorization
- [ ] 21.4 Implementasi close shift dengan shift report
- [ ] 21.5 Optimasi performa POS: target < 1 detik per transaksi

## Task 22: Frontend — Sales Order Pages

- [ ] 22.1 Halaman Sales Order: create, approve, fulfill, delivery order
- [ ] 22.2 Halaman Sales Return dengan referensi transaksi asal

## Task 23: Frontend — Invoicing & Payment Pages

- [ ] 23.1 Halaman invoice list dan detail (sales + purchase) dengan status tracking
- [ ] 23.2 Halaman payment: create, approval workflow, allocate ke invoice
- [ ] 23.3 Halaman bank reconciliation: import statement, auto-match, manual match, outstanding items

## Task 24: Frontend — Accounting Pages

- [ ] 24.1 Halaman journal entry: manual create, list, detail, reversal
- [ ] 24.2 Halaman trial balance per fiscal period
- [ ] 24.3 Halaman fiscal period management: open, close dengan checklist

## Task 25: Frontend — Reporting & Dashboard

- [ ] 25.1 Executive dashboard dengan Apache ECharts: total penjualan, kas, AR/AP, top produk
- [ ] 25.2 Halaman laporan keuangan: income statement, balance sheet, cash flow
- [ ] 25.3 Halaman AR/AP aging report dengan bucket umur
- [ ] 25.4 Halaman stock reports: position dan movement
- [ ] 25.5 Halaman sales report dengan filter multi-dimensi
- [ ] 25.6 Implementasi export Excel dan PDF dari semua halaman laporan

## Task 26: Frontend — Governance Pages

- [ ] 26.1 Halaman user management: create, assign role, reset password (ADMIN.USER)
- [ ] 26.2 Halaman role & permission management: create role, assign permissions granular
- [ ] 26.3 Halaman audit trail: query dengan filter user, action, entity, tanggal

## Task 27: Performance & Concurrency

- [ ] 27.1 Implementasi optimistic locking (version field) untuk POS transactions
- [ ] 27.2 Implementasi pessimistic locking (`SELECT FOR UPDATE NOWAIT`) untuk stock updates kritis
- [ ] 27.3 Implementasi exponential backoff retry (max 3x) untuk concurrent stock conflicts
- [ ] 27.4 Load test: verifikasi 200 concurrent users dan 100 concurrent POS transactions
- [ ] 27.5 Verifikasi semua SLA: API read < 500ms, list < 1 detik, write < 2 detik, POS < 1 detik, report < 10 detik

## Task 28: Integration Testing & Property-Based Tests

- [ ] 28.1 Integration test: full purchase cycle (PR → PO → GR → Invoice → Payment → Journal)
- [ ] 28.2 Integration test: full POS cycle (open shift → transaksi → payment → close shift → journal)
- [ ] 28.3 Integration test: inventory transfer dengan verifikasi total stok tidak berubah
- [ ] 28.4 Integration test: period closing dengan semua checklist
- [ ] 28.5 Property-based test (fast-check): WAC selalu >= 0 untuk semua kombinasi qty dan cost valid
- [ ] 28.6 Property-based test: journal balance invariant untuk semua 20 event types
- [ ] 28.7 Property-based test: stock balance tidak pernah negatif tanpa backorder
- [ ] 28.8 Property-based test: document numbering tidak pernah duplikat under concurrent load
