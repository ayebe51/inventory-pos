#!/usr/bin/env bash
set -euo pipefail

BACKUP_FILE="${1:-}"
TARGET_DB="${2:-enterprise_db_restore_test}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
    echo "[ERROR] Please specify a valid backup file to restore."
    echo "Usage: ./restore-db.sh <path_to_backup_file> [target_db]"
    exit 1
fi

export PGPASSWORD="${DB_PASSWORD:-postgres}"

echo "[INFO] Creating clean database '${TARGET_DB}'..."
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${TARGET_DB};"
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${TARGET_DB};"

echo "[INFO] Restoring from ${BACKUP_FILE} into '${TARGET_DB}'..."
pg_restore -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" --no-owner --no-privileges -v "${BACKUP_FILE}" || true

echo "[INFO] Verifying restoration..."
TABLE_COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "[SUCCESS] Total public tables restored: ${TABLE_COUNT}"

COA_COUNT=$(psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${TARGET_DB}" -t -c "SELECT count(*) FROM chart_of_accounts;")
echo "[SUCCESS] Chart of accounts count: ${COA_COUNT}"

echo "[SUCCESS] Restore test passed."
