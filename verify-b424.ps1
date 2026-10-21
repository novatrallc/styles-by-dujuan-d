param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$routePath = Join-Path $ProjectRoot 'app\api\owner\stripe-test-checkout\route.ts'
$publicPath = Join-Path $ProjectRoot 'app\api\checkout\route.ts'
$ownerSource = [IO.File]::ReadAllText($routePath)
$publicSource = [IO.File]::ReadAllText($publicPath)
if (-not $ownerSource.Contains("db.rpc('create_owner_sandbox_checkout_hold', {")) { throw 'Owner route has not been patched.' }
if ($ownerSource.Contains("db.rpc('create_checkout_hold', {")) { throw 'Owner route still calls the public hold.' }
if (-not [regex]::IsMatch($publicSource, "db\.rpc\(\s*'create_checkout_hold'\s*,\s*\{")) { throw 'Public checkout was unexpectedly changed.' }
if (-not $ownerSource.Contains('authorizeOwner(request)') -or -not $ownerSource.Contains('54421')) { throw 'Owner or local-only check missing.' }
Write-Host 'PASS: Owner route uses local-only sandbox RPC; public checkout retains original RPC.' -ForegroundColor Green
Write-Host 'NOTE: This cannot verify local SQL installation or Stripe/webhook delivery.'
