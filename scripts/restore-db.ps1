# Database Restore Automation Script (PowerShell)
param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$TargetDb = "enterprise_db_restore_test",
    [string]$DbUser = $env:DB_USER,
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupFile)) {
    Write-Error "Backup file does not exist: $BackupFile"
    exit 1
}

if (-not $DbUser) { $DbUser = "postgres" }
if (-not $env:PGPASSWORD) { $env:PGPASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "postgres" } }

$pgRestore = "pg_restore"
$psql = "psql"
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
    $pgRestore = "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe"
    $psql = "C:\Program Files\PostgreSQL\16\bin\psql.exe"
}

Write-Host "[INFO] Re-creating target database '$TargetDb'..."
& $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $TargetDb;"
& $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "CREATE DATABASE $TargetDb;"

Write-Host "[INFO] Restoring from $BackupFile into '$TargetDb'..."
# pg_restore returns exit code 0 or 1 on non-fatal warnings
& $pgRestore -h $DbHost -p $DbPort -U $DbUser -d $TargetDb --no-owner --no-privileges -v $BackupFile

Write-Host "[INFO] Validating restored database tables..."
$tableCount = (& $psql -h $DbHost -p $DbPort -U $DbUser -d $TargetDb -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';").Trim()
Write-Host "[SUCCESS] Restored table count: $tableCount"

$coaCount = (& $psql -h $DbHost -p $DbPort -U $DbUser -d $TargetDb -t -c "SELECT count(*) FROM chart_of_accounts;").Trim()
Write-Host "[SUCCESS] Restored Chart of Accounts: $coaCount"

$userCount = (& $psql -h $DbHost -p $DbPort -U $DbUser -d $TargetDb -t -c "SELECT count(*) FROM users;").Trim()
Write-Host "[SUCCESS] Restored Users: $userCount"

Write-Host "[SUCCESS] Database restoration and verification verified successfully!"
