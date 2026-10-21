# B4.2.6 build-only hotfix: no database, network or payment operations.
param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Read-File([string]$Path) { [System.IO.File]::ReadAllText($Path) }
function Save-File([string]$Path, [string]$Value) {
  [System.IO.File]::WriteAllText($Path, $Value, [System.Text.UTF8Encoding]::new($false))
}
function Assert-One([string]$Content, [string]$Find, [string]$Label) {
  $first = $Content.IndexOf($Find, [StringComparison]::Ordinal)
  if ($first -lt 0 -or $Content.IndexOf($Find, $first + $Find.Length, [StringComparison]::Ordinal) -ge 0) {
    throw "Expected exactly one $Label; no files were changed."
  }
}

$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
$paths = @{
  config = (Join-Path $root 'tsconfig.json')
  timeline = (Join-Path $root 'app\owner\payment-activity\page.tsx')
  review = (Join-Path $root 'app\owner\reconciliation\page.tsx')
}
foreach ($entry in $paths.GetEnumerator()) {
  if (-not (Test-Path -LiteralPath $entry.Value -PathType Leaf)) { throw "Missing $($entry.Key): $($entry.Value)" }
}

$original = @{}
foreach ($key in @('config','timeline','review')) { $original[$key] = Read-File $paths[$key] }
$updated = @{}
foreach ($key in @('config','timeline','review')) { $updated[$key] = $original[$key] }

# Fix literal apostrophe in JSX text; do not modify JavaScript strings.
if ($updated.timeline.Contains("listener's")) {
  Assert-One $updated.timeline "listener's" 'JSX listener apostrophe'
  $updated.timeline = $updated.timeline.Replace("listener's", 'listener&apos;s')
} elseif (-not $updated.timeline.Contains('listener&apos;s')) {
  throw 'Unexpected Payment Activity JSX: listener wording differs. No files changed.'
}

# Remove the unused import only; preserve other icons.
if ($updated.review.Contains('Clock3, ')) {
  Assert-One $updated.review 'Clock3, ' 'unused Clock3 import'
  $updated.review = $updated.review.Replace('Clock3, ', '')
} elseif ($updated.review -match '\bClock3\b') {
  throw 'Clock3 import format differs; inspect before changing. No files changed.'
}

# Prevent historical backup TSX files from entering the app-wide TypeScript scan.
$excludeMatches = [regex]::Matches($updated.config, '"exclude"\s*:\s*\[(?<items>[^\]]*)\]', [System.Text.RegularExpressions.RegexOptions]::Singleline)
if ($excludeMatches.Count -ne 1) { throw 'Expected one tsconfig exclude array. Please inspect tsconfig.json; no files changed.' }
$items = $excludeMatches[0].Groups['items']
if ($items.Value -notmatch '"backups"') {
  $before = $items.Value.TrimEnd()
  $afterWhitespace = $items.Value.Substring($before.Length)
  if ($before.Trim().Length -eq 0) { $replacement = '"backups"' + $afterWhitespace }
  elseif ($before.EndsWith(',')) { $replacement = $before + ' "backups"' + $afterWhitespace }
  else { $replacement = $before + ', "backups"' + $afterWhitespace }
  $updated.config = $updated.config.Substring(0, $items.Index) + $replacement + $updated.config.Substring($items.Index + $items.Length)
}

# Preflight validity with installed TypeScript before writing a backup.
$tempConfig = Join-Path $root 'tsconfig.b426-check.tmp.json'
try {
  Save-File $tempConfig $updated.config
  $env:B426_CONFIG_TO_CHECK = $tempConfig
  Push-Location $root
  try {
    & node -e "const ts=require('typescript'); const r=ts.readConfigFile(process.env.B426_CONFIG_TO_CHECK, ts.sys.readFile); if(r.error){ console.error(ts.flattenDiagnosticMessageText(r.error.messageText,' ')); process.exit(1); }"
    if ($LASTEXITCODE -ne 0) { throw 'Updated tsconfig could not be parsed; no project files changed.' }
  } finally { Pop-Location; Remove-Item Env:B426_CONFIG_TO_CHECK -ErrorAction SilentlyContinue }
} finally { Remove-Item -LiteralPath $tempConfig -Force -ErrorAction SilentlyContinue }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $root "backups\b426-build-fix-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
foreach ($key in @('config','timeline','review')) {
  Copy-Item -LiteralPath $paths[$key] -Destination (Join-Path $backupDir "$key.original") -ErrorAction Stop
}

try {
  foreach ($key in @('config','timeline','review')) {
    if ($updated[$key] -cne $original[$key]) { Save-File $paths[$key] $updated[$key] }
  }
} catch {
  foreach ($key in @('config','timeline','review')) {
    Copy-Item -LiteralPath (Join-Path $backupDir "$key.original") -Destination $paths[$key] -Force
  }
  throw
}
Write-Host 'PASS: B4.2.6 build hotfix applied. Previous files backed up.' -ForegroundColor Green
Write-Host "Backup: $backupDir"
Write-Host 'NEXT: npx tsc --noEmit ; npm run build (while Next.js is stopped).'
