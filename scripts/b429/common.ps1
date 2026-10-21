Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:B429ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))

function Get-DujuanRoot {
  return $script:B429ProjectRoot
}
function Get-DujuanProcesses {
  $root = Get-DujuanRoot
  @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
    $_.CommandLine -and
    $_.CommandLine.IndexOf($root, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
    ($_.CommandLine -match '(?i)(next[\\/]dist[\\/]|[\\/]next[\\/]dist[\\/]|next[\\/]dist[\\/]bin[\\/]next|start-server\.js)')
  })
}
function Get-ListeningOwner([int]$Port) {
  @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
}
function Assert-ClearForNext([int]$Port) {
  $procs = @(Get-DujuanProcesses)
  if ($procs.Count -gt 0) {
    $details = ($procs | ForEach-Object { $_.ProcessId }) -join ', '
    throw "STOP: Found existing Dujuan Next.js process(es): $details. Close their terminal(s), or use stop-next.ps1. No additional server started."
  }
  $owners = @(Get-ListeningOwner -Port $Port)
  if ($owners.Count -gt 0) {
    throw "STOP: Port $Port is occupied by PID(s): $($owners -join ', '). This script never kills an unknown process."
  }
}
function Assert-ConfigSeparation {
  $root = Get-DujuanRoot
  $configs = @(@('next.config.ts','next.config.js','next.config.mjs') | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path -LiteralPath $_ })
  if (@($configs).Count -ne 1) { throw 'STOP: Expected exactly one next.config.ts/js/mjs file. Follow NEXT_CONFIG_PATCH.md first.' }
  $source = [System.IO.File]::ReadAllText($configs[0])
  if ($source -notmatch 'distDir\s*:\s*process\.env\.DUJUAN_BUILD_TARGET' -or $source -notmatch '\.next-dev') {
    throw 'STOP: Next.js build directory separation has not been installed. See NEXT_CONFIG_PATCH.md. No server/build started.'
  }
}
function Assert-LocalSafety([bool]$AllowOwnerCheckout = $false) {
  $path = Join-Path (Get-DujuanRoot) '.env.local'
  if (-not (Test-Path -LiteralPath $path)) { throw 'STOP: .env.local not found.' }
  $vars = @{}
  foreach ($line in [System.IO.File]::ReadAllLines($path)) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
      $val = $matches[2].Trim()
      if ($val.Length -ge 2 -and (($val[0] -eq '"' -and $val[-1] -eq '"') -or ($val[0] -eq "'" -and $val[-1] -eq "'"))) {
        $val = $val.Substring(1,$val.Length-2)
      }
      $vars[$matches[1]] = $val
    }
  }
  if ($vars['NEXT_PUBLIC_SUPABASE_URL'] -ne 'http://127.0.0.1:54421') { throw 'STOP: Expected LOCAL Supabase at http://127.0.0.1:54421.' }
  if ($vars['APP_ORIGIN'] -ne 'http://localhost:3000') { throw 'STOP: Expected local APP_ORIGIN http://localhost:3000.' }
  if ($vars['ENABLE_STRIPE_CHECKOUT'] -ne 'false') { throw 'STOP: Public checkout must be false.' }
  if ($vars['ENABLE_NOTIFICATION_DELIVERY'] -ne 'false') { throw 'STOP: Outbound notification delivery must be false.' }
  if (-not $AllowOwnerCheckout -and $vars['ENABLE_OWNER_STRIPE_TEST_CHECKOUT'] -ne 'false') { throw 'STOP: Owner sandbox checkout must be false. No server started.' }
  if ($vars['STRIPE_SECRET_KEY'] -notlike 'sk_test_*') { throw 'STOP: Local Stripe key must begin sk_test_.' }
  Write-Host 'Local checkout/notification safety checks passed. Secrets were not printed.' -ForegroundColor Green
}
function Assert-BuiltAssets([string]$TargetDir = '.next') {
  $path = Join-Path (Get-DujuanRoot) $TargetDir
  if (-not (Test-Path (Join-Path $path 'BUILD_ID'))) { throw "STOP: No completed production build at $TargetDir. Run build-production.ps1 first." }
  $static = Join-Path $path 'static'
  if (-not (Test-Path $static)) { throw "STOP: Missing $TargetDir/static." }
  $css = @(Get-ChildItem -Path $static -Filter '*.css' -Recurse -File -ErrorAction SilentlyContinue)
  $js = @(Get-ChildItem -Path $static -Filter '*.js' -Recurse -File -ErrorAction SilentlyContinue)
  if ($css.Count -lt 1 -or $js.Count -lt 1) { throw "STOP: Incomplete static assets (CSS=$($css.Count), JS=$($js.Count)). Refusing to start." }
  Write-Host "Build assets OK: $($css.Count) CSS, $($js.Count) JS files." -ForegroundColor Green
}
function Invoke-CheckedNative([string]$Executable, [string[]]$Arguments) {
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Executable $($Arguments -join ' ') failed with exit code $LASTEXITCODE." }
}
