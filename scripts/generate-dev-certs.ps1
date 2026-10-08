# Generate self-signed TLS certificates for development / test environments
param(
    [string]$OutputDir = "$PSScriptRoot/../certs"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$certPath = Join-Path $OutputDir "tls.crt"
$keyPath = Join-Path $OutputDir "tls.key"

if ((Test-Path $certPath) -and (Test-Path $keyPath)) {
    Write-Host "[INFO] Certificates already exist at $OutputDir"
    exit 0
}

Write-Host "[INFO] Generating self-signed development certificates..."

$opensslPath = "openssl"
if (-not (Get-Command openssl -ErrorAction SilentlyContinue)) {
    $gitOpenssl = "C:\Program Files\Git\usr\bin\openssl.exe"
    if (Test-Path $gitOpenssl) {
        $opensslPath = $gitOpenssl
    } else {
        Write-Error "OpenSSL is not found on PATH or Git installation directory."
        exit 1
    }
}

& $opensslPath req -x509 -nodes -days 365 -newkey rsa:2048 `
    -keyout $keyPath `
    -out $certPath `
    -subj "/CN=localhost/O=Kiro ERP Dev/C=ID" `
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

Write-Host "[SUCCESS] Development certificates generated:"
Write-Host "  - Certificate: $certPath"
Write-Host "  - Private Key: $keyPath"
