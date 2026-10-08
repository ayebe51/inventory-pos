# Database Backup & Disaster Recovery Policy
## Kiro ERP & POS Enterprise Deployment

---

## 1. Objectives & Metrics

- **Recovery Point Objective (RPO)**: <= 1 Hour (Daily automated full backups + WAL archiving for Point-In-Time Recovery)
- **Recovery Time Objective (RTO)**: <= 30 Minutes (Automated parallel pg_restore procedure)
- **Retention Schedule**:
  - Daily backups: Retained for 7 days
  - Weekly backups: Retained for 4 weeks
  - Monthly archives: Retained for 12 months (off-site storage)

---

## 2. Backup Execution Procedures

### Automated Daily Backup Command
```bash
# Linux / Docker
./scripts/backup-db.sh

# Windows / PowerShell
powershell -ExecutionPolicy Bypass -File ./scripts/backup-db.ps1
```

### Backup Format
- PostgreSQL Custom Format (`-F c`), compressed, including blobs and schema metadata.
- Filename pattern: `backups/enterprise_db_YYYYMMDD_HHMMSS.dump`

---

## 3. Restoration & Verification Procedure

Before restoring to production:
1. Always restore to a temporary verification database (`enterprise_db_restore_test`).
2. Run integrity checks (table count, row counts, accounting balances).
3. Switch production connection string only after validation succeeds.

### Restore Command
```bash
# Linux / Docker
./scripts/restore-db.sh backups/enterprise_db_YYYYMMDD_HHMMSS.dump enterprise_db_restore_test

# Windows / PowerShell
powershell -ExecutionPolicy Bypass -File ./scripts/restore-db.ps1 -BackupFile backups/enterprise_db_YYYYMMDD_HHMMSS.dump -TargetDb enterprise_db_restore_test
```

---

## 4. Verification Check Invariants
- `information_schema.tables`: Must match schema table count (38+ core tables)
- `chart_of_accounts`: Must include all 73 standard Indonesian COA records
- `journal_entry_lines`: `SUM(debit) === SUM(credit)`
- `inventory_ledger`: `running_qty >= 0` across all items
