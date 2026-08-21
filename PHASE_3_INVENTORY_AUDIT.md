# PHASE 3: INVENTORY & COSTING AUDIT REPORT
## Enterprise Inventory + POS + Finance — Release Candidate v1.0.0

**Date:** 2026-08-18  
**Auditor:** Principal Software Architect & Adversarial Production Readiness Engineer  
**Phase Status:** ✅ COMPLETE  
**Phase Gate Result:** PASS WITH FINDINGS

---

## 1. EXECUTIVE SUMMARY

The Phase 3 Inventory & Costing Audit conducted a deep inspection of inventory ledger management, Weighted Average Cost (WAC) calculations, stock transfer conservation, negative stock controls, and inventory accounting triggers across `InventoryService`, `GoodsReceiptService`, `POSService`, and property-based test suites (`inventory-wac.pbt.spec.ts`, `inventory-negative-stock.pbt.spec.ts`).

---

## 2. FUNDAMENTAL STOCK INVARIANT VERIFICATION

The mandatory business invariant equation was evaluated across all stock-changing operations:

$$\text{Opening Stock} + \text{Receipts (GR)} + \text{Transfer In} + \text{Sales Return} + \text{Positive Adjustments} - \text{Sales} - \text{Purchase Return} - \text{Transfer Out} - \text{Negative Adjustments} = \text{Current Stock}$$

### Evaluation Results
- **Canonical Balance Formula**: `getStockBalance()` computes balance via `SUM(qty_in) - SUM(qty_out)` from `inventory_ledger`. This correctly satisfies the invariant equation.
- **Stock Transfer Conservation**: `StockTransfer` implementation in `InventoryService.transferStock()` explicitly checks `srcNewQty + destNewQty === srcQty + destQty` in an atomic transaction, guaranteeing zero stock creation or destruction during transfers.
- **Append-Only Integrity**: `inventory_ledger` has no `updated_at` or `deleted_at` fields, enforcing audit trail immutability (BR-INV-002).

---

## 3. COSTING & VALUATION AUDIT (WAC)

- **WAC Calculation Formula**:
$$\text{WAC}_{\text{new}} = \text{ROUND}\left(\frac{\text{Current Value} + \text{Incoming Cost}}{\text{Current Qty} + \text{Incoming Qty}}, 4\right)$$
- Property-based tests (`inventory-wac.pbt.spec.ts`, 200 runs) confirm the formula holds and `average_cost >= 0` for all non-negative quantity and cost combinations.
- **Goods Receipt Integration**: `GoodsReceiptService.confirm()` recalculates WAC atomically inside a Prisma transaction and posts the corresponding Auto-Journal entry for `GOODS_RECEIPT`.

---

## 4. FINDINGS CATALOGUE

### INV-001 (P1): Ledger Query Ordering Bug (`created_at` vs `movement_date`)
- **Location:** `inventory.service.ts:155`, `inventory.service.ts:586`, `goods-receipt.service.ts:581`
- **Code:** `orderBy: { created_at: 'desc' }`
- **Issue:** Latest running cost and running quantity are retrieved by sorting on `created_at` (insertion date) instead of `movement_date` (effective transaction date).
- **Impact:** Backdated transactions (e.g. effective date yesterday, entered today) will be retrieved as the "latest" state for subsequent movements, corrupting inventory balance and valuation computations.
- **Remediation:** Change ordering to `orderBy: [{ movement_date: 'desc' }, { created_at: 'desc' }]`.

### INV-002 (P1): Missing Row-Level Locks in Generic `recordMovement()`
- **Location:** `inventory.service.ts:37-107`
- **Issue:** `recordMovement()` reads prior running balances and inserts new ledger entries outside a pessimistic row lock (`SELECT FOR UPDATE NOWAIT`).
- **Impact:** Simultaneous inventory movements on the same product and warehouse (e.g. concurrent sale and goods receipt) read the same prior snapshot, causing lost updates and corrupted `running_qty` / `running_cost` ledger values.
- **Remediation:** Wrap `recordMovement()` in a transaction with `SELECT FOR UPDATE` on the target `Product` row.

### INV-003 (P1): Sales Return Cost Fallback Uses Retail Selling Price
- **Location:** `pos.service.ts:598`
- **Code:** `const unitCost = lastLedger && prevQty > 0 ? prevCost / prevQty : Number(line.unit_price);`
- **Issue:** When a sales return is processed for a product without prior ledger history in that warehouse, unit cost falls back to `line.unit_price` (the retail selling price).
- **Impact:** Returning items inflates `inventory_ledger` valuation (`running_cost`) by recording retail prices instead of actual inventory cost (`Product.standard_cost`).
- **Remediation:** Fallback to `product.standard_cost` instead of `line.unit_price`.

### INV-004 (P2): Batch and Serial Tracking Hardcoded to Null
- **Location:** `inventory.service.ts:95-96`
- **Code:** `batch_number: null`, `serial_number: null`
- **Issue:** Schema columns for batch and serial tracking are hardcoded to `null` with TODO markers.
- **Impact:** Batch and serial number tracking cannot be utilized despite flags on `Product` (`is_batch_tracked`, `is_serialized`).

### INV-005 (P2): Concurrent Negative Stock Bypass Risk
- **Location:** `inventory.service.ts:63`
- **Issue:** Negative stock check (`if (running_qty < 0)`) is evaluated in application memory.
- **Impact:** Under high concurrency without row locks in `recordMovement()`, two concurrent requests can both read `running_qty = 1`, pass validation, and drive stock to `-1`.

---

## 5. PHASE GATE EXIT ASSESSMENT

```
PHASE 3 STATUS: PASS WITH FINDINGS

Exit Criteria Checklist:
[x] Fundamental stock equation verified across all movement types
[x] WAC costing calculation audited & property-based tests reviewed
[x] Stock transfer conservation verified (srcQty + destQty constant)
[x] Multi-warehouse isolation verified
[x] Negative stock enforcement audited
[x] 5 Inventory & Costing findings documented (INV-001 through INV-005)

Next Step:
Proceed to Phase 4 — POS & Sales Audit
```
