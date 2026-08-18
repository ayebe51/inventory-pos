# PHASE 2: DATABASE & DATA INTEGRITY AUDIT REPORT
## Enterprise Inventory + POS + Finance — Release Candidate v1.0.0

**Date:** 2026-08-18  
**Auditor:** Principal Software Architect & Adversarial Production Readiness Engineer  
**Phase Status:** ✅ COMPLETE  
**Phase Gate Result:** PASS WITH FINDINGS

---

## 1. EXECUTIVE SUMMARY

The Phase 2 Database & Data Integrity Audit conducted a complete, model-by-model review of the PostgreSQL database schema defined in `prisma/schema.prisma` (1,354 lines, 35+ models) and all 11 SQL migrations (`prisma/migrations/`).

The audit evaluated:
- Primary key and foreign key structures
- Unique constraint coverage and soft-delete interactions
- Data types, numeric precision (Decimal), and scale
- Cascade delete risks
- Append-only and immutability invariants
- Denormalization risks and race conditions under concurrent writes
- Index coverage on hot query paths

---

## 2. MODEL-BY-MODEL INTEGRITY EVALUATION

### 2.1 Core Domain Models

| Model | PK / Keys | Soft Delete | Integrity Rating | Key Findings |
|-------|-----------|-------------|------------------|--------------|
| `Branch` | `id` UUID, `code` UNIQUE | `deleted_at` | ✅ PASS | Hierarchical self-relation `parent_id` configured. Root scope entity. |
| `Warehouse` | `id` UUID, `@@unique([code, branch_id])` | `deleted_at` | ✅ PASS | Code is unique per branch. Lock fields (`is_locked`, `locked_at`, `locked_by`) present. |
| `User` | `id` UUID, `email` UNIQUE | `deleted_at` | ❌ **RISK (P1-DB-003)** | Standard `@unique` on `email` prevents soft-deleted user emails from being reused for new registrations. |
| `Role` | `id` UUID, `name` UNIQUE | None | ✅ PASS | Active status flag `is_active`. |
| `Permission` | `id` UUID, `@@unique([module, action])` | None | ✅ PASS | Module + action unique composite. |
| `RolePermission` | `id` UUID, `@@unique([role_id, permission_id])` | None | ✅ PASS | Composite unique prevents duplicate assignment. |
| `UserRole` | `id` UUID, `@@unique([user_id, role_id])` | None | 🟡 **AMBIGUITY (P2-DB-007)** | `branch_id` is nullable (`String?`). System lacks clear DB-level semantics for `null` branch_id (Global vs Unassigned). |

---

### 2.2 Master Data Models

| Model | PK / Keys | Precision / Constraints | Integrity Rating | Key Findings |
|-------|-----------|-------------------------|------------------|--------------|
| `Category` | `id` UUID, `code` UNIQUE | Hierarchy (`parent_id`) | ✅ PASS | Level indicator + soft delete. |
| `Brand` | `id` UUID, `code` UNIQUE | — | ✅ PASS | Soft delete. |
| `UnitOfMeasure` | `id` UUID, `code` UNIQUE | `symbol` VarChar(20) | ✅ PASS | Linked across PR, PO, GR, Transfer, POS, SO, SR. |
| `Product` | `id` UUID, `code` UNIQUE | `Decimal(18,4)` for prices/costs | ❌ **GAP (P1-DB-001)** | `barcode` String(100) is **NOT UNIQUE**. Multiple products can share the same barcode, causing non-deterministic POS barcode scanning. |
| `Customer` | `id` UUID, `code` UNIQUE | `Decimal(18,2)` balance | 🟡 **RISK (P2-DB-006)** | `outstanding_balance` is denormalized and updated in application code without atomic DB increments. |
| `Supplier` | `id` UUID, `code` UNIQUE | `payment_terms_days` Int | ✅ PASS | Soft delete present. |
| `PriceList` | `id` UUID, `code` UNIQUE | `valid_from`, `valid_to` | ✅ PASS | Customer-specific pricing option. |
| `PriceListItem` | `id` UUID, `@@unique([price_list_id, product_id])` | `Decimal(18,4)` | ✅ PASS | Prevents duplicate product entries per list. |

