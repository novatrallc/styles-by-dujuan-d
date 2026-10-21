# B4.2.1a — branded service confirmation modal, no DB or API changes.
param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-ExactlyOnce([string]$Value, [string]$Needle, [string]$Description) {
  $pos = $Value.IndexOf($Needle, [StringComparison]::Ordinal)
  if ($pos -lt 0 -or $Value.IndexOf($Needle, $pos + $Needle.Length, [StringComparison]::Ordinal) -ge 0) {
    throw "Expected exactly one $Description. No files changed. Share the installer error for a safe repair."
  }
}

$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
$dashboard = Join-Path $root 'app\owner\owner-dashboard.tsx'
$modal = Join-Path $root 'app\owner\service-action-dialog.tsx'
$modalSource = Join-Path $PSScriptRoot 'app\owner\service-action-dialog.tsx'
if (-not (Test-Path -LiteralPath $dashboard)) { throw "Dashboard not found: $dashboard" }
if (-not (Test-Path -LiteralPath $modalSource)) { throw 'Modal source missing from package.' }
$original = [IO.File]::ReadAllText($dashboard)
$hasUi = $original.Contains('import { ServiceActionDialog } from ''./service-action-dialog'';')
$hasModal = Test-Path -LiteralPath $modal
if ($hasModal) {
  $actualHash = (Get-FileHash -LiteralPath $modal -Algorithm SHA256).Hash
  $expectedHash = (Get-FileHash -LiteralPath $modalSource -Algorithm SHA256).Hash
  if ($actualHash -ne $expectedHash) { throw 'An existing service-action-dialog.tsx differs from this package. No files changed.' }
}
if ($hasUi -and $hasModal) { Write-Host 'PASS: premium service action dialog already installed.' -ForegroundColor Green; exit 0 }
if ($hasUi -and -not $hasModal) { throw 'Dashboard already imports the dialog, but the dialog file is missing. Stop for review.' }

$nl = "`n"
$old = $original.Replace("`r`n", $nl)
$importAnchor = "import { createClient } from '@supabase/supabase-js';"
$stateAnchor = ' const [showAddService,setShowAddService]=useState(false);'
$oldButtonAction = 'onRemove={operation=>void removeService(s,operation)}'
$dialogAnchor = ' {authDialog&&'
$confirmationStart = "  const prompt=operation==='deactivate'"
$confirmationEnd = "  if(!window.confirm(prompt))return;`n"
foreach ($check in @(
  @{v=$importAnchor;desc='Supabase import'},
  @{v=$stateAnchor;desc='Add Service state'},
  @{v=$oldButtonAction;desc='Service removal action'},
  @{v=$dialogAnchor;desc='owner confirmation insertion point'},
  @{v=$confirmationStart;desc='native service confirmation start'},
  @{v=$confirmationEnd;desc='native service confirmation end'}
)) { Assert-ExactlyOnce $old $check.v $check.desc }
if (-not $old.Contains("async function removeService(service:Service, operation:'deactivate'|'delete')")) {
  throw 'B4.2.1 removal handler not found. No files changed.'
}
$startPos = $old.IndexOf($confirmationStart, [StringComparison]::Ordinal)
$endPos = $old.IndexOf($confirmationEnd, $startPos, [StringComparison]::Ordinal)
if ($endPos -lt 0 -or $endPos - $startPos -gt 800) { throw 'Native confirmation block did not match expected layout. No files changed.' }
$old = $old.Remove($startPos, $endPos + $confirmationEnd.Length - $startPos)
$old = $old.Replace($importAnchor, $importAnchor + $nl + "import { ServiceActionDialog } from './service-action-dialog';")
$old = $old.Replace($stateAnchor, $stateAnchor + $nl + " const [serviceAction,setServiceAction]=useState<{service:Service;operation:'deactivate'|'delete'}|null>(null);")
$old = $old.Replace($oldButtonAction, 'onRemove={operation=>setServiceAction({service:s,operation})}')
$dialogMarkup = ' {serviceAction&&<ServiceActionDialog serviceName={serviceAction.service.name} operation={serviceAction.operation} onCancel={()=>setServiceAction(null)} onConfirm={()=>{const selected=serviceAction;setServiceAction(null);void removeService(selected.service,selected.operation);}}/>}'
$old = $old.Replace($dialogAnchor, $dialogMarkup + $nl + $dialogAnchor)
if (-not $old.Contains($dialogMarkup) -or $old.Contains('window.confirm(prompt)')) { throw 'UI validation failed. No files changed.' }
$updated = if ($original.Contains("`r`n")) { $old.Replace("`n", "`r`n") } else { $old }

$backup = Join-Path $root ('backups\b421a-modal-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item -LiteralPath $dashboard -Destination (Join-Path $backup 'owner-dashboard.tsx') -ErrorAction Stop
$created = $false
try {
  if (-not $hasModal) {
    Copy-Item -LiteralPath $modalSource -Destination $modal -ErrorAction Stop
    $created = $true
  }
  [IO.File]::WriteAllText($dashboard, $updated, [Text.UTF8Encoding]::new($false))
} catch {
  Copy-Item -LiteralPath (Join-Path $backup 'owner-dashboard.tsx') -Destination $dashboard -Force
  if ($created -and (Test-Path -LiteralPath $modal)) { Remove-Item -LiteralPath $modal -Force }
  throw
}
Write-Host 'PASS: B4.2.1a premium service confirmation modal installed.' -ForegroundColor Green
Write-Host "Backup: $backup"
Write-Host 'Unaffected: Stripe, Supabase, migrations, existing service data, and booking rules.'
Write-Host 'Next: npx tsc --noEmit; npm run build; npm run dev' -ForegroundColor Cyan
