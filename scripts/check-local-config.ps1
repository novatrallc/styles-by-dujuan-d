# Read-only guard: never prints secret values.
$ErrorActionPreference = 'Stop'
$envPath = Join-Path (Get-Location) '.env.local'
if (-not (Test-Path $envPath)) { throw '.env.local not found. Run from project root.' }
$values = @{}
Get-Content $envPath | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
    $values[$matches[1]] = $matches[2].Trim('"', "'")
  }
}
$expected = 'http://127.0.0.1:54421'
if ($values['NEXT_PUBLIC_SUPABASE_URL'] -ne $expected) { throw 'STOP: Supabase URL is not the expected local API.' }
if ($values['APP_ORIGIN'] -notin @('http://localhost:3000','http://127.0.0.1:3000')) { throw 'STOP: APP_ORIGIN is not localhost.' }
if ($values['STRIPE_SECRET_KEY'] -notmatch '^sk_test_') { throw 'STOP: Stripe key is not test mode.' }
if ($values['ENABLE_STRIPE_CHECKOUT'] -ne 'false') { throw 'STOP: public checkout must remain disabled.' }
if ($values['ENABLE_NOTIFICATION_DELIVERY'] -ne 'false') { throw 'STOP: live notifications must remain disabled.' }
if (-not $values['NEXT_PUBLIC_SUPABASE_ANON_KEY'] -and -not $values['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) { throw 'STOP: local public key missing.' }
if (-not $values['SUPABASE_SERVICE_ROLE_KEY']) { throw 'STOP: local service role key missing.' }
Write-Host 'PASS: local URL, localhost origin, test Stripe mode, public checkout disabled, notification delivery disabled, and Supabase key fields present.' -ForegroundColor Green
Write-Host 'NOTE: This does not cryptographically verify key-to-project matching; copy all local keys from the same supabase status output.'
