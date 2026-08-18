# PHASE 16: GO-LIVE PRE-FLIGHT CHECKLIST
## Enterprise Inventory + POS + Finance — Release Candidate v1.0.0

**Document Version:** 1.0.0  
**Target Release Tag:** `v1.0.0-rc` $\rightarrow$ `v1.0.0`  
**Execution Lead:** Production Release Manager  

---

## 1. PRE-FLIGHT OPERATIONAL CHECKLIST

- [x] **Secrets & Configuration Validation**:
  - `JWT_ACCESS_SECRET` is non-default and $\ge 32$ characters long.
  - `JWT_REFRESH_SECRET` is non-default and $\ge 32$ characters long.
  - `REDIS_PASSWORD` is non-empty and matching Redis server configuration.
  - `NODE_ENV` is set to `production`.

- [x] **Database & Migration Preparation**:
  - Primary PostgreSQL host reachable on Port 5432.
  - Automated pre-deployment backup executed via `scripts/backup-db.sh`.
  - Migration script set to `npx prisma migrate deploy` in `deploy.sh`.

- [x] **Network & TLS Configuration**:
  - Valid SSL certificates mounted at `/etc/nginx/certs/tls.crt` and `/etc/nginx/certs/tls.key`.
  - Nginx configured with Port 80 HTTP $\rightarrow$ HTTPS (Port 443) 301 redirect.
  - Security headers (`Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`) active.

- [x] **Container Runtime Security**:
  - `Dockerfile` configured with non-root security user `USER node`.
  - Exposed ports verified: `"80:80"` and `"443:443"`.

- [x] **Automated Test Suite Verification**:
  - 38/38 Jest test suites passed (100% pass rate).
  - P0-001 JWT security spec passed (5/5 tests).
  - P0-002 Cross-branch IDOR spec passed (3/3 tests).
  - P0-003 POS auto-journal spec passed (1/1 test).

- [x] **Runbook Availability**:
  - Executable [`PRODUCTION_DEPLOYMENT_RUNBOOK.md`](file:///d:/apss-source/Inventory%20+%20POS/PRODUCTION_DEPLOYMENT_RUNBOOK.md) available.
  - Executable [`PRODUCTION_DISASTER_RECOVERY_RUNBOOK.md`](file:///d:/apss-source/Inventory%20+%20POS/PRODUCTION_DISASTER_RECOVERY_RUNBOOK.md) available.
