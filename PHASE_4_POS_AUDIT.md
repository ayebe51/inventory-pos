# PHASE 4: POS & SALES AUDIT REPORT
## Enterprise Inventory + POS + Finance — Release Candidate v1.0.0

**Date:** 2026-08-18  
**Auditor:** Principal Software Architect & Adversarial Production Readiness Engineer  
**Phase Status:** ❌ FAILED — P0 RELEASE BLOCKER DISCOVERED  
**Phase Gate Result:** BLOCKED (P0 Issue POS-001 Must Be Remediated Before Go-Live)

---

## 1. EXECUTIVE SUMMARY

The Phase 4 POS & Sales Audit inspected the end-to-end retail order lifecycle: Cart → Item Addition → Concurrency Locking → Payment Authorization → Receipt Generation → Inventory Deduction → Shift Reconciliation → Journal Engine Integration.

### Audit Findings Overview
- **P0 Release Blockers:** 1 (POS-001: POS Service completely lacks Auto-Journal integration for POS sales and COGS)
- **P1 High Severity:** 4 (Shift force close status bug, Express POS zero-UUID UOM, Pre-payment inventory deduction risk, Sales return cost valuation fallback)
- **P2 Medium Severity:** 1 (Lack of offline transaction queuing)

---

## 2. END-TO-END WORKFLOW TRACE & INVARIANT AUDIT

| Workflow Stage | Implementation File | Invariant / Validation Rule | Audit Verdict | Findings / Evidence |
|----------------|---------------------|-----------------------------|---------------|---------------------|
| **Shift Management** | `pos.service.ts:30-57` | One open shift per cashier | ✅ PASS | Validates `status: 'OPEN'` before creating shift. |
| **Shift Closing** | `pos.service.ts:360-414` | Expected balance = Opening + Cash Sales | ✅ PASS | Calculates cash, card, and transfer sales accurately for standard closure. |
| **Force Close Shift** | `pos.service.ts:416-482` | Shift force close with reason | ❌ **BROKEN (P1-POS-002)** | Queries `status: 'PAID'` instead of `'COMPLETED'`, reporting zero sales. |
| **Cart & Optimistic Concurrency** | `pos.service.ts:98-197` | Version check & `FOR UPDATE NOWAIT` | ✅ PASS | Version field incremented on each mutation; pessimistic lock on product. |
| **Payment Application** | `pos.service.ts:226-282` | Total Paid $\ge$ Total Amount; Idempotency | ✅ PASS | Transaction status transitions `OPEN` $\rightarrow$ `COMPLETED`; retry rejected by version/status check. |
| **Inventory Deduction** | `pos.service.ts:165-183` | Append-only ledger movement | 🟡 **RISK (P1-POS-004)** | Deducted at `addItem` stage before payment confirmation. |
| **Accounting Journal (POS Sales & COGS)** | `pos.service.ts` | Debit Cash/AR, Credit Sales; Debit COGS, Credit Inventory | ❌ **CRITICAL P0 BLOCKER (P0-POS-001)** | **ZERO Journal Entries Created**. `POSService` does not import `JournalEngineService` and never fires `POS_SALE` or `POS_SALE_COGS` journal events! |
| **Void Transaction** | `pos.service.ts:284-358` | Inventory restoration | ✅ PASS | Reverses inventory movement with `qty_in = line.qty`. |
| **Sales Return** | `pos.service.ts:552-626` | Inventory restoration & valuation | 🟡 **PARTIAL (P1-POS-005)** | Functional, but falls back to retail selling price when no ledger cost exists. |

---

## 3. DETAILED FINDINGS CATALOGUE

### P0-POS-001 (CRITICAL RELEASE BLOCKER): Missing Accounting Journal Integration for POS Sales & COGS
- **Location:** `src/modules/pos/services/pos.service.ts`, `src/modules/pos/pos.module.ts`
- **Issue:** `POSService` and `PosModule` do not import or inject `JournalEngineService`. `applyPayment()`, `processFullTransaction()`, `voidTransaction()`, and `createSalesReturn()` process payments and inventory movements, but **NEVER invoke `JournalEngineService.processEvent()`**.
- **Impact:** While `JournalEngineService` contains event builders and property-based test specs for `POS_SALE` and `POS_SALE_COGS`, **NO journal entries are posted to the General Ledger during real POS transactions**.
- **Result:** P&L reports, Balance Sheet, and Trial Balance reflect **ZERO POS revenue** and **ZERO POS COGS**, creating a complete financial accounting imbalance between POS operations and the General Ledger.
- **Remediation:**
  1. Import `JournalEngineModule` into `PosModule`.
  2. Inject `JournalEngineService` into `POSService`.
  3. Call `journalEngine.processEvent()` inside `applyPayment()` transaction for `POS_SALE` and `POS_SALE_COGS`.
  4. Call `journalEngine.processEvent()` inside `voidTransaction()` and `createSalesReturn()` for reversal entries.

