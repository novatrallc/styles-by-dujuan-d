# B4.2.0 partial-install repair: dashboard UI + optional missing owner service API
# Run from the extracted ZIP folder. Never touches databases, migrations, or env.
param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Once([string]$Text, [string]$Needle, [string]$Description) {
  $first = $Text.IndexOf($Needle, [System.StringComparison]::Ordinal)
  if ($first -lt 0 -or $Text.IndexOf($Needle, $first + $Needle.Length, [System.StringComparison]::Ordinal) -ge 0) {
    throw "Dashboard structure differs at: $Description. No files changed."
  }
}

$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
$dashboardFile = Join-Path $root 'app\owner\owner-dashboard.tsx'
$routeFile = Join-Path $root 'app\api\owner\services\route.ts'
$sourceRoute = Join-Path $PSScriptRoot 'app\api\owner\services\route.ts'
$patchDir = Join-Path $PSScriptRoot 'patches'
if (-not (Test-Path -LiteralPath $dashboardFile)) { throw "Missing dashboard: $dashboardFile" }
if (-not (Test-Path -LiteralPath $sourceRoute)) { throw 'Repair package is incomplete.' }
foreach ($patchName in @('owner-add-service-function.txt','owner-services-section.txt','owner-new-service-form.txt')) {
  if (-not (Test-Path -LiteralPath (Join-Path $patchDir $patchName))) { throw "Repair package missing $patchName" }
}

# A pre-existing route is expected in a partial installation. Do NOT overwrite an altered route.
$routeExists = Test-Path -LiteralPath $routeFile
if ($routeExists) {
  $installedHash = (Get-FileHash -LiteralPath $routeFile -Algorithm SHA256).Hash
  $packageHash = (Get-FileHash -LiteralPath $sourceRoute -Algorithm SHA256).Hash
  if ($installedHash -ne $packageHash) {
    throw 'Existing owner services API differs from B4.2.0 package. Nothing changed. Send the repair output for review.'
  }
  Write-Host 'Verified existing owner/services API matches B4.2.0; will preserve it.' -ForegroundColor Cyan
}

$original = [System.IO.File]::ReadAllText($dashboardFile)
if ($original.Contains('function NewServiceForm(') -or $original.Contains('/api/owner/services')) {
  throw 'Dashboard already contains some B4.2.0 changes; stop to avoid a double patch. Nothing changed.'
}
$state = " const [statusFilter,setStatusFilter]=useState('all');"
$functionAnchor = ' async function changeAppointment('
$servicesStart = "{tab==='services'&&"
$servicesEnd = "}{tab==='hours'&&"
$oldGrid = "gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))'"
$oldCard = "gap:12,borderTop:'1px solid #4b3c29',paddingTop:18"
$oldButton = '<button className="button-gold" disabled={disabled}>Save service</button>'
foreach ($item in @(
  @{value=$state;label='service toggle state'},
  @{value=$functionAnchor;label='owner functions'},
  @{value=$servicesStart;label='services section'},
  @{value=$servicesEnd;label='hours section'},
  @{value=$oldGrid;label='old editor grid'},
  @{value=$oldCard;label='old editor card'},
  @{value=$oldButton;label='old save button'}
)) { Require-Once $original $item.value $item.label }

# All transformations run in memory BEFORE any files are touched.
$updated = $original.Replace($state, $state + "`r`n const [showAddService,setShowAddService]=useState(false);")
$newFunction = [System.IO.File]::ReadAllText((Join-Path $patchDir 'owner-add-service-function.txt')).TrimEnd()
$updated = $updated.Replace($functionAnchor, $newFunction + "`r`n" + $functionAnchor)
$startIndex = $updated.IndexOf($servicesStart, [System.StringComparison]::Ordinal)
$endIndex = $updated.IndexOf($servicesEnd, $startIndex, [System.StringComparison]::Ordinal)
if ($endIndex -le $startIndex) { throw 'Could not locate service section boundaries. Nothing changed.' }
$oldSection = $updated.Substring($startIndex, $endIndex - $startIndex)
if (-not $oldSection.Contains('Services & pricing') -or -not $oldSection.Contains('ServiceEditor')) {
  throw 'Services markup changed from the expected version. Nothing changed.'
}
$newSection = [System.IO.File]::ReadAllText((Join-Path $patchDir 'owner-services-section.txt')).TrimEnd()
$updated = $updated.Substring(0,$startIndex) + $newSection + "`r`n " + $updated.Substring($endIndex)
$updated = $updated.Replace($oldGrid, "gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))'")
$updated = $updated.Replace($oldCard, "gap:16,border:'1px solid #4b3c29',borderRadius:14,background:'#101012',padding:20")
$newButton = '<button type="submit" className="button-gold" style={{justifySelf:''start'',alignSelf:''end'',width:''auto'',minWidth:0,padding:''10px 20px'',fontSize:13,borderRadius:999}} disabled={disabled}>Save changes</button>'
$updated = $updated.Replace($oldButton, $newButton)
$newForm = [System.IO.File]::ReadAllText((Join-Path $patchDir 'owner-new-service-form.txt')).Trim()
$updated = $updated.TrimEnd() + "`r`n" + $newForm + "`r`n"
if (-not $updated.Contains('function NewServiceForm(') -or -not $updated.Contains('Add new service') -or -not $updated.Contains('Save changes')) {
  throw 'Post-patch validation failed. Nothing changed.'
}

$backupFolder = Join-Path $root ('backups\b420-repair-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $backupFolder | Out-Null
Copy-Item -LiteralPath $dashboardFile -Destination (Join-Path $backupFolder 'owner-dashboard.tsx') -ErrorAction Stop
if ($routeExists) { Copy-Item -LiteralPath $routeFile -Destination (Join-Path $backupFolder 'services-route.ts') -ErrorAction Stop }
$routeWasCreated = $false
try {
  if (-not $routeExists) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $routeFile) | Out-Null
    Copy-Item -LiteralPath $sourceRoute -Destination $routeFile -ErrorAction Stop
    $routeWasCreated = $true
  }
  [System.IO.File]::WriteAllText($dashboardFile, $updated, [System.Text.UTF8Encoding]::new($false))
} catch {
  Copy-Item -LiteralPath (Join-Path $backupFolder 'owner-dashboard.tsx') -Destination $dashboardFile -Force
  if ($routeWasCreated -and (Test-Path -LiteralPath $routeFile)) { Remove-Item -LiteralPath $routeFile -Force }
  throw
}
Write-Host 'PASS: B4.2.0 dashboard repaired (Add new service, compact Save changes, roomier fields).' -ForegroundColor Green
Write-Host 'Owner API route preserved/installed; no DB or checkout settings changed.' -ForegroundColor Green
Write-Host "Backup: $backupFolder"
Write-Host 'Next: cd C:\dev\projects\burtons-barbershop; npx tsc --noEmit; npm run build' -ForegroundColor Cyan
