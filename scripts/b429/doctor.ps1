[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'common.ps1')
$root = Get-DujuanRoot
Write-Host ("Dujuan B4.2.9 Doctor - " + $root) -ForegroundColor Cyan
Write-Host 'Read-only diagnostics; no processes or files changed.'
$procs = @(Get-DujuanProcesses)
if ($procs.Count -eq 0) { Write-Host 'Next.js project processes: none' -ForegroundColor Green }
else { $procs | Select-Object ProcessId, Name, CommandLine | Format-List }
foreach ($port in @(3000,3001)) {
  $owners = @(Get-ListeningOwner -Port $port)
  Write-Host "Port $port : $(if ($owners.Count -eq 0) { 'free' } else { 'PID(s) ' + ($owners -join ', ') })"
}
try { Assert-ConfigSeparation; Write-Host 'Build output isolation: configured' -ForegroundColor Green }
catch { Write-Warning $_.Exception.Message }
foreach ($target in @('.next','.next-dev')) {
  $dir = Join-Path $root $target
  if (-not (Test-Path -LiteralPath $dir)) { Write-Host "$target : absent"; continue }
  $css = @(Get-ChildItem $dir -Recurse -File -Filter '*.css' -ErrorAction SilentlyContinue).Count
  $js  = @(Get-ChildItem $dir -Recurse -File -Filter '*.js' -ErrorAction SilentlyContinue).Count
  Write-Host "$target : CSS=$css JS=$js BUILD_ID=$(Test-Path (Join-Path $dir 'BUILD_ID'))"
}
try { Assert-LocalSafety; Write-Host 'Local payment safety: checked' -ForegroundColor Green }
catch { Write-Warning $_.Exception.Message }
Write-Host 'End of read-only report.'
