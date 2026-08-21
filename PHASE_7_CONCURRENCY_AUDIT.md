# PHASE 7: API, BUSINESS LOGIC, CONCURRENCY & IDEMPOTENCY AUDIT REPORT
## Enterprise Inventory + POS + Finance — Release Candidate v1.0.0

**Date:** 2026-08-18  
**Auditor:** Principal Software Architect & Adversarial Production Readiness Engineer  
**Phase Status:** ✅ COMPLETE  
**Phase Gate Result:** PASS WITH FINDINGS

---

## 1. EXECUTIVE SUMMARY

The Phase 7 Concurrency & State Machine Audit evaluated all 13 core document lifecycles, state transition tables, transactional atomicity boundaries (`$transaction`), pessimistic row-locking strategies (`SELECT FOR UPDATE NOWAIT`), deadlock prevention mechanisms, and idempotency guarantees across all backend services.

---

## 2. DOCUMENT LIFECYCLE & ATOMICITY CLASSIFICATION

| Workflow / Document | State Machine Transitions | Atomicity Classification | Concurrency Protection Mechanism |
|---------------------|---------------------------|--------------------------|----------------------------------|
| **1. Purchase Request (PR)** | `DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `APPROVED`/`REJECTED` | **Atomic** | DB transaction, state validation. |
| **2. Purchase Order (PO)** | `DRAFT` $\rightarrow$ `PENDING_APPROVAL` $\rightarrow$ `APPROVED` $\rightarrow$ `PARTIALLY_RECEIVED` $\rightarrow$ `FULLY_RECEIVED`/`CANCELLED` | **Atomic** | Dynamic approval level threshold check, `VALID_TRANSITIONS` table. |
| **3. Goods Receipt (GR)** | `DRAFT` $\rightarrow$ `CONFIRMED` | **Atomic** | Updates PO lines, computes WAC, creates ledger entry, posts Auto-Journal in single `$transaction()`. |
| **4. Sales Order (SO)** | `DRAFT` $\rightarrow$ `APPROVED` $\rightarrow$ `FULFILLED`/`CANCELLED` | **Atomic** | `fulfillSalesOrder` creates Delivery Order + stock deduction in single transaction. |
| **5. Delivery Order (DO)** | Generated upon SO fulfillment | **Atomic** | Created synchronously with inventory ledger deduction. |
| **6. POS Transaction** | `OPEN` $\rightarrow$ `HELD` $\rightarrow$ `COMPLETED`/`VOIDED` | 🟡 **Potentially-Atomic (P1-CON-001)** | Optimistic `version` field + `applyPayment` transaction boundary. Stock deducted prematurely at `addItem`. |
| **7. Invoice (Sales / Purchase)** | `DRAFT` $\rightarrow$ `OPEN` (Posted) $\rightarrow$ `PARTIAL`/`PAID`/`DISPUTED`/`WRITTEN_OFF`/`CANCELLED` | **Atomic** | Posting updates status and triggers Auto-Journal inside single transaction. |
| **8. Payment (Receipt / Voucher)** | `DRAFT` $\rightarrow$ `PENDING_APPROVAL` $\rightarrow$ `APPROVED` $\rightarrow$ `POSTED`/`REVERSED` | **Atomic** | SOD-002 check; posted with Auto-Journal; allocation checks outstanding balance. |
| **9. Journal Entry** | `DRAFT` $\rightarrow$ `POSTED` $\rightarrow$ `REVERSED` | **Atomic** | Manual creation and reversal execute in `$transaction()` with balance validation. |
| **10. POS Shift** | `OPEN` $\rightarrow$ `CLOSED` | ❌ **Non-Atomic (P1-CON-002)** | `forceCloseShift` query bug (`status = 'PAID'` instead of `'COMPLETED'`) produces incomplete/corrupted shift reports. |
| **11. Stock Opname** | `INITIATED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COUNTED` $\rightarrow$ `FINALIZED`/`CANCELLED` | **Atomic** | Warehouse locking during opname; variance adjustment posted atomically upon finalization. |
| **12. Stock Transfer** | Executed immediately | **Atomic** | `SELECT FOR UPDATE NOWAIT` + sorted product IDs (deadlock prevention) + exponential retry. |
| **13. Stock Adjustment** | Executed immediately | **Atomic** | `SELECT FOR UPDATE NOWAIT` + sorted product IDs + exponential retry. |

---

## 3. FINDINGS CATALOGUE

### CON-001 (P1): Premature Inventory Deduction During POS Cart Building
- **Location:** `pos.service.ts:165-183`
- **Classification:** Potentially-Atomic
- **Issue:** Inventory ledger entries (`qty_out`) are created when `addItem()` is called during cart building, before the cashier collects or authorizes payment.
- **Impact:** Abandoned carts or payment failures leave stock depleted in `inventory_ledger` unless manually voided.
- **Remediation:** Move inventory ledger deduction inside `applyPayment()` transaction.

---

### CON-002 (P1): Non-Atomic / Corrupted Force-Close Shift Calculation
- **Location:** `pos.service.ts:432`
- **Classification:** Non-Atomic
- **Issue:** `forceCloseShift()` queries for `status: 'PAID'`, while completed POS sales use `status: 'COMPLETED'`.
- **Impact:** Force closing a shift computes zero sales, leaving cashier cash drawers out of balance.
- **Remediation:** Change status filter from `'PAID'` to `'COMPLETED'`.

---

### CON-003 (P1): Generic `recordMovement` Lacks Pessimistic Row Lock
- **Location:** `inventory.service.ts:37-107`
- **Classification:** Potentially-Atomic
- **Issue:** While `transferStock` and `adjustStock` use `SELECT FOR UPDATE NOWAIT` with sorted product IDs, generic `recordMovement` does not acquire row locks on `Product` or `Warehouse` rows.
- **Impact:** Parallel non-transfer movements (e.g. concurrent goods receipt and POS sale) on the same product can read stale running balances and overwrite `running_qty` / `running_cost`.
- **Remediation:** Acquire `SELECT FOR UPDATE` on `Product` inside `recordMovement()`.

---

### CON-004 (P2): Missing Explicit `Idempotency-Key` HTTP Headers on Financial POST Endpoints
- **Location:** `invoice.controller.ts`, `payment.controller.ts`, `pos.controller.ts`
- **Issue:** Endpoints like `POST /api/v1/invoices/sales` and `POST /api/v1/payments` rely on status checks rather than accepting an explicit `Idempotency-Key` HTTP header.
- **Impact:** Duplicate client HTTP POST requests (e.g. network timeout retry) create duplicate draft invoices or draft payments before posting.
- **Remediation:** Implement an `Idempotency-Key` header check or interceptor for financial creation endpoints.

---

## 4. PHASE GATE EXIT ASSESSMENT

```
PHASE 7 STATUS: PASS WITH FINDINGS

Exit Criteria Checklist:
[x] All 13 core document lifecycles audited and classified
[x] State transition tables (VALID_TRANSITIONS) verified
[x] Transaction boundaries ($transaction) evaluated
[x] Pessimistic locking (SELECT FOR UPDATE NOWAIT) & deadlock prevention reviewed
[x] Idempotency & double-submit protection evaluated
[x] 4 Concurrency & Logic findings documented (CON-001 through CON-004)

Next Step:
Proceed to Phase 8 — Frontend / UX Production Audit
```
