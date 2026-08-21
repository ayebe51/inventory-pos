#!/bin/bash
# ==============================================================================
# Enterprise Inventory + POS — Automated Database Backup Script (P0-004)
# ==============================================================================
# SLA: RPO = 1 Hour, RTO = 15 Minutes
# Description: Performs atomic pg_dump with gzip compression, timestamping,
#              local 7-day retention cleanup, and pipefail verification.
# ==============================================================================

set -e
set -o pipefail

# Load environment variables if .env exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-enterprise_db}"
PGPASSWORD="${DB_PASSWORD:-postgres}"
export PGPASSWORD

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "[$(date -u)] Starting database backup for ${DB_NAME}..." | tee -a "${LOG_FILE}"

# Check if pg_dump is directly available, or fallback to Docker container
if command -v pg_dump &> /dev/null; then
  DUMP_CMD="pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -F p ${DB_NAME}"
elif command -v docker &> /dev/null && docker ps | grep -q enterprise_db; then
  DUMP_CMD="docker exec -i enterprise_db pg_dump -U ${DB_USER} -F p ${DB_NAME}"
else
  echo "[$(date -u)] ❌ ERROR: Neither 'pg_dump' nor Docker container 'enterprise_db' is available!" | tee -a "${LOG_FILE}"
  exit 1
fi

# Execute dump with gzip compression
if eval "${DUMP_CMD}" | gzip -9 > "${BACKUP_FILE}"; then
  FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  
  # Verify file is not 0 bytes
  if [ ! -s "${BACKUP_FILE}" ]; then
    echo "[$(date -u)] ❌ ERROR: Backup file generated is 0 bytes!" | tee -a "${LOG_FILE}"
    rm -f "${BACKUP_FILE}"
    exit 1
  fi

  echo "[$(date -u)] ✅ Backup SUCCESSFUL: ${BACKUP_FILE} (${FILE_SIZE})" | tee -a "${LOG_FILE}"
else
  echo "[$(date -u)] ❌ ERROR: Database backup execution FAILED!" | tee -a "${LOG_FILE}"
  rm -f "${BACKUP_FILE}"
  exit 1
fi

# Retention policy: remove backups older than 7 days
echo "[$(date -u)] Cleaning up backups older than 7 days..." | tee -a "${LOG_FILE}"
find "${BACKUP_DIR}" -type f -name "backup_${DB_NAME}_*.sql.gz" -mtime +7 -delete

echo "[$(date -u)] Backup process finished successfully." | tee -a "${LOG_FILE}"
exit 0
