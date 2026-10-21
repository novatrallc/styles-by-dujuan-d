# B4.2.0 - Owner Service Management polish / create service
# Applies only surgical owner dashboard edits and creates a new owner-authorized API route.
param(
  [string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Once([string]$Text, [string]$Needle, [string]$Description) {
  $first = $Text.IndexOf($Needle, [System.StringComparison]::Ordinal)
  if ($first -lt 0 -or $Text.IndexOf($Needle, $first + $Needle.Length, [System.StringComparison]::Ordinal) -ge 0) {
    throw "Unexpected owner-dashboard structure: $Description. No files were changed."
  }
}

$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
$dashboardFile = Join-Path $root 'app\owner\owner-dashboard.tsx'
$routeFile = Join-Path $root 'app\api\owner\services\route.ts'
$sourceRoute = Join-Path $PSScriptRoot 'app\api\owner\services\route.ts'
$patchDir = Join-Path $PSScriptRoot 'patches'
if (-not (Test-Path -LiteralPath $dashboardFile)) { throw "Owner dashboard not found: $dashboardFile" }
if (-not (Test-Path -LiteralPath $sourceRoute)) { throw 'Installation package is incomplete.' }

$original = [System.IO.File]::ReadAllText($dashboardFile)
if ($original.Contains('/api/owner/services') -or $original.Contains('function NewServiceForm(')) {
  throw 'B4.2.0 service management appears already installed. No files were changed.'
}
if (Test-Path -LiteralPath $routeFile) {
  throw 'An owner services API route already exists. Review before installing; no files were changed.'
}

$state = " const [statusFilter,setStatusFilter]=useState('all');"
$functionAnchor = ' async function changeAppointment('
$servicesStart = "{tab==='services'&&"
$servicesEnd = "}{tab==='hours'&&"
$oldGrid = "gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))'"
$oldCard = "gap:12,borderTop:'1px solid #4b3c29',paddingTop:18"
$oldButton = '<button className="button-gold" disabled={disabled}>Save service</button>'
foreach ($item in @(
  @{ value = $state; label = 'service toggle state location' },
  @{ value = $functionAnchor; label = 'owner functions' },
  @{ value = $servicesStart; label = 'Services tab' },
  @{ value = $servicesEnd; label = 'Working Hours tab' },
  @{ value = $oldGrid; label = 'service editor grid' },
  @{ value = $oldCard; label = 'service editor card' },
  @{ value = $oldButton; label = 'service Save button' }
)) { Require-Once $original $item.value $item.label }

$updated = $original.Replace($state, $state + "`r`n const [showAddService,setShowAddService]=useState(false);")
$newFunction = [System.IO.File]::ReadAllText((Join-Path $patchDir 'owner-add-service-function.txt')).TrimEnd()
$updated = $updated.Replace($functionAnchor, $newFunction + "`r`n" + $functionAnchor)

$startIndex = $updated.IndexOf($servicesStart, [System.StringComparison]::Ordinal)
$endIndex = $updated.IndexOf($servicesEnd, $startIndex, [System.StringComparison]::Ordinal)
if ($endIndex -le $startIndex) { throw 'Services section boundary not found. No files were changed.' }
$oldSection = $updated.Substring($startIndex, $endIndex - $startIndex)
if (-not $oldSection.Contains('Services & pricing') -or -not $oldSection.Contains('ServiceEditor')) {
  throw 'Services tab has changed. Review manually; no files were changed.'
}
$newSection = [System.IO.File]::ReadAllText((Join-Path $patchDir 'owner-services-section.txt')).TrimEnd()
$updated = $updated.Substring(0,$startIndex) + $newSection + "`r`n " + $updated.Substring($endIndex)
$updated = $updated.Replace($oldGrid, "gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,230px),1fr))'")
$updated = $updated.Replace($oldCard, "gap:16,border:'1px solid #4b3c29',borderRadius:14,background:'#101012',padding:20")
$newButton = '<button type="submit" className="button-gold" style={{justifySelf:''start'',alignSelf:''end'',width:''auto'',minWidth:0,padding:''10px 20px'',fontSize:13,borderRadius:999}} disabled={disabled}>Save changes</button>'
$updated = $updated.Replace($oldButton, $newButton)
$newForm = [System.IO.File]::ReadAllText((Join-Path $patchDir 'owner-new-service-form.txt'))
$updated = $updated.TrimEnd() + "`r`n" + $newForm.Trim() + "`r`n"

# Construct every output before mutating the project. Preserve a full local backup.
$backupFolder = Join-Path $root ('backups\b420-services-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $backupFolder | Out-Null
Copy-Item -LiteralPath $dashboardFile -Destination (Join-Path $backupFolder 'owner-dashboard.tsx') -ErrorAction Stop
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $routeFile) | Out-Null
try {
  Copy-Item -LiteralPath $sourceRoute -Destination $routeFile -ErrorAction Stop
  [System.IO.File]::WriteAllText($dashboardFile, $updated, [System.Text.UTF8Encoding]::new($false))
}
catch {
  Copy-Item -LiteralPath (Join-Path $backupFolder 'owner-dashboard.tsx') -Destination $dashboardFile -Force
  if (Test-Path -LiteralPath $routeFile) { Remove-Item -LiteralPath $routeFile -Force }
  throw
}

Write-Host 'B4.2.0 installed: compact Save buttons, roomier editor fields, and Add New Service (draft/inactive).' -ForegroundColor Green
Write-Host "Dashboard backup: $backupFolder"
Write-Host 'Next: npx tsc --noEmit; npm run build (while the dev server is stopped).'
Write-Host 'No database migrations, checkout flags, or customer data were changed.'
