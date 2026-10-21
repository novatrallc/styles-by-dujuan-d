[CmdletBinding(SupportsShouldProcess=$true, ConfirmImpact='High')]
param()
. (Join-Path $PSScriptRoot 'common.ps1')
$procs = @(Get-DujuanProcesses)
if ($procs.Count -eq 0) { Write-Host 'No matching Dujuan Next.js processes. Nothing to stop.'; return }
Write-Host 'These project-owned Next.js processes are eligible for stopping:' -ForegroundColor Yellow
$procs | Select-Object ProcessId, Name, CommandLine | Format-List
foreach ($proc in $procs) {
  $pidToStop = [int]$proc.ProcessId
  # Recheck PID identity to minimize PID-reuse race before force-stopping.
  $current = Get-CimInstance Win32_Process -Filter "ProcessId=$pidToStop" -ErrorAction SilentlyContinue
  $root = Get-DujuanRoot
  if ($null -eq $current -or -not $current.CommandLine -or $current.CommandLine.IndexOf($root,[StringComparison]::OrdinalIgnoreCase) -lt 0 -or $current.CommandLine -notmatch '(?i)(next[\\/]dist[\\/]|start-server\.js)') { continue }
  if ($PSCmdlet.ShouldProcess("Dujuan Next.js process PID=$pidToStop",'Stop process')) {
    Stop-Process -Id $pidToStop -Force -ErrorAction Stop
    Write-Host "Stopped PID $pidToStop"
  }
}
Write-Host 'Other project tasks, Docker, Supabase, and Stripe CLI were not targeted.'