---

### 2.3 Financial & Accounting Models

| Model | PK / Keys | Precision / Constraints | Integrity Rating | Key Findings |
|-------|-----------|-------------------------|------------------|--------------|
| `ChartOfAccount` | `id` UUID, `account_code` UNIQUE | Hierarchy, `normal_balance` | ✅ PASS | `is_system` protects system accounts from deletion. |
| `FiscalPeriod` | `id` UUID, `@@unique([year, month])` | Dates, status | ✅ PASS | Prevents duplicate period definitions for same month. |
| `JournalEntry` | `id` UUID, `je_number` UNIQUE | `Decimal(18,2)` totals | ✅ PASS | Reversal self-relation `reversed_by` configured. |
| `JournalEntryLine` | `id` UUID | `Decimal(18,2)` debit/credit | ❌ **GAP (P1-DB-004)** | No DB CHECK constraint enforcing `debit >= 0`, `credit >= 0`, and `(debit = 0 OR credit = 0)`. |
| `AutoJournalTemplate` | `id` UUID, `event_type` UNIQUE | FKs to debit/credit CoA | ✅ PASS | Event-to-account mapping engine. |

---

### 2.4 Inventory & Stock Models

| Model | PK / Keys | Constraints / Indexes | Integrity Rating | Key Findings |
|-------|-----------|-----------------------|------------------|--------------|
| `InventoryLedger` | `id` UUID | Append-Only (No `updated_at`, no `deleted_at`) | 🟡 **RISK (P1-DB-005)** | Snapshot columns `running_qty` and `running_cost` can suffer race conditions if written concurrently without row locks. |
| `StockTransfer` | `id` UUID, `transfer_number` UNIQUE | `from_warehouse`, `to_warehouse` | ✅ PASS | Line items contain unit costs. |
| `StockAdjustment` | `id` UUID, `adjustment_number` UNIQUE | Status, reason | ✅ PASS | Lines compute `qty_difference`. |
| `StockOpname` | `id` UUID, `opname_number` UNIQUE | Initiated / Finalized users | ✅ PASS | Track variance per line. |

---

### 2.5 Invoicing & Payment Models

| Model | PK / Keys | Constraints / Indexes | Integrity Rating | Key Findings |
|-------|-----------|-----------------------|------------------|--------------|
| `Invoice` | `id` UUID, `invoice_number` UNIQUE | `Decimal(18,2)` totals | ✅ PASS | Types: `SALES`, `PURCHASE`. |
| `Payment` | `id` UUID, `payment_number` UNIQUE | Status, payment method | ✅ PASS | Reversal audit fields present. |
| `InvoiceAllocation` | `id` UUID, `@@unique([invoice_id, payment_id])` | Allocated amount | ❌ **REDUNDANCY (P1-DB-002)** | Schema has **DUPLICATE** allocation models: `InvoiceAllocation` and `PaymentAllocation` do the exact same thing. |
| `PaymentAllocation` | `id` UUID, `@@unique([payment_id, invoice_id])` | Allocated amount | ❌ **REDUNDANCY (P1-DB-002)** | Duplicate table causes write duplication and potential desynchronization. |

---

## 3. FINDINGS CATALOGUE

### DB-001 (P1): Missing Unique Constraint on `Product.barcode`
- **Schema Location:** `schema.prisma:253` (`barcode String? @db.VarChar(100)`)
- **Issue:** Product barcode is not marked `@unique`.
- **Impact:** Duplicate barcodes can be inserted into the database. In POS barcode scanning, multiple products matching the same barcode causes ambiguous product selection or runtime crashes.
- **Remediation:** Add `@unique` or composite `@@unique([barcode])` (filtered where `deleted_at IS NULL`).

### DB-002 (P1): Redundant Allocation Tables (`InvoiceAllocation` vs `PaymentAllocation`)
- **Schema Location:** `schema.prisma:1099-1131`
- **Issue:** The schema defines two distinct tables:
  1. `model InvoiceAllocation` with `@@unique([invoice_id, payment_id])`
  2. `model PaymentAllocation` with `@@unique([payment_id, invoice_id])`
