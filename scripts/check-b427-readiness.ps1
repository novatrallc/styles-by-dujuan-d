# B4.2.7 read-only safety preflight. Prints no API keys or merchant secrets.
param([string]$ProjectRoot='C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
$required = @(
  'app\api\owner\payment-readiness\route.ts',
  'app\owner\payment-readiness\page.tsx',
  'lib\payments\domain.ts',
  'lib\payments\settlement-policy.ts',
  'app\api\stripe\webhook\route.ts',
  'app\owner\payment-activity\page.tsx'
)
foreach ($file in $required) {
  if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $file) -PathType Leaf)) { throw "Required project file missing: $file" }
}
$envPath = Join-Path $ProjectRoot '.env.local'
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) { throw 'Missing .env.local' }
$lines = @(Get-Content -LiteralPath $envPath)
$bad = $false
foreach ($flag in @('ENABLE_STRIPE_CHECKOUT','ENABLE_OWNER_STRIPE_TEST_CHECKOUT','ENABLE_NOTIFICATION_DELIVERY')) {
  $matches = @($lines | Where-Object { $_ -match ('^\s*' + [regex]::Escape($flag) + '\s*=') })
  if ($matches.Count -ne 1) { Write-Host "STOP: $flag must occur exactly once." -ForegroundColor Red; $bad = $true; continue }
  $value = (($matches[0] -split '=',2)[1]).Trim().Trim('"').Trim("'")
  if ($value -ne 'false') { Write-Host "STOP: $flag must remain false." -ForegroundColor Red; $bad = $true }
  else { Write-Host "PASS: $flag is off." -ForegroundColor Green }
}
foreach ($flag in @('ENABLE_SQUARE_PAYMENTS','ENABLE_SQUARE_ONLINE_CHECKOUT')) {
  $matches = @($lines | Where-Object { $_ -match ('^\s*' + [regex]::Escape($flag) + '\s*=') })
  if ($matches.Count -gt 1) { Write-Host "STOP: $flag has duplicate values." -ForegroundColor Red; $bad = $true; continue }
  if ($matches.Count -eq 1 -and ((($matches[0] -split '=',2)[1]).Trim().Trim('"').Trim("'")) -eq 'true') {
    Write-Host "STOP: $flag must not be true." -ForegroundColor Red; $bad = $true
  } else { Write-Host "PASS: $flag not enabled." -ForegroundColor Green }
}
$url = @($lines | Where-Object { $_ -match '^\s*NEXT_PUBLIC_SUPABASE_URL\s*=' })
if ($url.Count -ne 1 -or ((($url[0] -split '=',2)[1]).Trim().Trim('"').Trim("'")) -notmatch '^http://(localhost|127\.0\.0\.1):54421/?$') {
  Write-Host 'STOP: NEXT_PUBLIC_SUPABASE_URL must point to local port 54421.' -ForegroundColor Red; $bad = $true
} else { Write-Host 'PASS: local Supabase URL.' -ForegroundColor Green }
Write-Host 'No network calls. No secrets shown. No files or payment records changed.'
if ($bad) { exit 1 }
Write-Host 'PASS: B4.2.7 local read-only preflight.' -ForegroundColor Green
