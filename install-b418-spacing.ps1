# Styles by Dujuan D — B4.1.8 responsive homepage spacing
# Run this script FROM the extracted ZIP folder.
# Updates only app/page.tsx. Existing file is backed up; no data, server or auth changes.
$ErrorActionPreference = 'Stop'
$project = 'C:\dev\projects\burtons-barbershop'
$relative = 'app\page.tsx'
$destination = Join-Path $project $relative
$source = Join-Path $PSScriptRoot $relative
$priorHash = 'BCE41DE912086BD637FA06AEB25E0D08883E344017DAEF692409CF406FF6DCF3'
$newHash = 'E42BCDC47F2416EE4018CF6EDF71A4B2263548EF16DE5618B0EBC4F5B29E602'

if (-not (Test-Path -LiteralPath (Join-Path $project 'package.json'))) { throw "Project not found: $project" }
if (-not (Test-Path -LiteralPath $destination)) { throw "Homepage not found: $destination" }
if (-not (Test-Path -LiteralPath $source)) { throw "Update file not found: $source. Extract the entire ZIP first." }
$incomingHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
if ($incomingHash -ne $newHash) { throw 'Update file failed integrity check. Please re-extract the ZIP.' }
$currentHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
if ($currentHash -eq $newHash) { Write-Host 'B4.1.8 is already installed; no changes made.' -ForegroundColor Green; exit 0 }
if ($currentHash -ne $priorHash) {
  throw 'Homepage differs from the B4.1.7 package. No changes made to avoid overwriting custom edits. Share your current app/page.tsx for a tailored merge.'
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $project ('.backups\b418-homepage-spacing-' + $stamp)
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backupFile = Join-Path $backupDir 'page.tsx'
Copy-Item -LiteralPath $destination -Destination $backupFile -Force
Copy-Item -LiteralPath $source -Destination $destination -Force
Write-Host 'INSTALLED: B4.1.8 responsive homepage spacing' -ForegroundColor Green
Write-Host "BACKUP: $backupFile" -ForegroundColor Cyan
Write-Host 'ONLY app/page.tsx was changed. No auth, payment, Supabase, API, stylesheets, or .env.local edits.' -ForegroundColor Yellow
Write-Host 'NEXT: Stop the dev server if it is running; run npx tsc --noEmit; then npm run dev.'
