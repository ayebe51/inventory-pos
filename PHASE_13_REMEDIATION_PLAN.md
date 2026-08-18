# PHASE 13: TECHNICAL REMEDIATION & CODE HARDENING PLAN
## Enterprise Inventory + POS + Finance — Release Candidate v1.0.0

**Date:** 2026-08-18  
**Author:** Principal Software Architect & Adversarial Production Readiness Engineer  
**Phase Status:** 🟡 IN PROGRESS  
**Objective:** Remediate 5 P0 Critical Release Blockers and 20 P1 High-Severity issues without introducing regressions or changing correct business behavior.

---

## 1. REMEDIATION GOVERNANCE & PRINCIPLES

### Core Principles
1. **Root Cause Resolution**: Never mask symptoms, swallow exceptions, or apply superficial patches. Fix the underlying architectural contract.
2. **Verification Requirement**: No finding is marked `VERIFIED` without empirical test evidence demonstrating clean execution and zero regressions.
3. **No Unvalidated Fixes**: Every code change must be backed by targeted unit/integration tests.
4. **Strict Priority Order**:
```
P0 Security
  ↓
P0 Data / Accounting Integrity
  ↓
P0 Infrastructure / Data Protection
  ↓
P1 Security
  ↓
P1 Accounting
  ↓
P1 Inventory
  ↓
P1 POS
  ↓
P1 Reliability
  ↓
P1 Testing
  ↓
P1 Frontend
  ↓
P2 / P3
```

---

## 2. P0 RELEASE BLOCKERS REMEDIATION PLAN

---

### P0-001: JWT Security & Secret Validation Hardening
- **Severity:** P0 (Critical Security)
- **Domain:** Security / Auth
- **Current Behavior:** `app.config.ts` uses `z.string().min(1)` for JWT secrets. `docker-compose.yml` provides fallback defaults (`super_secret_access_token`). `.env` contains `your-access-secret`. `jwt.strategy.ts` falls back to `''`.
- **Expected Behavior:** Application startup MUST FAIL safely in production if JWT secrets are missing, hardcoded defaults (`your-access-secret`, `super_secret_access_token`, `secret`, `change_me`), or weaker than 32 bytes (256-bit entropy). `jwt.strategy.ts` must never fall back to empty string.
- **Root Cause:** Weak validation schema in `app.config.ts`, fallback defaults in `docker-compose.yml`, and missing production secret enforcement.
- **Affected Files:**
  - [`src/config/app.config.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/config/app.config.ts)
  - [`src/services/auth/strategies/jwt.strategy.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/services/auth/strategies/jwt.strategy.ts)
  - [`src/services/auth/auth.service.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/services/auth/auth.service.ts)
  - [`.env`](file:///d:/apss-source/Inventory%20+%20POS/.env)
  - [`.env.example`](file:///d:/apss-source/Inventory%20+%20POS/.env.example)
  - [`docker-compose.yml`](file:///d:/apss-source/Inventory%20+%20POS/docker-compose.yml)
- **Dependencies:** None (P0 Priority 1).
- **Proposed Solution:**
  1. Update `app.config.ts` Zod schema to reject known default strings (`your-access-secret`, `super_secret_access_token`, etc.) and require `min(32)` secret length in `production`.
  2. Throw an explicit error during `validateAppConfig()` if secrets are insecure or missing in production.
  3. Remove default fallbacks from `docker-compose.yml`.
  4. Update `jwt.strategy.ts` to throw `UnauthorizedException` if secret is missing instead of defaulting to `''`.
  5. Generate strong 256-bit random secrets for development `.env`.
- **Acceptance Criteria:**
  - Production startup with missing JWT secret $\rightarrow$ FAIL.
  - Production startup with default secret (`your-access-secret`) $\rightarrow$ FAIL.
  - Production startup with short secret (< 32 chars) $\rightarrow$ FAIL.
  - Valid secret ($\ge 32$ chars, non-default) $\rightarrow$ START.
  - Automated unit test verifying config rejection.

---

### P0-002: Cross-Branch Data Leakage & IDOR Prevention
- **Severity:** P0 (Critical Security)
- **Domain:** Security / Multi-Tenant Authorization
- **Current Behavior:** Controllers (`InvoiceController`, `POSController`, `PurchaseOrderController`, `GoodsReceiptController`, `SalesOrderController`) accept query parameters and ID params without verifying that `req.user.branch_id` matches the entity's `branch_id`.
- **Expected Behavior:** Users assigned to `Branch A` MUST ONLY be able to search, view, create, update, or delete records belonging to `Branch A`. Cross-branch access attempts MUST return `403 Forbidden` unless the user holds a Global Admin role (`branch_id === null` or `@RequirePermissions('ADMIN.SETTINGS')`).
- **Root Cause:** Search and detail service methods do not inject `req.user.branch_id` into database query `where` clauses, relying solely on permission check decorators (`@RequirePermissions`).
- **Affected Files:**
  - [`src/modules/invoicing/controllers/invoice.controller.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/invoicing/controllers/invoice.controller.ts)
  - [`src/modules/invoicing/services/invoice.service.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/invoicing/services/invoice.service.ts)
  - [`src/modules/pos/controllers/pos.controller.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/pos/controllers/pos.controller.ts)
  - [`src/modules/pos/services/pos.service.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/pos/services/pos.service.ts)
  - [`src/modules/purchase/controllers/purchase-order.controller.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/purchase/controllers/purchase-order.controller.ts)
  - [`src/modules/purchase/controllers/goods-receipt.controller.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/purchase/controllers/goods-receipt.controller.ts)
  - [`src/modules/pos/controllers/sales-order.controller.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/pos/controllers/sales-order.controller.ts)
