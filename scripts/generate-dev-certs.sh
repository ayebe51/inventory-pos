#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${1:-${SCRIPT_DIR}/../certs}"

mkdir -p "${OUTPUT_DIR}"

CERT_PATH="${OUTPUT_DIR}/tls.crt"
KEY_PATH="${OUTPUT_DIR}/tls.key"

if [[ -f "${CERT_PATH}" && -f "${KEY_PATH}" ]]; then
    echo "[INFO] Certificates already exist at ${OUTPUT_DIR}"
    exit 0
fi

echo "[INFO] Generating self-signed development certificates..."

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${KEY_PATH}" \
    -out "${CERT_PATH}" \
    -subj "/CN=localhost/O=Kiro ERP Dev/C=ID" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "${KEY_PATH}"
chmod 644 "${CERT_PATH}"

echo "[SUCCESS] Development certificates generated:"
echo "  - Certificate: ${CERT_PATH}"
echo "  - Private Key: ${KEY_PATH}"
