# PHASE 5: FINANCE & ACCOUNTING AUDIT REPORT
## Enterprise Inventory + POS + Finance — Release Candidate v1.0.0

**Date:** 2026-08-18  
**Auditor:** Principal Software Architect & Adversarial Production Readiness Engineer  
**Phase Status:** ❌ FAILED — P0 & P1 ACCOUNTING ISSUES DISCOVERED  
**Phase Gate Result:** BLOCKED (P0 POS GL Disconnect & P1 Invoice Tax Calculation Must Be Remediated)

---

## 1. EXECUTIVE SUMMARY

The Phase 5 Finance & Accounting Audit traced the complete financial accounting lifecycle: Business Events $\rightarrow$ Auto-Journal Event Builder $\rightarrow$ Journal Balance Validation $\rightarrow$ General Ledger $\rightarrow$ Subledgers (AR/AP/Cash/Bank/Inventory) $\rightarrow$ Trial Balance $\rightarrow$ P&L $\rightarrow$ Balance Sheet.

### Accounting Invariant Compliance
- **Journal Balance Invariant ($\text{Total Debit} = \text{Total Credit}$)**: Enforced programmatically in `JournalEngineService.validateJournalBalance()` within a $\pm 0.01$ tolerance.
- **Segregation of Duties (SOD-002)**: Enforced in `PaymentService.approve()` — payment creator cannot approve their own payment voucher or receipt.
- **Period Close Protection (BR-ACC-002)**: Enforced in `PeriodManagerService.validatePeriodOpen()` — posting into closed fiscal periods is rejected.

---

## 2. SUBLEDGER TO GENERAL LEDGER RECONCILIATION

| Domain / Subledger | Subledger Source Table | GL Account Type | Reconciliation Status | Finding / Evidence |
|--------------------|------------------------|-----------------|-----------------------|--------------------|
| **Accounts Receivable (AR)** | `invoices` (`invoice_type = 'SALES'`) | `ASSET` (AR Account) | 🟡 **PARTIAL** | Invoice posting creates GL entries, but invoice `subtotal` calculation bug distorts gross/net figures. |
| **Accounts Payable (AP)** | `invoices` (`invoice_type = 'PURCHASE'`) | `LIABILITY` (AP Account) | 🟡 **PARTIAL** | Supplier invoice posting creates GL entries; 5% PO over-billing policy enforced. |
| **Cash & Bank** | `payments`, `bank_statements` | `CASH_AND_BANK` | ✅ **PASS** | Payment posting generates `PAYMENT_RECEIPT` or `PURCHASE_PAYMENT` GL entries. |
| **POS Sales & COGS** | `pos_transactions` | `REVENUE`, `COGS` | ❌ **FAILED (P0-ACC-001)** | **ZERO GL ENTRIES CREATED**. `POSService` does not trigger `JournalEngineService`. POS GL is 100% unrecorded. |
| **Goods Receipt (Inventory)** | `goods_receipts` | `INVENTORY` | ✅ **PASS** | GR confirmation triggers `GOODS_RECEIPT` auto-journal entry in same transaction. |

---

## 3. DETAILED FINDINGS CATALOGUE

### P0-ACC-001: General Ledger Disconnect for POS Transactions
- **Location:** `src/modules/pos/services/pos.service.ts`
- **Issue:** POS transactions update `pos_transactions` and `inventory_ledger`, but **NEVER invoke `JournalEngineService.processEvent()`**.
- **GL Impact:** GL Accounts for `POS Sales Revenue`, `COGS`, `Cash/Bank`, and `Inventory` receive zero postings from retail operations.
- **Result:** Financial statements (Trial Balance, P&L, Balance Sheet) exclude 100% of POS revenue and cost of goods sold.

---

### P1-ACC-002: Invoice Subtotal Tax Double-Count Calculation Bug
- **Location:** `invoice.service.ts:117-122`
- **Code:**
```typescript
const subtotal = linesWithTotals.reduce((sum, line) => sum + line.line_total, 0);
const taxAmount = linesWithTotals.reduce((sum, line) => sum + (line.qty * line.unit_price * line.tax_pct) / 100, 0);
const totalAmount = subtotal;
```
- **Issue:** `line_total` already equals `(qty * unit_price) + taxAmount`. Header `subtotal` is calculated by summing `line_total` (gross including tax), and then `taxAmount` is calculated separately.
- **Impact:** Header `subtotal` in DB stores Gross Total instead of Net Subtotal (DPP). Financial reports displaying `Subtotal + Tax = Total` produce wrong sums ($\text{Gross} + \text{Tax} \neq \text{Total}$).
- **Remediation:** Calculate `subtotal` as `SUM(qty * unit_price)` (net), `tax_amount` as `SUM(net * tax_pct / 100)`, and `total_amount` as `subtotal + tax_amount`.

---

### P1-ACC-003: Unbalanced Balance Sheet YTD Net Income Gap
- **Location:** `reporting.service.ts:205-235`
- **Issue:** `getBalanceSheet()` sums POSTED journal lines for `ASSET`, `LIABILITY`, and `EQUITY` account types, but does not include unclosed Net Income ($\text{Revenue} - \text{COGS} - \text{Expenses}$) for the active period.
- **Impact:** For any unclosed fiscal period, $\text{Total Assets} \neq \text{Total Liabilities} + \text{Total Equity}$.
- **Remediation:** Dynamically calculate Year-to-Date Net Income and add it to Equity in `getBalanceSheet()`.

---

### P1-ACC-004: Floating-Point Precision Accumulation in Journal Balance Validation
- **Location:** `journal-engine.service.ts:282`
- **Issue:** `validateJournalBalance()` sums debits and credits using standard JavaScript floating-point addition (`+`).
- **Impact:** Multi-line journals with float fractions (e.g. `0.1 + 0.2 = 0.30000000000000004`) introduce precision drift. Valid balanced entries may be rejected or slightly unbalanced entries approved.
- **Remediation:** Use `Decimal` arithmetic or round debit/credit sums to 2 decimal places (`Math.round(val * 100) / 100`) before comparing.

---

### P2-ACC-005: Subledger vs GL Reconciliation Query Divergence
- **Location:** `reporting.service.ts:61-73`
- **Issue:** Executive Dashboard queries AR/AP outstanding directly from `invoices.outstanding_amount`, whereas GL reports query `journal_entry_lines`.
- **Impact:** If an invoice is in DRAFT or unposted, subledger figures diverge from General Ledger without a dedicated reconciliation report.

---

## 4. PHASE GATE EXIT ASSESSMENT

```
PHASE 5 STATUS: BLOCKED / FAILED

Exit Criteria Checklist:
[x] Full accounting lifecycle audited (Transaction -> Subledger -> Journal -> GL -> Reports)
[x] Debit = Credit invariant evaluated
[x] Segregation of Duties (SOD-002) verified in PaymentService
[x] Period close protection (BR-ACC-002) verified
[!] P0 Issue Discovered: POS GL Disconnect (ACC-001)
[!] P1 Issue Discovered: Invoice Subtotal Tax Double-Count Bug (ACC-002)
[!] P1 Issue Discovered: Balance Sheet YTD Net Income Gap (ACC-003)

Next Step:
Proceed to Phase 6 — Security, Auth, RBAC & Multi-Tenant Audit
```