- **Dependencies:** P0-001.
- **Proposed Solution:**
  1. Pass `req.user` (containing `branch_id` and `roles`) into service search, findById, create, update, and delete methods.
  2. In service methods, append `where.branch_id = user.branch_id` if `user.branch_id` is present (non-global user).
  3. Validate that target entity `branch_id === user.branch_id` in single-item lookups (`findById`), throwing `ForbiddenException` on mismatch.
- **Acceptance Criteria:**
  - User with Branch A access calls `GET /api/v1/invoices` $\rightarrow$ returns ONLY Branch A invoices.
  - User with Branch A access calls `GET /api/v1/invoices/:branchBInvoiceId` $\rightarrow$ returns `403 Forbidden`.
  - Global user (`branch_id = null`) calls search $\rightarrow$ returns all branch records.
  - Integration tests verifying cross-branch rejection.

---

### P0-003: POS Sales & COGS Auto-Journal Engine Integration
- **Severity:** P0 (Critical Financial Integrity)
- **Domain:** POS / Accounting
- **Current Behavior:** `POSService.applyPayment()`, `processFullTransaction()`, `voidTransaction()`, and `createSalesReturn()` process payments and inventory ledger movements, but **NEVER call `JournalEngineService.processEvent()`**. Zero general ledger entries are created for POS operations.
- **Expected Behavior:** Every completed POS sale MUST post auto-journal entries for `POS_SALE` (Debit Cash/AR/Bank, Credit Revenue & Tax) and `POS_SALE_COGS` (Debit COGS Expense, Credit Inventory Asset) atomically within the same database transaction. Voiding a transaction or processing a sales return MUST post reversal journal entries.
- **Root Cause:** `PosModule` did not import `JournalEngineModule`, and `POSService` did not inject `JournalEngineService`.
- **Affected Files:**
  - [`src/modules/pos/pos.module.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/pos/pos.module.ts)
  - [`src/modules/pos/services/pos.service.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/pos/services/pos.service.ts)
  - [`src/services/journal-engine/journal-engine.service.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/services/journal-engine/journal-engine.service.ts)
- **Dependencies:** P0-001, P0-002.
- **Proposed Solution:**
  1. Import `JournalEngineModule` and `PeriodManagerModule` into `PosModule`.
  2. Inject `JournalEngineService` and `PeriodManagerService` into `POSService`.
  3. In `applyPayment()` transaction, construct and execute `journalEngine.processEvent()` for `POS_SALE` and `POS_SALE_COGS`.
  4. In `voidTransaction()` and `createSalesReturn()`, trigger reversal journal events.
- **Acceptance Criteria:**
  - Completed POS cash sale $\rightarrow$ `pos_transactions.status = 'COMPLETED'`, `inventory_ledger` entry created, `journal_entries` created for `POS_SALE` and `POS_SALE_COGS`, Debit = Credit verified.
  - Void transaction $\rightarrow$ `pos_transactions.status = 'VOIDED'`, `inventory_ledger` VOID entry created, reversal journal posted.
  - Integration test verifying GL balances after POS checkout.

---

### P0-004: Automated Database Backup & Disaster Recovery Implementation
- **Severity:** P0 (Critical Infrastructure & Data Protection)
- **Domain:** DevOps / Infrastructure
- **Current Behavior:** No database backup script, cron configuration, or recovery validation script exists.
- **Expected Behavior:** Automated database backup script (`scripts/backup-db.sh`) that executes `pg_dump` with gzip compression, timestamping, local 7-day retention cleanup, and optional S3/cloud storage upload. Verified non-destructive restore script (`scripts/restore-db.sh`).
- **Root Cause:** Missing operational infrastructure scripts.
- **Affected Files:**
  - `scripts/backup-db.sh` [NEW]
  - `scripts/restore-db.sh` [NEW]
  - `d:\apss-source\Inventory + POS\README.md`
- **Dependencies:** None.
- **Proposed Solution:**
  1. Create `scripts/backup-db.sh` to perform atomic PostgreSQL dump, compress, log results, and maintain 7-day rolling backups.
  2. Create `scripts/restore-db.sh` to validate backup file integrity and perform test restores into isolated test databases.
  3. Document RPO (1 hour) and RTO (15 minutes) SLAs and backup execution steps.
- **Acceptance Criteria:**
  - Executing `./scripts/backup-db.sh` generates a valid `.sql.gz` backup file.
  - Executing `./scripts/restore-db.sh <backup_file> <test_db>` restores schema and data cleanly into test database.

---

### P0-005: HTTPS / TLS Enforcement & Nginx Security Hardening
- **Severity:** P0 (Critical Infrastructure / Security)
- **Domain:** Infrastructure / DevOps
- **Current Behavior:** `nginx.conf` listens on Port 80 HTTP only. `docker-compose.yml` exposes Port 80.
- **Expected Behavior:** Nginx configuration supporting Port 443 SSL/TLS termination, HTTP-to-HTTPS 301 redirect on Port 80, HSTS headers, secure proxy headers (`X-Forwarded-Proto: https`), and secure cookie options.
- **Root Cause:** Incomplete production web server configuration.
- **Affected Files:**
  - [`frontend/nginx.conf`](file:///d:/apss-source/Inventory%20+%20POS/frontend/nginx.conf)
  - [`docker-compose.yml`](file:///d:/apss-source/Inventory%20+%20POS/docker-compose.yml)
- **Dependencies:** None.
- **Proposed Solution:**
  1. Update `frontend/nginx.conf` to include HTTPS listener block (Port 443) with SSL certificate directives, HSTS headers, and HTTP (Port 80) $\rightarrow$ HTTPS 301 redirect block.
  2. Provide a development/staging compose profile for local testing without self-signed cert errors.
- **Acceptance Criteria:**
  - Port 80 request $\rightarrow$ 301 redirect to HTTPS (Port 443).
  - Security headers present: `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`.

---

## 3. P1 HIGH-SEVERITY REMEDIATION PLAN

---

### P1-001: Express POS Transaction Zero-UUID UOM Resolution
- **Domain:** POS / Master Data
- **File:** [`src/modules/pos/services/pos.service.ts:531`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/pos/services/pos.service.ts#L531)
- **Fix:** Remove hardcoded `'00000000-0000-0000-0000-000000000000'`. Fetch `product.uom_id` from database when `item.uom_id` is missing in `processFullTransaction()`.

### P1-002: Shift Force-Close Status Query Mismatch
- **Domain:** POS / Shift Management
- **File:** [`src/modules/pos/services/pos.service.ts:432`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/pos/services/pos.service.ts#L432)
- **Fix:** Update `forceCloseShift()` query filter from `status: 'PAID'` to `status: 'COMPLETED'`.

### P1-003: Redis Password & Authentication Hardening
- **Domain:** Security / Infrastructure
- **Files:** [`.env`](file:///d:/apss-source/Inventory%20+%20POS/.env), [`docker-compose.yml`](file:///d:/apss-source/Inventory%20+%20POS/docker-compose.yml), [`src/config/redis.config.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/config/redis.config.ts)
- **Fix:** Require non-empty `REDIS_PASSWORD` in production config and update `docker-compose.yml` to pass `--requirepass`.