---

### P1-POS-002: Shift Force Close Status Query Mismatch Bug
- **Location:** `pos.service.ts:432`
- **Code:** `const txs = await tx.posTransaction.findMany({ where: { shift_id: shiftId, status: 'PAID' }, include: ... });`
- **Issue:** `forceCloseShift()` filters transactions where `status: 'PAID'`. However, `applyPayment()` sets `status: 'COMPLETED'` upon successful payment.
- **Impact:** Force closing a shift returns `cashSales = 0`, `cardSales = 0`, `transferSales = 0`, and `totalSales = 0`, corrupting cashier shift closing reports and cash drawer reconciliation.
- **Remediation:** Change status filter from `'PAID'` to `'COMPLETED'`.

---

### P1-POS-003: Express POS Transaction Zero-UUID UOM Hardcode
- **Location:** `pos.service.ts:531`
- **Code:** `uom_id: item.uom_id || '00000000-0000-0000-0000-000000000000'`
- **Issue:** `processFullTransaction()` passes a hardcoded dummy zero-UUID when `uom_id` is missing.
- **Impact:** Line items in `pos_transaction_lines` are created with an invalid UOM foreign key value.
- **Remediation:** Fetch product's base `uom_id` from database when `item.uom_id` is not provided.

---

### P1-POS-004: Inventory Deduction Timing Risk (Cart Building vs Payment Confirmation)
- **Location:** `pos.service.ts:165-183`
- **Issue:** Inventory ledger entries (`qty_out`) are created when `addItem()` is called (cart building stage), before payment is processed.
- **Impact:** If a customer abandons their cart or payment fails and the cashier closes the browser without calling `voidTransaction()`, inventory remains deducted in `inventory_ledger` for an uncompleted transaction.
- **Remediation:** Deduct inventory inside `applyPayment()` during checkout, or implement an automated cart expiration/cleanup job for stale `OPEN` transactions.

---

### P1-POS-005: Sales Return Cost Valuation Fallback to Retail Selling Price
- **Location:** `pos.service.ts:598`
- **Code:** `const unitCost = lastLedger && prevQty > 0 ? prevCost / prevQty : Number(line.unit_price);`
- **Issue:** When returning a product without prior ledger history in that warehouse, `unitCost` falls back to `line.unit_price` (the retail selling price).
- **Impact:** Retained stock inventory value (`running_cost`) is inflated by retail selling price rather than product standard cost.
- **Remediation:** Fallback to `product.standard_cost` instead of `line.unit_price`.

---

## 4. IDEMPOTENCY & CONCURRENCY EVALUATION

- **Duplicate Payment Submission Prevention:**
  - `applyPayment()` validates `transaction.status === 'OPEN'` and `transaction.version === expectedVersion`.
  - Upon successful payment, `status` is updated to `'COMPLETED'` and `version` is incremented.
  - A duplicate HTTP submission (retry or double click) fails with `BUSINESS_RULE_VIOLATION` ("Transaction is not OPEN") or `CONCURRENCY_ERROR` ("Version mismatch").
  - **Payment Idempotency Verdict:** ✅ VERIFIED SAFE against duplicate payment submission.

---

## 5. PHASE GATE EXIT ASSESSMENT

```
PHASE 4 STATUS: BLOCKED / FAILED

Exit Criteria Checklist:
[x] Cart, pricing, tax, discount, total, payment, and receipt audited
[x] Payment idempotency & duplicate submission safety verified
[x] Shift opening, closing, and force-closing audited
[x] Void and sales return flows audited
[x] Accounting journal integration inspected
[!] P0 Release Blocker Discovered: POS-001 (Zero Journal Entries for POS Sales/COGS)

Next Step:
Proceed to Phase 5 — Finance & Accounting Audit
(P0-POS-001 logged in Release Blocker Register for Phase 13 Remediation)
```
