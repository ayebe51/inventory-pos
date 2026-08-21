# PRODUCTION DISASTER RECOVERY RUNBOOK
## Enterprise Inventory + POS + Finance — Release Candidate v1.0.0

**Document Version:** 1.0.0  
**Target Recovery Point Objective (RPO):** $< 1$ Hour  
**Target Recovery Time Objective (RTO):** $< 15$ Minutes  

---

## 1. INCIDENT SEVERITY MATRIX

| Incident Severity | Impact Description | Primary Action | Target RTO |
|-------------------|--------------------|----------------|------------|
| **SEV-1 (Critical)** | Total Database Failure / Storage Corruption | Full Database Restore from Gzip Dump | 15 Minutes |
| **SEV-2 (High)** | Container Crash / Memory Exhaustion | Automated Container Restart / Rescaling | 5 Minutes |
| **SEV-3 (Medium)** | Redis Cache Node Failure | Cache Failover / Flush & Re-index | 5 Minutes |
| **SEV-4 (Low)** | Minor Route Degradation | Worker Restart / Log Inspection | 30 Minutes |

---

## 2. DISASTER RECOVERY PROCEDURES

```text
================================================================================
                    DATABASE RESTORE & RECOVERY WORKFLOW
================================================================================
 [Detection] ---> [Quarantine DB] ---> [Create Target DB] ---> [Gunzip & Restore]
                                                                      |
 [Resume Ops] <--- [Run Integrity Checks] <--- [Point App to Target] <-+
================================================================================
```

### Incident 1: Database Corruption / Data Loss (SEV-1)
1. **Identify Most Recent Backup File**:
   ```bash
   ls -lt ./backups/backup_enterprise_db_*.sql.gz | head -n 1
   ```
2. **Execute Non-Destructive Restore Verification**:
   ```bash
   bash scripts/restore-db.sh ./backups/backup_enterprise_db_<TIMESTAMP>.sql.gz enterprise_db_restored
   ```
3. **Run Integrity & Record Count Verification**:
   Verify user, product, transaction, and journal line counts match expected pre-incident metrics.
4. **Switch Database Host Connection**:
   Update `DATABASE_URL` in `.env` to point to `enterprise_db_restored` and restart application backend:
   ```bash
   docker-compose restart backend
   ```

---

### Incident 2: Redis Cluster / Cache Failure (SEV-3)
1. Restart Redis container service:
   ```bash
   docker-compose restart redis
   ```
2. Clear stale cache patterns if required:
   Backend automatically uses non-blocking `UNLINK` for cache invalidation without event loop blocking.

---

### Incident 3: Container Crash / Out-of-Memory (SEV-2)
1. Inspect container crash logs:
   ```bash
   docker-compose logs --tail=100 backend
   ```
2. Restart backend worker service:
   ```bash
   docker-compose restart backend
   ```

---

## 3. RECOVERY INTEGRITY CHECKLIST

Following any disaster recovery restore, execute the following invariant checks before reopening client access:
- [ ] **Debit = Credit**: Execute `SELECT SUM(debit) - SUM(credit) FROM journal_entry_lines;` (Must equal 0.00).
- [ ] **Stock Conservation**: Verify `running_qty` in `inventory_ledger` matches `SUM(qty_in) - SUM(qty_out)`.
- [ ] **Tenant Scoping**: Verify `branch_id` is populated across all transaction tables.