### P1-004: Invoice Subtotal Tax Double-Count Calculation Fix
- **Domain:** Invoicing / Finance
- **File:** [`src/modules/invoicing/services/invoice.service.ts:117-122`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/invoicing/services/invoice.service.ts#L117-L122)
- **Fix:** Calculate `subtotal` as `SUM(qty * unit_price)` (net of tax), `tax_amount` as `SUM(net * tax_pct / 100)`, and `total_amount` as `subtotal + tax_amount`.

### P1-005: Balance Sheet YTD Net Income Calculation Fix
- **Domain:** Accounting / Reporting
- **File:** [`src/modules/reporting/services/reporting.service.ts:205-235`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/reporting/services/reporting.service.ts#L205-L235)
- **Fix:** Dynamically compute current Year-to-Date Net Income ($\text{Revenue} - \text{COGS} - \text{Expenses}$) and include it in Equity in `getBalanceSheet()`.

### P1-006: Inventory WAC Movement Order Fix (`movement_date` vs `created_at`)
- **Domain:** Inventory / Costing
- **Files:** [`src/modules/inventory/services/inventory.service.ts:155`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/inventory/services/inventory.service.ts#L155), [`src/modules/purchase/services/goods-receipt.service.ts:581`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/purchase/services/goods-receipt.service.ts#L581)
- **Fix:** Update ledger ordering queries to `orderBy: [{ movement_date: 'desc' }, { created_at: 'desc' }]`.

### P1-007: Pessimistic Row Lock in Generic `recordMovement()`
- **Domain:** Inventory / Concurrency
- **File:** [`src/modules/inventory/services/inventory.service.ts:37-107`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/inventory/services/inventory.service.ts#L37-L107)
- **Fix:** Wrap `recordMovement()` inside a Prisma transaction with `SELECT FOR UPDATE` on the target product row.

### P1-008: Sales Return Cost Valuation Fallback Fix
- **Domain:** POS / Inventory Costing
- **File:** [`src/modules/pos/services/pos.service.ts:598`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/pos/services/pos.service.ts#L598)
- **Fix:** Fallback to `product.standard_cost` instead of `line.unit_price` when no prior ledger history exists.

### P1-009: Permission-Aware UI Element Hiding & Disabling
- **Domain:** Frontend / UX / Security
- **Files:** [`frontend/src/components/layout/Layout.tsx`](file:///d:/apss-source/Inventory%20+%20POS/frontend/src/components/layout/Layout.tsx), feature components.
- **Fix:** Create `useHasPermission()` hook and wrap sensitive menu items and action buttons to hide/disable actions unauthorized for user's role.

### P1-010: Frontend Warehouse API Route Path Standardization
- **Domain:** Frontend / Master Data
- **Files:** `StockTransferPage.tsx:28`, `SalesReturnPage.tsx:35`, `SalesOrderPage.tsx:32`, `PurchaseDrawer.tsx:46`
- **Fix:** Update API query paths from `/api/v1/master-data/warehouses` to `/api/v1/warehouses`.

### P1-011: Dedicated Login Endpoint Rate Limiting
- **Domain:** Security / Auth
- **File:** [`src/services/auth/auth.controller.ts`](file:///d:/apss-source/Inventory%20+%20POS/src/services/auth/auth.controller.ts)
- **Fix:** Apply `@Throttle({ default: { limit: 5, ttl: 60000 } })` to `POST /api/v1/auth/login`.

### P1-012: Floating-Point Precision Handling in Journal Balance Validation
- **Domain:** Accounting / Journal Engine
- **File:** [`src/services/journal-engine/journal-engine.service.ts:282`](file:///d:/apss-source/Inventory%20+%20POS/src/services/journal-engine/journal-engine.service.ts#L282)
- **Fix:** Round debit/credit line sums to 2 decimal places before evaluating balance tolerance.

### P1-013: POS Inventory Deduction Timing Adjustment
- **Domain:** POS / Inventory
- **File:** [`src/modules/pos/services/pos.service.ts:165`](file:///d:/apss-source/Inventory%20+%20POS/src/modules/pos/services/pos.service.ts#L165)
- **Fix:** Perform inventory deduction inside `applyPayment()` transaction instead of cart building `addItem()`.

### P1-014: Playwright E2E Database State Verification
- **Domain:** Testing / E2E
- **Files:** [`frontend/e2e/pos.spec.ts`](file:///d:/apss-source/Inventory%20+%20POS/frontend/e2e/pos.spec.ts), `purchase.spec.ts`
- **Fix:** Add database query assertions after UI actions to verify DB record insertion.

### P1-015: E2E Test Suite Expansion (O2C, Opname, Returns)
- **Domain:** Testing / E2E
- **Files:** `frontend/e2e/o2c.spec.ts` [NEW], `frontend/e2e/inventory.spec.ts` [NEW]
- **Fix:** Create Playwright test suites for Order-to-Cash, Stock Opname, and Sales Returns.

### P1-016: Non-Root Execution User in Backend Dockerfile
- **Domain:** DevOps / Infrastructure
- **File:** [`Dockerfile:20-41`](file:///d:/apss-source/Inventory%20+%20POS/Dockerfile)
- **Fix:** Add `USER node` before `CMD ["node", "dist/main"]` in `Dockerfile`.

### P1-017: Remove Destructive Auto-Seeding from Deployment Script
- **Domain:** DevOps / Infrastructure
- **File:** [`deploy.sh:40`](file:///d:/apss-source/Inventory%20+%20POS/deploy.sh)
- **Fix:** Remove `npm run prisma:seed` from `deploy.sh`.

### P1-018: Read Replica Connection Pool Isolation
- **Domain:** Performance / Infrastructure
- **File:** [`src/config/prisma-read.service.ts:14`](file:///d:/apss-source/Inventory%20+%20POS/src/config/prisma-read.service.ts#L14)
- **Fix:** Throw error if `DATABASE_REPLICA_URL` is missing in production and set explicit connection limits.

### P1-019: Prisma Database Connection Pool Limits
- **Domain:** Performance / Database
- **File:** [`src/config/prisma.service.ts:10`](file:///d:/apss-source/Inventory%20+%20POS/src/config/prisma.service.ts#L10)
- **Fix:** Configure `connection_limit=20&pool_timeout=10` on database connection string.

### P1-020: Non-Blocking Redis Cache Keyspace Scan
- **Domain:** Performance / Redis
- **File:** [`src/services/cache/cache.service.ts:84`](file:///d:/apss-source/Inventory%20+%20POS/src/services/cache/cache.service.ts#L84)
- **Fix:** Use `UNLINK` instead of `DEL` and yield control between scan batches.

---

## 4. REMEDIATION EXECUTION SEQUENCE

```
PHASE 13 REMEDIATION STEPS:
1. P0-001 (JWT Security)
2. P0-002 (Cross-Branch IDOR Security)
3. P0-003 (POS Auto-Journal Accounting Disconnect)
4. P0-004 (Database Backup & DR Scripts)
5. P0-005 (Nginx HTTPS/TLS Configuration)
6. P1 Security (P1-003 Redis Auth, P1-011 Login Rate Limit)
7. P1 Accounting (P1-004 Invoice Tax, P1-005 Balance Sheet Income, P1-012 Float Balance)
8. P1 Inventory & POS (P1-001 Zero-UUID, P1-002 Shift Status, P1-006 WAC Order, P1-007 Locks, P1-008 Return Cost, P1-013 Deduction Timing)
9. P1 Frontend & Testing (P1-009 Permission UI, P1-010 Warehouse Route 404, P1-014/015 E2E Tests)
10. P1 Infrastructure & Resilience (P1-016 Docker User, P1-017 Auto-Seed, P1-018 Read Replica, P1-019 DB Pool, P1-020 Redis Scan)
```