- **Impact:** Both tables map the same M:N relationship between Invoices and Payments. Applications writing to one without writing to the other create split-state data corruption.
- **Remediation:** Deprecate `PaymentAllocation` and consolidate all allocations onto `InvoiceAllocation`.

### DB-003 (P1): Soft-Deleted User Email Unique Index Conflict
- **Schema Location:** `schema.prisma:80` (`email String @unique @db.VarChar(200)`)
- **Issue:** PostgreSQL unique constraint covers all rows regardless of `deleted_at`.
- **Impact:** Soft-deleting a user locks their email address permanently. Re-registering an account with that email fails with a unique constraint violation (`P2002`).
- **Remediation:** Use partial unique index `CREATE UNIQUE INDEX idx_users_email_active ON users(email) WHERE deleted_at IS NULL;` via raw SQL migration.

### DB-004 (P1): Missing DB Check Constraints on `JournalEntryLine`
- **Schema Location:** `schema.prisma:1208-1224`
- **Issue:** `debit` and `credit` columns have no PostgreSQL `CHECK` constraints.
- **Impact:** While `JournalEngineService` validates debit/credit balance programmatically in NestJS, raw database access, manual queries, or direct SQL scripts can insert negative numbers or lines with both `debit > 0` and `credit > 0`.
- **Remediation:** Add SQL CHECK constraint: `CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0))`.

### DB-005 (P1): Concurrency Race Risk on `InventoryLedger` Running Balance
- **Schema Location:** `schema.prisma:614-644`
- **Issue:** `running_qty` and `running_cost` are snapshot balances computed from the previous row.
- **Impact:** Concurrent movements (e.g. simultaneous Goods Receipt confirmation and Sales Return) without pessimistic table/row locks can calculate the same prior running balance, causing lost updates in inventory valuation.
- **Remediation:** Ensure all ledger append operations use strict `FOR UPDATE` pessimistic locks on the product row.

### DB-006 (P2): Denormalized `Customer.outstanding_balance` Race Risk
- **Schema Location:** `schema.prisma:312` (`outstanding_balance Decimal @default(0)`)
- **Issue:** `outstanding_balance` is updated via absolute assignment rather than atomic DB increment/decrement (`UPDATE customers SET outstanding_balance = outstanding_balance + delta`).
- **Impact:** Concurrent invoices or payments can overwrite `outstanding_balance` with stale values.
- **Remediation:** Use Prisma `{ increment: delta }` or derive outstanding balance dynamically from `Invoice` where status != 'PAID'.

### DB-007 (P2): `UserRole.branch_id` Scoping Ambiguity
- **Schema Location:** `schema.prisma:179` (`branch_id String? @db.Uuid`)
- **Issue:** `branch_id` is optional on `UserRole`.
- **Impact:** Scoping logic in `RbacGuard` does not explicitly define whether `null` means "Global Access to all branches" or "Unassigned branch".
- **Remediation:** Clarify RBAC policy and document `null` branch_id as Global Scope.

### DB-008 (P2): Lack of Organization-Level Multi-Tenant Model
- **Schema Location:** `schema.prisma`
- **Issue:** Schema relies solely on `Branch` as the root organizational unit.
- **Impact:** Multi-organization isolation cannot be enforced at the schema level.

---

## 4. PHASE GATE EXIT ASSESSMENT

```
PHASE 2 STATUS: PASS WITH FINDINGS

Exit Criteria Checklist:
[x] Complete Prisma schema audited (35+ models, 1354 lines)
[x] All 11 SQL migrations reviewed
[x] Foreign key, unique key, and index coverage evaluated
[x] Decimal precision and scale verified across money and quantity fields
[x] Soft delete and immutable append-only patterns verified
[x] 8 Database & Data Integrity findings documented (DB-001 through DB-008)

Next Step:
Proceed to Phase 3 — Inventory & Costing Audit
```
