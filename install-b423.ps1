# B4.2.3 - Read-only local Stripe Verification Center
# Extract the ZIP first, stop Next.js, and run from the extracted folder.
param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-File([string]$Path,[string]$Description) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing $Description at $Path" }
}
function Same-Content([string]$A,[string]$B) {
  return (Get-FileHash -LiteralPath $A -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $B -Algorithm SHA256).Hash
}

$project = (Resolve-Path -LiteralPath $ProjectRoot).Path
$dashboardPath = Join-Path $project 'app\owner\owner-dashboard.tsx'
$serverPath = Join-Path $project 'app\api\owner\stripe-verification\route.ts'
$clientPath = Join-Path $project 'app\owner\stripe-verification\page.tsx'
$sourceServer = Join-Path $PSScriptRoot 'app\api\owner\stripe-verification\route.ts'
$sourceClient = Join-Path $PSScriptRoot 'app\owner\stripe-verification\page.tsx'

Require-File $dashboardPath 'owner dashboard'
Require-File (Join-Path $project 'app\api\owner\stripe-test-checkout\route.ts') 'owner-only Stripe sandbox checkout route'
Require-File (Join-Path $project 'lib\owner-auth.ts') 'owner authorization helper'
Require-File $sourceServer 'verification route package file'
Require-File $sourceClient 'verification page package file'

$dashboardText = [IO.File]::ReadAllText($dashboardPath)
$anchor = 'const operationsLinks: OperationsLink[] = ['
$linkPath = "/owner/stripe-verification"
$linkRow = "  {href:'/owner/stripe-verification',title:'Stripe Verification Center',description:'Audit local test bookings, payment events, and readiness safeguards.',Icon:ShieldCheck,tag:'PAYMENT READINESS'},"

$hasLink = $dashboardText.Contains($linkPath)
$hasServer = Test-Path -LiteralPath $serverPath -PathType Leaf
$hasClient = Test-Path -LiteralPath $clientPath -PathType Leaf

# All preflight checks run before ANY file write. Existing matching files are
# accepted as staged assets; differing files stop the install safely.
if (-not $hasLink) {
  $idx = $dashboardText.IndexOf($anchor, [StringComparison]::Ordinal)
  if ($idx -lt 0 -or $dashboardText.IndexOf($anchor, $idx + $anchor.Length, [StringComparison]::Ordinal) -ge 0) {
    throw 'Expected a single Business Operations link list in owner-dashboard.tsx. No changes made.'
  }
  if (-not $dashboardText.Contains('ShieldCheck')) {
    throw 'The expected ShieldCheck icon is missing. No changes made; send the current dashboard file.'
  }
}
if ($hasServer -and -not (Same-Content $serverPath $sourceServer)) {
  throw 'The verification API route already exists with different code. No changes made.'
}
if ($hasClient -and -not (Same-Content $clientPath $sourceClient)) {
  throw 'The verification page already exists with different code. No changes made.'
}
if ($hasLink -and $hasServer -and $hasClient) {
  Write-Host 'PASS: B4.2.3 is already installed; nothing changed.' -ForegroundColor Green
  exit 0
}
if ($hasLink -and (-not $hasServer -or -not $hasClient)) {
  throw 'Dashboard contains B4.2.3 link but one or both pages are missing. No changes made; share this error.'
}

$lineEnding = if ($dashboardText.Contains("`r`n")) { "`r`n" } else { "`n" }
$updated = $dashboardText.Replace($anchor, $anchor + $lineEnding + $linkRow)
$backupRoot = Join-Path $project ('backups\b423-stripe-verification-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -Path $backupRoot -ItemType Directory -Force | Out-Null
Copy-Item -LiteralPath $dashboardPath -Destination (Join-Path $backupRoot 'owner-dashboard.tsx') -ErrorAction Stop
$created = New-Object System.Collections.Generic.List[string]
try {
  if (-not $hasServer) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $serverPath) -Force | Out-Null
    Copy-Item -LiteralPath $sourceServer -Destination $serverPath -ErrorAction Stop
    $created.Add($serverPath)
  }
  if (-not $hasClient) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $clientPath) -Force | Out-Null
    Copy-Item -LiteralPath $sourceClient -Destination $clientPath -ErrorAction Stop
    $created.Add($clientPath)
  }
  [IO.File]::WriteAllText($dashboardPath, $updated, [Text.UTF8Encoding]::new($false))
  if (-not ([IO.File]::ReadAllText($dashboardPath)).Contains($linkPath)) {
    throw 'Dashboard verification failed.'
  }
} catch {
  Copy-Item -LiteralPath (Join-Path $backupRoot 'owner-dashboard.tsx') -Destination $dashboardPath -Force
  foreach ($path in $created) {
    if (Test-Path -LiteralPath $path -PathType Leaf) {
      Remove-Item -LiteralPath $path -Force
    }
  }
  throw
}
Write-Host 'PASS: B4.2.3 installed — local owner-only Stripe Verification Center.' -ForegroundColor Green
Write-Host "Backup: $backupRoot"
Write-Host 'No migrations, Supabase writes, Stripe charges, or configuration flag changes were made.'
Write-Host 'NEXT: npx tsc --noEmit; npm run build; npm run dev' -ForegroundColor Cyan
