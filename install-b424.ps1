# B4.2.4 local owner sandbox checkout patch. Never calls databases, Stripe, or the network.
# Applies exactly one RPC-name replacement in the owner-only route, with a backup.
param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$routePath = Join-Path $ProjectRoot 'app\api\owner\stripe-test-checkout\route.ts'
$publicRoute = Join-Path $ProjectRoot 'app\api\checkout\route.ts'
$envPath = Join-Path $ProjectRoot '.env.local'
$sqlSource = Join-Path $PSScriptRoot 'local-only-owner-sandbox-hold.sql'
$sqlDestination = Join-Path $ProjectRoot 'scripts\local-sandbox\local-only-owner-sandbox-hold.sql'

foreach ($path in @($routePath, $publicRoute, $envPath, $sqlSource)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Required file missing: $path" }
}

# Inspect literal environment lines without printing any secrets.
$envText = [IO.File]::ReadAllText($envPath)
function Read-Setting([string]$key) {
  $pattern = '(?m)^\s*' + [regex]::Escape($key) + '\s*=\s*([^\r\n#]*)'
  $matchesFound = [regex]::Matches($envText, $pattern)
  if ($matchesFound.Count -ne 1) { throw "Expected exactly one setting for $key in .env.local." }
  return $matchesFound[0].Groups[1].Value.Trim().Trim('"').Trim("'")
}
$url = Read-Setting 'NEXT_PUBLIC_SUPABASE_URL'
$origin = Read-Setting 'APP_ORIGIN'
$publicCheckout = Read-Setting 'ENABLE_STRIPE_CHECKOUT'
$notifications = Read-Setting 'ENABLE_NOTIFICATION_DELIVERY'
$stripeKey = Read-Setting 'STRIPE_SECRET_KEY'
$webhookSecret = Read-Setting 'STRIPE_WEBHOOK_SECRET'

if ($url -notmatch '^http://(127\.0\.0\.1|localhost):54421/?$') { throw 'Refusing: Supabase URL is not the local instance on port 54421.' }
if ($origin -ne 'http://localhost:3000') { throw 'Refusing: APP_ORIGIN must be http://localhost:3000.' }
if ($publicCheckout -ne 'false' -or $notifications -ne 'false') { throw 'Refusing: public checkout and notifications must both be false.' }
if (-not $stripeKey.StartsWith('sk_test_') -or -not $webhookSecret.StartsWith('whsec_')) { throw 'Refusing: Stripe test key or webhook signing secret missing.' }

$ownerSource = [IO.File]::ReadAllText($routePath)
$publicSource = [IO.File]::ReadAllText($publicRoute)
$oldCall = "db.rpc('create_checkout_hold', {"
$newCall = "db.rpc('create_owner_sandbox_checkout_hold', {"

# Do not loosen owner authentication or local-only safeguards.
foreach ($required in @('authorizeOwner(request)', 'ENABLE_OWNER_STRIPE_TEST_CHECKOUT', 'sk_test_', '54421', 'availability(day, body.service, true)')) {
  if (-not $ownerSource.Contains($required)) { throw "Owner route missing expected safeguard: $required. No changes made." }
}
if (-not [regex]::IsMatch($publicSource, "db\.rpc\(\s*'create_checkout_hold'\s*,\s*\{")) { throw 'Unexpected public checkout structure. No changes made.' }

# Check SQL destination up front, before editing any source file.
if (Test-Path -LiteralPath $sqlDestination) {
  $existingHash = (Get-FileHash -LiteralPath $sqlDestination -Algorithm SHA256).Hash
  $packageHash = (Get-FileHash -LiteralPath $sqlSource -Algorithm SHA256).Hash
  if ($existingHash -ne $packageHash) { throw 'Existing local sandbox SQL differs. No changes made.' }
}

if ($ownerSource.Contains($newCall)) {
  if ($ownerSource.Contains($oldCall)) { throw 'Ambiguous owner checkout RPC calls; manual review needed.' }
  Write-Host 'PASS: Owner checkout already calls the sandbox-only RPC. No route change needed.' -ForegroundColor Green
} else {
  $index = $ownerSource.IndexOf($oldCall, [StringComparison]::Ordinal)
  if ($index -lt 0 -or $ownerSource.IndexOf($oldCall, $index + $oldCall.Length, [StringComparison]::Ordinal) -ge 0) {
    throw 'Expected exactly one owner checkout RPC call. No changes made.'
  }
  $updated = $ownerSource.Replace($oldCall, $newCall)
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupDir = Join-Path $ProjectRoot ("backups\b424-owner-sandbox-$stamp")
  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
  Copy-Item -LiteralPath $routePath -Destination (Join-Path $backupDir 'route.ts') -ErrorAction Stop
  # Write UTF-8 without BOM, preserving most formatting.
  [IO.File]::WriteAllText($routePath, $updated, (New-Object System.Text.UTF8Encoding $false))
  Write-Host "PASS: Owner-only RPC updated. Backup: $backupDir" -ForegroundColor Green
}

# Retain the local SQL for developer handoff but NOT in supabase/migrations.
$sqlDir = Split-Path -Parent $sqlDestination
New-Item -ItemType Directory -Path $sqlDir -Force | Out-Null
if (Test-Path -LiteralPath $sqlDestination) {
  $a = (Get-FileHash -LiteralPath $sqlDestination -Algorithm SHA256).Hash
  $b = (Get-FileHash -LiteralPath $sqlSource -Algorithm SHA256).Hash
  if ($a -ne $b) { throw 'Existing local sandbox SQL differs. Review it manually; route change may already be applied.' }
} else {
  Copy-Item -LiteralPath $sqlSource -Destination $sqlDestination -ErrorAction Stop
}
Write-Host 'PASS: SQL reference copied to scripts/local-sandbox (NOT migrations).' -ForegroundColor Green
Write-Host 'NEXT: Verify SQL was executed in LOCAL Studio, then run npx tsc --noEmit and npm run build.'
