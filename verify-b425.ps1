# Read-only filesystem and environment safety check.
param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
$projectFolder = (Resolve-Path -LiteralPath $ProjectRoot).Path
$readApi = Join-Path $projectFolder 'app\api\owner\reconciliation\route.ts'
$actionApi = Join-Path $projectFolder 'app\api\owner\reconciliation\actions\route.ts'
$ui = Join-Path $projectFolder 'app\owner\reconciliation\page.tsx'
foreach ($path in @($readApi,$actionApi,$ui)) { if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing file: $path" } }
function Ensure([bool]$Condition,[string]$Message) { if (-not $Condition) { throw "FAIL: $Message" } }
$r = [IO.File]::ReadAllText($readApi)
$a = [IO.File]::ReadAllText($actionApi)
$u = [IO.File]::ReadAllText($ui)
Ensure ($r.Contains('authorizeOwner') -and $r.Contains('54421') -and $r.Contains("'GET'") -eq $false) 'Owner local read API checks'
Ensure ($a.Contains('authorizeOwner') -and $a.Contains('54421') -and $a.Contains('record_owner_reconciliation_action')) 'Protected action route checks'
Ensure ($a.Contains("ENABLE_STRIPE_CHECKOUT") -and $a.Contains("ENABLE_OWNER_STRIPE_TEST_CHECKOUT")) 'Both checkout guards'
Ensure ($u.Contains('RESOLVE') -and $u.Contains('audit') -and $u.Contains('No money moves')) 'Resolution UI markers'
$envFile = Join-Path $projectFolder '.env.local'
if (Test-Path -LiteralPath $envFile) {
  $settings = [IO.File]::ReadAllText($envFile)
  foreach ($name in @('ENABLE_STRIPE_CHECKOUT','ENABLE_OWNER_STRIPE_TEST_CHECKOUT','ENABLE_NOTIFICATION_DELIVERY')) {
    Ensure ($settings -match ('(?m)^\s*' + $name + '=false\s*$')) "$name must equal false before recording reconciliation actions"
  }
} else { Write-Host 'WARNING: .env.local missing; app will need configuration.' -ForegroundColor Yellow }
Write-Host 'PASS: B4.2.5 files and disabled checkout switches.' -ForegroundColor Green
Write-Host 'NOTE: This does not verify database migration permissions or automatic Stripe webhook delivery.'
