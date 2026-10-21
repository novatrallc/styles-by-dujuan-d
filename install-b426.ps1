# B4.2.6 — local-only read-only payment timeline and B4.2.5 filter polish.
# Extract package. STOP Next.js before executing. Never operates on SQL or Stripe.
param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-File([string]$Path, [string]$Description) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing $Description at $Path" }
}
function Same-File([string]$Left, [string]$Right) {
  (Get-FileHash -LiteralPath $Left -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $Right -Algorithm SHA256).Hash
}
function Exactly-One([string]$Text, [string]$Needle, [string]$Context) {
  $first = $Text.IndexOf($Needle, [StringComparison]::Ordinal)
  if ($first -lt 0 -or $Text.IndexOf($Needle, $first + $Needle.Length, [StringComparison]::Ordinal) -ge 0) {
    throw "Missing or repeated '$Context' patch anchor. No changes made."
  }
}
function Text-Of([string]$Path) { [IO.File]::ReadAllText($Path).Replace("`r`n", "`n") }
function Write-Text([string]$Path, [string]$Body, [bool]$CRLF) {
  $result = if ($CRLF) { $Body.Replace("`n", "`r`n") } else { $Body }
  [IO.File]::WriteAllText($Path, $result, [Text.UTF8Encoding]::new($false))
}
if (-not (Test-Path -LiteralPath $ProjectRoot -PathType Container)) { throw "Missing project folder: $ProjectRoot" }
$projectFolder = (Resolve-Path -LiteralPath $ProjectRoot).Path
$dashboardPath = Join-Path $projectFolder 'app\owner\owner-dashboard.tsx'
$reviewPath = Join-Path $projectFolder 'app\owner\reconciliation\page.tsx'
Require-File $dashboardPath 'owner dashboard'
Require-File $reviewPath 'B4.2.5 review page'
Require-File (Join-Path $projectFolder 'lib\owner-auth.ts') 'owner auth'
Require-File (Join-Path $projectFolder 'app\api\stripe\webhook\route.ts') 'existing webhook'

$newRoutes = @(
  'app\api\owner\payment-activity\route.ts',
  'app\api\owner\payment-activity\stripe\route.ts',
  'app\owner\payment-activity\page.tsx'
)
$needsCopy = @()
foreach ($relative in $newRoutes) {
  $sourcePath = Join-Path $PSScriptRoot $relative
  $destinationPath = Join-Path $projectFolder $relative
  Require-File $sourcePath "package asset $relative"
  if (Test-Path -LiteralPath $destinationPath -PathType Leaf) {
    if (-not (Same-File $sourcePath $destinationPath)) {
      throw "An existing B4.2.6 path has different content: $destinationPath. No changes made."
    }
  } else { $needsCopy += @{ source=$sourcePath; destination=$destinationPath } }
}

$reviewOriginal = [IO.File]::ReadAllText($reviewPath)
$dashboardOriginal = [IO.File]::ReadAllText($dashboardPath)
$reviewText = Text-Of $reviewPath
$dashboardText = Text-Of $dashboardPath
$reviewLink = '/owner/payment-activity'
$beforeSelection = "  const selected = items.find(i=>i.id===selectedId) ?? null;`n  const filtered = items.filter(i=>filter==='all'||i.status===filter);"
$afterSelection = "  const filtered = items.filter(i=>filter==='all'||i.status===filter);`n  const selected = filtered.find(i=>i.id===selectedId) ?? filtered[0] ?? null;"
if ($reviewText.Contains($beforeSelection)) {
  Exactly-One $reviewText $beforeSelection 'B4.2.5 review selection'
  $reviewText = $reviewText.Replace($beforeSelection, $afterSelection)
} elseif (-not $reviewText.Contains($afterSelection)) {
  throw 'B4.2.5 review selection differs from the expected build. No changes made.'
}
# Keep queue highlights in sync with the visible, filter-scoped detail record.
$reviewText = $reviewText.Replace('aria-pressed={selectedId===item.id}', 'aria-pressed={selected?.id===item.id}')
$reviewText = $reviewText.Replace('${selectedId===item.id?', '${selected?.id===item.id?')
if (-not $reviewText.Contains('aria-pressed={selected?.id===item.id}')) {
  throw 'Unable to verify the filter-highlight update. No changes made.'
}
if (-not $reviewText.Contains($reviewLink)) {
  $headingAnchor = '    <div className="mt-8 flex flex-wrap items-start justify-between gap-5">'
  Exactly-One $reviewText $headingAnchor 'review heading'
  $linkMarkup = '    <div className="mt-4"><Link href="/owner/payment-activity" className="inline-flex items-center gap-2 text-sm text-[#eac98f] hover:underline"><History size={16}/> Payment activity timeline</Link></div>'
  $reviewText = $reviewText.Replace($headingAnchor, "$linkMarkup`n$headingAnchor")
}

