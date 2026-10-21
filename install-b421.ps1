# B4.2.1 - Safe Service Lifecycle: deactivate + guarded local-only permanent deletion.
# Execute from the EXTRACTED package directory. Does not modify database schema.
param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Once([string]$Text, [string]$Needle, [string]$Label) {
  $first = $Text.IndexOf($Needle, [System.StringComparison]::Ordinal)
  if ($first -lt 0 -or $Text.IndexOf($Needle, $first + $Needle.Length, [System.StringComparison]::Ordinal) -ge 0) {
    throw "Expected exactly one occurrence of $Label. Nothing changed. Send this error for review."
  }
}

$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
$dashboard = Join-Path $root 'app\owner\owner-dashboard.tsx'
$newRoute = Join-Path $root 'app\api\owner\services\remove\route.ts'
$sourceRoute = Join-Path $PSScriptRoot 'app\api\owner\services\remove\route.ts'
$patchDir = Join-Path $PSScriptRoot 'patches'
if (-not (Test-Path -LiteralPath $dashboard)) { throw "Missing dashboard: $dashboard" }
if (-not (Test-Path -LiteralPath $sourceRoute)) { throw 'Missing service removal API in package.' }
foreach($name in @('owner-remove-service-function.txt','owner-service-action-buttons.txt')) {
  if (-not (Test-Path -LiteralPath (Join-Path $patchDir $name))) { throw "Missing patch file: $name" }
}

$original = [System.IO.File]::ReadAllText($dashboard)
$hasUi = $original.Contains("async function removeService(")
$hasRoute = Test-Path -LiteralPath $newRoute
if ($hasRoute) {
  $existingHash = (Get-FileHash -LiteralPath $newRoute -Algorithm SHA256).Hash
  $expectedHash = (Get-FileHash -LiteralPath $sourceRoute -Algorithm SHA256).Hash
  if ($existingHash -ne $expectedHash) {
    throw 'Existing service removal API differs from this package. No files changed.'
  }
}
if ($hasUi -and $hasRoute) {
  Write-Host 'PASS: B4.2.1 is already installed; nothing to change.' -ForegroundColor Green
  exit 0
}
if ($hasUi -and -not $hasRoute) {
  throw 'Dashboard includes B4.2.1 but API route is missing. Stop for review; no files changed.'
}

# Require the B4.2.0 repair before applying this upgrade.
if (-not $original.Contains('function NewServiceForm(') -or -not $original.Contains('Add new service')) {
  throw 'B4.2.0 Services UI not detected; nothing changed.'
}

$mapOld = '{data.services.map(s=><ServiceEditor key={s.id} service={s} disabled={loading} save={v=>send(''service'',v)}/>)}'
$mapNew = '{data.services.map(s=><ServiceEditor key={`${s.id}:${s.is_active}`} service={s} disabled={loading} save={v=>send(''service'',v)} onRemove={operation=>void removeService(s,operation)}/>)}'
$componentOld = 'function ServiceEditor({service,save,disabled}:{service:Service;save:(v:Record<string,unknown>)=>void;disabled:boolean}){'
$componentNew = 'function ServiceEditor({service,save,disabled,onRemove}:{service:Service;save:(v:Record<string,unknown>)=>void;disabled:boolean;onRemove:(operation:''deactivate''|''delete'')=>void}){'
$oldButton = '<button type="submit" className="button-gold" style={{justifySelf:''start'',alignSelf:''end'',width:''auto'',minWidth:0,padding:''10px 20px'',fontSize:13,borderRadius:999}} disabled={disabled}>Save changes</button>'
$functionAnchor = ' async function changeAppointment('
foreach ($expect in @(
 @{v=$mapOld;label='Services editor list'},
 @{v=$componentOld;label='ServiceEditor function signature'},
 @{v=$oldButton;label='compact Save changes button'},
 @{v=$functionAnchor;label='owner action insertion point'}
)) { Require-Once $original $expect.v $expect.label }

$action = [System.IO.File]::ReadAllText((Join-Path $patchDir 'owner-remove-service-function.txt')).TrimEnd()
$buttons = [System.IO.File]::ReadAllText((Join-Path $patchDir 'owner-service-action-buttons.txt')).TrimEnd()
$updated = $original.Replace($mapOld, $mapNew)
$updated = $updated.Replace($componentOld, $componentNew)
$updated = $updated.Replace($oldButton, $buttons)
$updated = $updated.Replace($functionAnchor, $action + "`r`n" + $functionAnchor)
if (-not $updated.Contains("async function removeService(") -or -not $updated.Contains('Delete permanently')) {
  throw 'Post-patch validation failed. Nothing changed.'
}

# Re-entrant when the API file exists but UI did not install.
$backup = Join-Path $root ('backups\b421-services-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Copy-Item -LiteralPath $dashboard -Destination (Join-Path $backup 'owner-dashboard.tsx') -ErrorAction Stop
if ($hasRoute) { Copy-Item -LiteralPath $newRoute -Destination (Join-Path $backup 'remove-route.ts') -ErrorAction Stop }
$routeCreated = $false
try {
  if (-not $hasRoute) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $newRoute) | Out-Null
    Copy-Item -LiteralPath $sourceRoute -Destination $newRoute -ErrorAction Stop
    $routeCreated = $true
  }
  [System.IO.File]::WriteAllText($dashboard, $updated, [System.Text.UTF8Encoding]::new($false))
} catch {
  Copy-Item -LiteralPath (Join-Path $backup 'owner-dashboard.tsx') -Destination $dashboard -Force
  if ($routeCreated -and (Test-Path -LiteralPath $newRoute)) { Remove-Item -LiteralPath $newRoute -Force }
  throw
}
Write-Host 'PASS: B4.2.1 installed - Deactivate + guarded Delete permanently.' -ForegroundColor Green
Write-Host "Backup: $backup"
Write-Host 'No Supabase migrations, Stripe settings, or booking configuration were changed.'
Write-Host 'NEXT: stop dev server; npx tsc --noEmit; npm run build; npm run dev' -ForegroundColor Cyan
