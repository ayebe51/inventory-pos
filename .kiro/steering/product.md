# Product Overview

Enterprise Inventory + POS + Finance adalah sistem informasi manajemen enterprise berbasis web untuk industri retail distribusi Indonesia.

## Core Modules

| Modul | Fungsi |
|-------|--------|
| Master Data | Produk, Customer, Supplier, COA, Gudang, Price List |
| Purchase/Procurement | PR → PO (approval matrix) → Goods Receipt → 3-way matching |
| Inventory | Multi-gudang, append-only ledger, WAC/FIFO, stock opname |
| POS / Sales | Transaksi ritel (shift kasir) + Sales Order B2B + retur |
| Invoicing & Payment | AR/AP, partial payment, multi-invoice allocation, bank reconciliation |
| Accounting & Finance | Double-entry GL, auto journal (20 event), fiscal period closing |
| Reporting & Analytics | Laporan keuangan PSAK, aging AR/AP, stock reports, executive dashboard |
| Governance | RBAC granular, audit trail immutable, approval matrix, SOD enforcement |

## Organizational Hierarchy

```
Head Office → Branch → Warehouse → Outlet/POS Counter
```

## Compliance Requirements

- Standar akuntansi Indonesia (PSAK)
- PPN 11%
- PPh
- UU Kearsipan (audit trail immutable)
- Separation of Duties (SOD-001, SOD-002, SOD-003)

## Scale Requirements

- 200 concurrent users
- 100 concurrent POS transactions

## User Personas

| Persona | Akses Utama |
|---------|-------------|
| Owner | Full access, approval tertinggi (PO > Rp 50jt), REPORT.EXECUTIVE |
| Sys_Admin | ADMIN.USER, ADMIN.SETTINGS |
| Finance_Manager | PURCHASE.APPROVE, PERIOD.CLOSE, JOURNAL.REVERSE, REPORT.FINANCIAL, REPORT.EXECUTIVE |
| Finance_Staff | Operasional keuangan, REPORT.FINANCIAL |
| Warehouse_Manager | INVENTORY.ADJUST, STOCK.OPNAME |
| Warehouse_Staff | Operasional gudang |
| Cashier | POS transactions (dalam shift) |
| Supervisor | POS.VOID, PRICE.OVERRIDE, approval PO Level 1 (< Rp 5jt) |
| Purchasing_Staff | PURCHASE.CREATE |
| Auditor | Read-only semua laporan keuangan (REPORT.FINANCIAL) |
