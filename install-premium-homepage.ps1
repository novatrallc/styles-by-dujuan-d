# STYLES BY DUJUAN D — Premium homepage/header update
# Run from the extracted package directory; no API, DB, migration or environment changes.
$ErrorActionPreference = 'Stop'
$project = 'C:\dev\projects\burtons-barbershop'
if (-not (Test-Path -LiteralPath (Join-Path $project 'package.json'))) { throw "Project not found at $project" }
$source = $PSScriptRoot
$files = @(
  'app\page.tsx',
  'components\header.tsx',
  'public\brand\dujuan-header-logo.webp',
  'public\brand\dujuan-studio.jpeg'
)
# Guard: never overwrite a missing component path; request exact import path instead.
$existingHeader = Join-Path $project 'components\header.tsx'
if (-not (Test-Path -LiteralPath $existingHeader)) {
  throw "Expected header file does not exist: $existingHeader. Locate the live header component and adjust the installer destination before running. No changes made."
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $project ('.backups\premium-homepage-' + $stamp)
foreach ($relative in $files) {
  if (-not (Test-Path -LiteralPath (Join-Path $source $relative))) { throw "Package file missing: $relative" }
}
foreach ($relative in $files) {
  $dest = Join-Path $project $relative
  $src = Join-Path $source $relative
  if (Test-Path -LiteralPath $dest) {
    $saved = Join-Path $backup $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $saved -Parent) | Out-Null
    Copy-Item -LiteralPath $dest -Destination $saved -Force
  }
  New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
  Copy-Item -LiteralPath $src -Destination $dest -Force
  Write-Host "UPDATED: $relative" -ForegroundColor Green
}
Write-Host ''
Write-Host "Premium homepage/header files installed. Backup: $backup" -ForegroundColor Cyan
Write-Host 'No Supabase, Stripe, booking or .env.local settings were changed.' -ForegroundColor Yellow
Write-Host 'NEXT: cd C:\dev\projects\burtons-barbershop ; npx tsc --noEmit'
