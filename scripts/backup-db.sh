#!/usr/bin/env bash
set -euo pipefail

DB_NAME="${DB_NAME:-enterprise_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${SCRIPT_DIR}/../backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

export PGPASSWORD="${DB_PASSWORD:-postgres}"

mkdir -p "${BACKUP_DIR}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.dump"

echo "[INFO] Starting backup for database '${DB_NAME}'..."
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -F c -b -v -f "${BACKUP_FILE}" "${DB_NAME}"

if [[ -f "${BACKUP_FILE}" && -s "${BACKUP_FILE}" ]]; then
    SIZE_KB=$(du -k "${BACKUP_FILE}" | cut -f1)
    echo "[SUCCESS] Backup created successfully: ${BACKUP_FILE} (${SIZE_KB} KB)"
else
    echo "[ERROR] Backup failed or file is empty."
    exit 1
fi

echo "[INFO] Applying retention policy (deleting backups older than ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "${DB_NAME}_*.dump" -mtime +"${RETENTION_DAYS}" -delete
echo "[SUCCESS] Retention policy applied."
