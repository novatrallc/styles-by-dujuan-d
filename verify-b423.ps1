param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$project = (Resolve-Path -LiteralPath $ProjectRoot).Path
$files = @(
  (Join-Path $project 'app\owner\owner-dashboard.tsx'),
  (Join-Path $project 'app\owner\stripe-verification\page.tsx'),
  (Join-Path $project 'app\api\owner\stripe-verification\route.ts')
)
foreach ($path in $files) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "FAIL: missing $path" }
}
$owner = [IO.File]::ReadAllText($files[0]); $page = [IO.File]::ReadAllText($files[1]); $api = [IO.File]::ReadAllText($files[2])
if (-not $owner.Contains("href:'/owner/stripe-verification'")) { throw 'FAIL: owner dashboard link missing' }
if (-not $page.Contains('/api/owner/stripe-verification')) { throw 'FAIL: page API wiring missing' }
foreach ($keyword in @('authorizeOwner(request)','isLocalSupabase()','payment_reconciliation','payment_webhook_events','Cache-Control')) {
  if (-not $api.Contains($keyword)) { throw "FAIL: API invariant missing: $keyword" }
}
if ($api -match '\.insert\(|\.update\(|\.delete\(|\.rpc\(') { throw 'FAIL: API unexpectedly performs a database write or RPC' }
Write-Host 'PASS: B4.2.3 source and read-only safeguards verified.' -ForegroundColor Green
Write-Host 'NEXT: npx tsc --noEmit; npm run build (while Next.js dev server is stopped).'
