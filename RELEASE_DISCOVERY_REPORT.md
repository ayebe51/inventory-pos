# Phase 0: Release Discovery Report
## Kiro ERP & POS — Production Hardening & Release Gate

**Date**: 2026-09-08  
**Audit Status Baseline**: 91.5/100 (Ready with Conditions)  
**Target Status**: >= 95/100 (Production Ready — Zero Known P0/P1 Blockers)  
**Lead Auditor/Architect**: Principal Software Architect & Release Engineer  

---

## 1. System Architecture & Topology

Kiro ERP & POS is designed as an enterprise-grade Modular Monolith backend coupled with a React Single-Page Application (SPA) frontend, with reverse-proxy termination, structured logging, and PostgreSQL transactional storage.

```
[ Client Browser / POS Terminal / Tablet ]
                  │
                  ▼ HTTPS / 443
         [ Nginx Reverse Proxy ]
         ├── Static Assets (React 19 / Vite SPA, PWA ServiceWorker)
         └── /api/v1/ Reverse Proxy
                  │
                  ▼ HTTP / 3000
    [ NestJS 10 Modular Monolith (Node v24) ]
    ├── Guards (JWT, RBAC, SOD, Permissions)
    ├── Interceptors (Logging/Correlation ID, Idempotency)
    ├── Modules: Auth, Master Data, Inventory, Purchase, POS, Invoicing, Accounting, Governance, Reporting
    ├── Journal Engine (Debit === Credit Invariant Enforcement)
    └── Numbering Engine (PostgreSQL Advisory Locks / Sequence Isolation)
         │                         │
         ▼                         ▼
 [ PostgreSQL 15/16 ]         [ Redis 7 ]
 (ACID Ledger, Migrations)    (Distributed Lock, Cache, Rate Limit)
```

---

## 2. Runtime Dependencies & Environment Configuration

### Backend Runtime
- **Node.js**: v24.15.0 LTS (Alpine base in Docker container)
- **Framework**: NestJS 10.4.15
- **ORM / Query Engine**: Prisma 5.22.0
- **Database**: PostgreSQL 15/16 with connection pooling and schema isolation
- **Caching & Locks**: Redis 7 (single node or cluster mode supported) with in-memory resilient fallback
- **Authentication**: JWT (Access 15m, Refresh 7d, TOTP MFA with RFC 6238 compliance)

### Frontend Runtime
- **React**: v19.2.7 (Strict Mode, Lazy route loading)
- **Bundler**: Vite 8.1.5 with manual chunk splitting
- **Design System**: Ant Design v5 (Dark & Light theme system, Coral Finexy brand tokens)
- **State Management**: TanStack Query v5 + Zustand v5
- **Visuals / Reports**: Apache ECharts, jsPDF, XLSX

---

## 3. Deployment Path & Infrastructure

- **Container Engine**: Docker & Docker Compose v3.8
- **Service Mesh**:
  1. `enterprise_db` (`postgres:15-alpine`): Persistent volume `postgres_data`, internal port 5432, healthcheck via `pg_isready`.
  2. `enterprise_redis` (`redis:7-alpine`): Persistent volume `redis_data`, internal port 6379, `--requirepass` protected, healthcheck via `redis-cli ping`.
  3. `enterprise_backend` (`node:20-alpine`): Non-root execution (`USER node`), port 3000, `wget` healthcheck on `/api/v1/health`.
  4. `enterprise_frontend` (`nginx:alpine`): TLS termination (ports 80 & 443), static asset gzip/caching, proxy pass to backend, mounted certificates `./certs:/etc/nginx/certs:ro`.

---

## 4. Critical Configuration & Findings Discovered

