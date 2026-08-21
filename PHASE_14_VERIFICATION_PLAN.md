# PHASE 14: COMPREHENSIVE VERIFICATION & ADVERSARIAL TEST EXECUTION PLAN
## Enterprise Inventory + POS + Finance — Release Candidate v1.0.0

**Date:** 2026-08-18  
**Auditor:** Principal Software Architect & Adversarial Production Readiness Engineer  
**Phase Status:** 🟡 IN PROGRESS  
**Objective:** Independently prove that every Phase 13 remediation actually resolved the underlying production risk without introducing regressions.

---

## 1. VERIFICATION METHODOLOGY & PRINCIPLES

### Core Principles
1. **Adversarial Verification**: Do not trust Phase 13 claims automatically. Challenge every claimed fix with empirical test execution and code inspection.
2. **No Code Edits During Verification**: Do not alter production source code during the initial verification pass. Any discovered defect must be recorded as `PHASE14-FINDING-XXX`.
3. **Database & Accounting Invariant Validation**: Verify that `Stock Balance = SUM(qty_in) - SUM(qty_out)`, `SUM(Debit) = SUM(Credit)`, and `Assets = Liabilities + Equity`.
4. **Empirical Evidence Required**: Every P0 and P1 verification must be accompanied by actual command outputs, Jest test results, or script logs.

---

## 2. P0 VERIFICATION MATRIX

| ID | Original Finding | Claimed Fix | Verification Method | Acceptance Criteria | Target Status |
|----|------------------|-------------|---------------------|---------------------|---------------|
| **P0-001** | Default/Weak JWT Secrets | `app.config.ts` superRefine | `npx jest src/config/app-config.spec.ts` + config validation test | Application fails on startup if secret is missing, default, or <32 chars in prod. Forged tokens return 401. | 🟡 PENDING |
| **P0-002** | Cross-Branch IDOR | `branch_id` query & findById scoping | `npx jest src/modules/invoicing/invoice-tenant.spec.ts` + controller review | Branch A user cannot list or view Branch B records. Access attempt returns `403 Forbidden`. | 🟡 PENDING |
| **P0-003** | POS $\rightarrow$ GL Disconnect | POS auto-journal events | `npx jest src/modules/pos/pos-journal.spec.ts` + POS checkout DB trace | POS cash sale creates `POS_SALE` & `POS_SALE_COGS` journal entries in DB. Debit = Credit. | 🟡 PENDING |
| **P0-004** | Missing DB Backup / DR | `scripts/backup-db.sh` & `restore-db.sh` | Bash script execution + pipefail test | Script generates non-zero `.sql.gz` file. Restore test creates schema and records in test DB. | 🟡 PENDING |
| **P0-005** | HTTP-Only Deployment | Nginx HTTPS redirect & SSL headers | Nginx config inspection & port binding check | Port 80 redirects 301 to 443. HSTS and TLS 1.2+ headers present. Port 443 mapped in compose. | 🟡 PENDING |

---

## 3. P1 VERIFICATION MATRIX

| ID | Domain | Feature / Area | Verification Method | Target Status |
|----|--------|----------------|---------------------|---------------|
| **P1-001** | POS | Dynamic UOM Resolution | Inspect `processFullTransaction()` | 🟡 PENDING |
| **P1-002** | POS | Shift Force-Close Status | Inspect `closeShift()` status query | 🟡 PENDING |
| **P1-003** | Security | Redis Auth | Inspect `redis.config.ts` & compose | 🟡 PENDING |
| **P1-004** | Accounting | Invoice Subtotal Tax Fix | Inspect `InvoiceService.createSalesInvoice()` | 🟡 PENDING |
| **P1-005** | Accounting | Balance Sheet Net Income | Inspect `ReportingService.getBalanceSheet()` | 🟡 PENDING |
| **P1-006** | Inventory | WAC Movement Order | Inspect ledger `orderBy` clauses | 🟡 PENDING |
| **P1-007** | Inventory | Row Locking in `recordMovement` | Inspect `recordMovement()` transaction | 🟡 PENDING |
| **P1-008** | Inventory | Sales Return Standard Cost | Inspect `createSalesReturn()` unit cost fallback | 🟡 PENDING |
| **P1-009** | Frontend | Permission UI Hiding | Inspect `useHasPermission()` hook | 🟡 PENDING |
| **P1-010** | Frontend | Warehouse Route 404 Fix | Grep `/api/v1/master-data/warehouses` in frontend | 🟡 PENDING |
| **P1-011** | Security | Login Rate Limit | Inspect `AuthController.login()` `@Throttle` | 🟡 PENDING |
| **P1-012** | Accounting | Integer Cent Journal Validation | Inspect `JournalEngineService.validateBalance()` | 🟡 PENDING |
| **P1-013** | POS | Inventory Deduction Timing | Inspect `applyPayment()` transaction | 🟡 PENDING |
| **P1-014** | Testing | E2E DB Verification Assertions | Inspect `pos-journal.spec.ts` assertions | 🟡 PENDING |
| **P1-015** | Testing | Tenant Isolation Unit Test | Inspect `invoice-tenant.spec.ts` assertions | 🟡 PENDING |
| **P1-016** | Infrastructure | Docker Non-Root User | Inspect `Dockerfile` `USER node` directive | 🟡 PENDING |
| **P1-017** | Infrastructure | Non-Destructive Deploy | Inspect `deploy.sh` for `prisma:seed` removal | 🟡 PENDING |
| **P1-018** | Resilience | Read Replica Isolation | Inspect `prisma-read.service.ts` configuration | 🟡 PENDING |
| **P1-019** | Resilience | Prisma Connection Pool Limits | Inspect `PrismaService` connection string | 🟡 PENDING |
| **P1-020** | Resilience | Non-Blocking Redis SCAN | Inspect `CacheService.scanAndDelete()` | 🟡 PENDING |

---

## 4. EXECUTION STEPS & SUITE VERIFICATION

```
Phase 14 Execution Sequence:
1. Run P0-001 Jest Spec (JWT validation rules)
2. Run P0-002 Jest Spec (Cross-Branch IDOR tenant isolation)
3. Run P0-003 Jest Spec (POS Auto-Journal integration)
4. Execute P0-004 Database Backup Script & Pipefail verification
5. Validate P0-005 Nginx HTTPS redirect & Security Headers
6. Execute full Jest suite across backend services
7. Execute frontend build verification (`npm run build` / TypeScript check)
8. Verify Database & Business Invariants
9. Generate PHASE_14_COMPREHENSIVE_VERIFICATION_REPORT.md
```
