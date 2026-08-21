#!/bin/bash
# ==============================================================================
# Enterprise Inventory + POS — Database Restore Verification Script (P0-004)
# ==============================================================================
# Description: Restores a gzipped pg_dump backup into a target database
#              and performs integrity verification checks.
# Usage: ./scripts/restore-db.sh <path_to_backup_file.sql.gz> [target_db_name]
# ==============================================================================

set -e

BACKUP_FILE="$1"
TARGET_DB="${2:-enterprise_db_test_restore}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz> [target_db_name]"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file '${BACKUP_FILE}' not found!"
  exit 1
fi

if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
PGPASSWORD="${DB_PASSWORD:-postgres}"
export PGPASSWORD

echo "=================================================="
echo " Database Restore Verification"
echo " Target DB: ${TARGET_DB}"
echo " Backup File: ${BACKUP_FILE}"
echo "=================================================="

# Drop target test database if exists and recreate
echo "[1/3] Preparing isolated target database '${TARGET_DB}'..."
dropdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" --if-exists "${TARGET_DB}" || true
createdb -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" "${TARGET_DB}"

# Restore backup
echo "[2/3] Restoring backup file into '${TARGET_DB}'..."
gunzip -c "${BACKUP_FILE}" | psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -q

# Verify integrity
echo "[3/3] Running data integrity verification checks..."
USER_COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -t -c "SELECT COUNT(*) FROM users;")
PRODUCT_COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -t -c "SELECT COUNT(*) FROM products;")
JOURNAL_COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -t -c "SELECT COUNT(*) FROM journal_entries;")

echo "=================================================="
echo " Restore Verification Completed Successfully!"
echo " Users Record Count: $(echo ${USER_COUNT} | xargs)"
echo " Products Record Count: $(echo ${PRODUCT_COUNT} | xargs)"
echo " Journal Entries Count: $(echo ${JOURNAL_COUNT} | xargs)"
echo "=================================================="

exit 0
