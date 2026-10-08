# Database Backup Automation Script (PowerShell)
param(
    [string]$DbName = $env:DB_NAME,
    [string]$DbUser = $env:DB_USER,
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [string]$BackupDir = "$PSScriptRoot/../backups",
    [int]$RetentionDays = 7
)

$ErrorActionPreference = "Stop"

if (-not $DbName) { $DbName = "enterprise_db" }
if (-not $DbUser) { $DbUser = "postgres" }
if (-not $env:PGPASSWORD) { $env:PGPASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "postgres" } }

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$pgDump = "pg_dump"
if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
    $defaultPgDump = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
    if (Test-Path $defaultPgDump) {
        $pgDump = $defaultPgDump
    } else {
        Write-Error "pg_dump not found on PATH or in standard PostgreSQL 16 directory."
        exit 1
    }
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "${DbName}_${timestamp}.dump"

Write-Host "[INFO] Starting database backup for '$DbName'..."
& $pgDump -h $DbHost -p $DbPort -U $DbUser -F c -b -v -f $backupFile $DbName

if ((Test-Path $backupFile) -and ((Get-Item $backupFile).Length -gt 0)) {
    $sizeKb = [math]::Round(((Get-Item $backupFile).Length / 1KB), 2)
    Write-Host "[SUCCESS] Backup created successfully: $backupFile (${sizeKb} KB)"
} else {
    Write-Error "Backup file was not created or is empty."
    exit 1
}

# Apply retention policy
Write-Host "[INFO] Applying retention policy: removing backups older than $RetentionDays days..."
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "${DbName}_*.dump" | Where-Object { $_.CreationTime -lt $cutoffDate } | ForEach-Object {
    Write-Host "  Removing old backup: $($_.Name)"
    Remove-Item $_.FullName -Force
}
Write-Host "[SUCCESS] Backup and retention cycle completed."
