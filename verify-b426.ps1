param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) { throw "Project not found: $ProjectRoot" }
$folder = (Resolve-Path -LiteralPath $ProjectRoot).Path
$required = @(
  'app\api\owner\payment-activity\route.ts',
  'app\api\owner\payment-activity\stripe\route.ts',
  'app\owner\payment-activity\page.tsx',
  'app\owner\reconciliation\page.tsx',
  'app\owner\owner-dashboard.tsx'
)
foreach ($relative in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $folder $relative) -PathType Leaf)) {
    throw "Missing B4.2.6 file: $relative"
  }
}
function Confirm-Text([string]$Path, [string]$Pattern, [string]$Message) {
  if (-not ([IO.File]::ReadAllText($Path).Contains($Pattern))) { throw $Message }
}
$readAPI = Join-Path $folder 'app\api\owner\payment-activity\route.ts'
$stripeAPI = Join-Path $folder 'app\api\owner\payment-activity\stripe\route.ts'
$review = Join-Path $folder 'app\owner\reconciliation\page.tsx'
$dashboard = Join-Path $folder 'app\owner\owner-dashboard.tsx'
Confirm-Text $readAPI 'authorizeOwner' 'Missing owner authorization for timeline.'
Confirm-Text $readAPI '54421' 'Missing local Supabase guard for timeline.'
Confirm-Text $stripeAPI 'authorizeOwner' 'Missing owner authorization for Stripe lookup.'
Confirm-Text $stripeAPI "key.startsWith('sk_test_')" 'Missing Stripe test-key requirement.'
Confirm-Text $stripeAPI "session.livemode !== false" 'Missing live-mode rejection.'
Confirm-Text $stripeAPI 'stripe_checkout_session_id' 'Missing stored session validation.'
Confirm-Text $review 'const selected = filtered.find' 'B4.2.5 review-filter fix missing.'
Confirm-Text $dashboard '/owner/payment-activity' 'Owner dashboard link missing.'
$readBody = [IO.File]::ReadAllText($readAPI)
if ($readBody.Contains('.insert(') -or $readBody.Contains('.update(') -or $readBody.Contains('.rpc(')) {
  throw 'Timeline API unexpectedly contains a database write or RPC.'
}
$stripeBody = [IO.File]::ReadAllText($stripeAPI)
if ($stripeBody.Contains("method: 'POST'") -or $stripeBody.Contains('.insert(') -or $stripeBody.Contains('.update(') -or $stripeBody.Contains('.rpc(')) {
  throw 'Stripe status endpoint unexpectedly contains a write.'
}
Write-Host 'PASS: B4.2.6 files, local-owner authorization, read-only checks and review filter.' -ForegroundColor Green
Write-Host 'NEXT: npx tsc --noEmit; npm run build (with Next.js stopped).' -ForegroundColor Cyan
Write-Host 'NOTE: This verification does not prove automatic Stripe CLI webhook delivery.'
