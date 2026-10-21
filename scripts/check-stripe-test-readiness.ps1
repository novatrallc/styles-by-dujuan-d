# Run from project root. Never prints secrets or starts a payment.
$ErrorActionPreference = 'Stop'
Write-Host 'Dujuan | Stripe test readiness (read-only)' -ForegroundColor Yellow
if (-not (Test-Path '.env.local')) { throw 'Missing .env.local' }
$lines = Get-Content '.env.local'
function ValueOf($name) {
  $line = $lines | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -Last 1
  if (-not $line) { return '' }
  return (($line -split '=',2)[1]).Trim().Trim('"').Trim("'")
}
$key = ValueOf 'STRIPE_SECRET_KEY'
$webhook = ValueOf 'STRIPE_WEBHOOK_SECRET'
$checkout = ValueOf 'ENABLE_STRIPE_CHECKOUT'
$delivery = ValueOf 'ENABLE_NOTIFICATION_DELIVERY'
Write-Host ('Stripe test secret key: ' + $(if ($key.StartsWith('sk_test_')) {'PASS'} else {'MISSING / NOT TEST MODE'}))
Write-Host ('Webhook signing secret: ' + $(if ($webhook.StartsWith('whsec_')) {'PRESENT'} else {'MISSING'}))
Write-Host ('Public checkout: ' + $(if ($checkout -eq 'false') {'DISABLED (safe)'} else {'CHECK MANUALLY'}))
Write-Host ('Live email delivery: ' + $(if ($delivery -eq 'false') {'DISABLED (safe)'} else {'CHECK MANUALLY'}))
Write-Host 'No network calls or payment operations performed.'