| Finding ID | Component | Severity | Description & Root Cause | Remediation Path |
|---|---|---|---|---|
| **F-01** | Docker / Redis | **P1** | `redis.config.ts` enforces `REDIS_PASSWORD` when `NODE_ENV=production`. `docker-compose.yml` backend service did not pass `REDIS_PASSWORD`. Backend would crash on container startup. | Inject `REDIS_PASSWORD: ${REDIS_PASSWORD:-redis_secure_auth_pass_2026}` into backend service; add Redis healthcheck. |
| **F-02** | Docker / Nginx | **P1** | `frontend/nginx.conf` requires `/etc/nginx/certs/tls.crt` and `tls.key`. `docker-compose.yml` had no volume mount for certs. Container failed to start without TLS files. | Add `./certs:/etc/nginx/certs:ro` volume mount; implement dev cert generation script and production Let's Encrypt / external cert guidelines. |
| **F-03** | Security / Upload | **P1** | Bank Reconciliation `uploadStatement` had raw `@UploadedFile()` without `ParseFilePipeBuilder`, allowing unvalidated files, binary payloads, and spreadsheet formula injection. | Add `ParseFilePipeBuilder` (5MB limit, CSV MIME/ext), server-side binary payload detection, row limit (5,000), date/amount validation, and CSV formula injection sanitization. |
| **F-04** | Database Migrations | **P1** | 12 migration files in `prisma/migrations` were not recorded in `_prisma_migrations` due to historical `db push`. `npx prisma migrate status` exited with code 1. | Run `npx prisma migrate resolve --applied` across all 12 migrations to baseline DB; verify status is clean. |
| **F-05** | Frontend Bundle | **P2** | Bundle size had chunks exceeding 1 MB (`esm-BZNYaq2X.js` 1,136 kB, `ReportingPage` 723 kB) because `vite.config.ts` lacked `manualChunks` and `ReportingPage` imported `xlsx` and `jspdf` eagerly. | Implement `manualChunks` in `vite.config.ts` (split react, antd, query, charts, export); load XLSX and jsPDF dynamically on-demand in `ReportingPage`. |
| **F-06** | UI Responsiveness | **P2** | Multiple data tables (`PaymentPage`, `SalesOrderPage`, `SalesReturnPage`, `BankReconciliationPage`, `StockLedgerPage`, `APSubPage`, `ARSubPage`, `CashBankSubPage`, `FixedAssetPage`) lacked `scroll={{ x: 'max-content' }}` causing cell clipping on mobile/tablet viewports. | Add responsive horizontal scroll configurations across all enterprise data tables. |
| **F-07** | PWA Manifest | **P2** | `manifest.json` referenced `/favicon.ico` which does not exist in `public/`. `index.html` referenced `/vite.svg` which does not exist in `public/`. Resulted in 404 console errors. | Point manifest and HTML link tags to valid assets `/favicon.svg` and `/icons.svg`. |
| **F-08** | Healthchecks | **P2** | Redis, Backend, and Frontend containers lacked native Docker healthchecks, causing `depends_on` to trigger before services were actually healthy. | Add native healthchecks to `Dockerfile`, `frontend/Dockerfile`, and `docker-compose.yml`. |
| **F-09** | Observability | **P2** | Backend lacked structured request logging and correlation ID tracking (`x-request-id`). Sensitive credentials could potentially leak into server logs without masking. | Implement `LoggingInterceptor` with correlation ID, duration, status, and sensitive parameter masking. |
| **F-10** | Disaster Recovery | **P2** | No standardized automated backup and restore verification scripts or policy existed. | Implement `scripts/backup-db` and `scripts/restore-db` with automated test restore verification and retention policy. |

---

## 5. Remediation Plan & Execution Sequence

1. **Step 1**: Baseline Database Migrations (`prisma migrate resolve --applied`) — **COMPLETED** (12/12 migrations marked applied; `prisma migrate status` clean).
2. **Step 2**: Remediate Redis configuration & Docker Compose (`REDIS_PASSWORD` injection, healthcheck).
3. **Step 3**: Remediate Nginx TLS certificates (Volume mount, dev certificate generator script, `.gitignore` protection, documentation).
4. **Step 4**: Remediate Bank Statement File Upload Security (`ParseFilePipeBuilder`, 5MB limit, CSV MIME/ext, formula injection sanitization, unit test suite).
5. **Step 5**: Frontend bundle optimization (`vite.config.ts` `manualChunks`, dynamic import for `xlsx`/`jspdf`, build verification).
6. **Step 6**: UI table responsive hardening (`scroll={{ x: 'max-content' }}`).
7. **Step 7**: PWA manifest and favicon asset fix.
8. **Step 8**: Production Observability (Structured logging interceptor with correlation ID).
9. **Step 9**: Database Backup & Recovery scripts and restore verification test.
10. **Step 10**: Full Test Suite Execution (Unit, E2E, Docker, Production Journey Smoke Test).
11. **Step 11**: Production Release Gate & Final Report generation.
