# PRODUCTION DEPLOYMENT RUNBOOK
## Enterprise Inventory + POS + Finance — Release Candidate v1.0.0

**Document Version:** 1.0.0  
**Target System:** Production Container Environment (Docker / Nginx / NestJS / PostgreSQL / Redis)  
**Maintenance Window:** Off-Peak Operational Hours  

---

## 1. PRE-FLIGHT CHECKLIST

Before initiating production deployment, verify all pre-requisites:

- [ ] **Secrets Verification**: Ensure `.env` contains strong random secrets ($\ge 32$ chars) for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `REDIS_PASSWORD`.
- [ ] **TLS Certificates**: Verify SSL certificates are active at `/etc/nginx/certs/tls.crt` and `/etc/nginx/certs/tls.key`.
- [ ] **Disk Space**: Ensure minimum 20GB free space on database host and container logs volume.
- [ ] **Database Connectivity**: Verify primary PostgreSQL host is reachable on Port 5432.
- [ ] **Redis Reachability**: Verify Redis host is reachable on Port 6379 with password authentication enabled.

---

## 2. STEP-BY-STEP DEPLOYMENT PROCEDURE

```text
================================================================================
                       DEPLOYMENT EXECUTION TIMELINE
================================================================================
 [Step 1: Backup] ---> [Step 2: Pull/Build] ---> [Step 3: Migration]
                                                        |
 [Step 6: Traffic] <--- [Step 5: Smoke Test] <--- [Step 4: Restart]
================================================================================
```

### Step 1: Pre-Deployment Automated Database Backup
Execute atomic database backup prior to applying migrations:
```bash
# Execute automated backup script
bash scripts/backup-db.sh

# Verify generated backup size and status
ls -lh ./backups/
```

### Step 2: Build & Start Production Containers
Execute container image compilation and service instantiation:
```bash
# Build backend and frontend images without cache
docker-compose build --no-cache

# Start database and redis services first
docker-compose up -d postgres redis

# Wait 10 seconds for DB readiness
sleep 10
```

### Step 3: Execute Non-Destructive Database Migrations
Apply Prisma schema migrations safely:
```bash
# Run Prisma schema migration deploy (NON-DESTRUCTIVE)
docker-compose exec -T backend npx prisma migrate deploy
```
> [!IMPORTANT]
> **NEVER** run `prisma db push` or `prisma:seed` in production environments. Only run `prisma migrate deploy`.

### Step 4: Start Application & Reverse Proxy Services
```bash
# Start backend and frontend container services
docker-compose up -d backend frontend

# Verify container status
docker-compose ps
```

### Step 5: Post-Deployment Service Health Verification
```bash
# Verify backend API health endpoint
curl -k https://localhost/api/v1/health

# Verify HTTP -> HTTPS 301 redirect
curl -I http://localhost
```

---

## 3. ROLLBACK PROCEDURE

In the event of a critical deployment failure:
1. Revert container image tags to previous stable version:
   ```bash
   docker-compose down
   docker-compose up -d
   ```
2. If database schema rollback is required:
   ```bash
   bash scripts/restore-db.sh ./backups/backup_enterprise_db_<TIMESTAMP>.sql.gz enterprise_db
   ```
3. Re-verify health endpoints and resume operational monitoring.