if (-not $dashboardText.Contains($reviewLink)) {
  $linksAnchor = 'const operationsLinks: OperationsLink[] = ['
  Exactly-One $dashboardText $linksAnchor 'owner operations links'
  if (-not $dashboardText.Contains('ShieldCheck')) {
    throw 'Dashboard ShieldCheck icon missing; cannot add link safely. No changes made.'
  }
  $dashboardRow = "  {href:'/owner/payment-activity',title:'Payment Activity Timeline',description:'Inspect local test payment milestones and verify a linked Stripe session on demand.',Icon:ShieldCheck,tag:'PAYMENT ACTIVITY'},"
  $dashboardText = $dashboardText.Replace($linksAnchor, "$linksAnchor`n$dashboardRow")
}

$reviewNeedsWrite = $reviewText -cne $reviewOriginal.Replace("`r`n", "`n")
$dashboardNeedsWrite = $dashboardText -cne $dashboardOriginal.Replace("`r`n", "`n")
if ($needsCopy.Count -eq 0 -and -not $reviewNeedsWrite -and -not $dashboardNeedsWrite) {
  Write-Host 'PASS: B4.2.6 already installed; no changes.' -ForegroundColor Green
  exit 0
}

$backupFolder = Join-Path $projectFolder ('backups\b426-payment-activity-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
Copy-Item -LiteralPath $reviewPath -Destination (Join-Path $backupFolder 'reconciliation-page.tsx') -ErrorAction Stop
Copy-Item -LiteralPath $dashboardPath -Destination (Join-Path $backupFolder 'owner-dashboard.tsx') -ErrorAction Stop
$createdFiles = New-Object System.Collections.Generic.List[string]
try {
  foreach ($item in $needsCopy) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $item.destination) -Force | Out-Null
    Copy-Item -LiteralPath $item.source -Destination $item.destination -ErrorAction Stop
    $createdFiles.Add($item.destination)
    if (-not (Same-File $item.source $item.destination)) { throw "Copy verification failed: $($item.destination)" }
  }
  if ($reviewNeedsWrite) {
    Write-Text $reviewPath $reviewText ($reviewOriginal.Contains("`r`n"))
  }
  if ($dashboardNeedsWrite) {
    Write-Text $dashboardPath $dashboardText ($dashboardOriginal.Contains("`r`n"))
  }
  if (-not ((Text-Of $reviewPath).Contains($reviewLink) -and (Text-Of $dashboardPath).Contains($reviewLink))) {
    throw 'Post-install link verification failed.'
  }
} catch {
  Copy-Item -LiteralPath (Join-Path $backupFolder 'reconciliation-page.tsx') -Destination $reviewPath -Force
  Copy-Item -LiteralPath (Join-Path $backupFolder 'owner-dashboard.tsx') -Destination $dashboardPath -Force
  foreach ($created in $createdFiles) { Remove-Item -LiteralPath $created -Force -ErrorAction SilentlyContinue }
  throw
}
Write-Host 'PASS: B4.2.6 Payment Activity Timeline installed.' -ForegroundColor Green
Write-Host "Backup: $backupFolder"
Write-Host 'No database migrations, payment actions, webhook changes or environment flags were performed.'
Write-Host 'Next: .\verify-b426.ps1; npx tsc --noEmit; npm run build (with server stopped).' -ForegroundColor Cyan
