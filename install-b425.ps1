# Styles by Dujuan D / B4.2.5 installation. No SQL, Stripe or environment writes.
param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-File([string]$Path, [string]$Purpose) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing $Purpose at $Path" }
}
function Same-File([string]$A, [string]$B) {
  return (Get-FileHash -LiteralPath $A -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $B -Algorithm SHA256).Hash
}
if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) { throw "Project folder not found: $ProjectRoot" }
$projectFolder = (Resolve-Path -LiteralPath $ProjectRoot).Path
$entries = @(
  @{ rel='app\api\owner\reconciliation\route.ts'; name='Reconciliation read API'; expected='payment_reconciliation' },
  @{ rel='app\api\owner\reconciliation\actions\route.ts'; name='New audit action API'; expected='' },
  @{ rel='app\owner\reconciliation\page.tsx'; name='Reconciliation owner screen'; expected='reconciliation' }
)
Require-File (Join-Path $projectFolder 'lib\owner-auth.ts') 'owner authentication helper'
Require-File (Join-Path $projectFolder 'app\api\stripe\webhook\route.ts') 'existing Stripe webhook'
Require-File (Join-Path $projectFolder 'app\owner\owner-dashboard.tsx') 'existing owner dashboard'
Require-File (Join-Path $PSScriptRoot 'sql\LOCAL-ONLY-b425-reconciliation-audit.sql') 'local-only SQL'

# Full preflight before any write. Refuse unexpected existing audit route.
$needsWork = @()
foreach ($entry in $entries) {
  $destination = Join-Path $projectFolder $entry.rel
  $source = Join-Path $PSScriptRoot $entry.rel
  Require-File $source $entry.name
  $existing = Test-Path -LiteralPath $destination -PathType Leaf
  if ($existing -and (Same-File $source $destination)) { continue }
  if ($existing -and $entry.expected -eq '') {
    throw "Unexpected existing audit API: $destination. No files changed. Send us this file before retrying."
  }
  if ($existing) {
    $text = [IO.File]::ReadAllText($destination)
    if (-not $text.Contains($entry.expected)) {
      throw "Unexpected $($entry.name) code at $destination. No files changed."
    }
  }
  $needsWork += @{ rel=$entry.rel; source=$source; destination=$destination; existing=$existing }
}
if ($needsWork.Count -eq 0) {
  Write-Host 'PASS: B4.2.5 is already installed; no files changed.' -ForegroundColor Green
  exit 0
}

$backupFolder = Join-Path $projectFolder ('backups\b425-payment-review-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -Path $backupFolder -ItemType Directory -Force | Out-Null
foreach ($entry in $needsWork) {
  if ($entry.existing) {
    $backupPath = Join-Path $backupFolder $entry.rel
    New-Item -Path (Split-Path -Parent $backupPath) -ItemType Directory -Force | Out-Null
    Copy-Item -LiteralPath $entry.destination -Destination $backupPath -ErrorAction Stop
  }
}
$changed = New-Object System.Collections.Generic.List[object]
try {
  foreach ($entry in $needsWork) {
    New-Item -Path (Split-Path -Parent $entry.destination) -ItemType Directory -Force | Out-Null
    Copy-Item -LiteralPath $entry.source -Destination $entry.destination -Force -ErrorAction Stop
    $changed.Add($entry)
    if (-not (Same-File $entry.source $entry.destination)) { throw "Post-copy verification failed: $($entry.rel)" }
  }
} catch {
  foreach ($entry in $changed) {
    if ($entry.existing) {
      Copy-Item -LiteralPath (Join-Path $backupFolder $entry.rel) -Destination $entry.destination -Force
    } else {
      Remove-Item -LiteralPath $entry.destination -Force -ErrorAction SilentlyContinue
    }
  }
  throw
}
Write-Host 'PASS: B4.2.5 UI and owner API installed.' -ForegroundColor Green
Write-Host "Backup: $backupFolder"
Write-Host 'Important: Run the separate LOCAL-ONLY SQL in LOCAL Studio (port 54423). This installer does not run SQL.' -ForegroundColor Yellow
Write-Host 'No Stripe charges, booking status updates, webhook edits, or .env.local changes were made.'
Write-Host 'Next: .\verify-b425.ps1; npx tsc --noEmit; npm run build (server stopped).' -ForegroundColor Cyan
