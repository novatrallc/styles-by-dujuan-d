$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\dev\projects\burtons-barbershop'
$cssPath = Join-Path $projectRoot 'app\globals.css'
$sourcePath = Join-Path $PSScriptRoot 'global-spacing.css'
$startMarker = 'DUJUAN_GLOBAL_SPACING_B419_START'
$endMarker = 'DUJUAN_GLOBAL_SPACING_B419_END'

if (-not (Test-Path -LiteralPath $cssPath -PathType Leaf)) {
  throw "Cannot find $cssPath. No changes were made."
}
if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
  throw "Missing global-spacing.css beside the installer. No changes were made."
}
$current = [System.IO.File]::ReadAllText($cssPath)
if ($current.Contains($startMarker)) {
  Write-Host 'B4.1.9 spacing rules are already installed. Nothing changed.' -ForegroundColor Yellow
  exit 0
}
if (-not $current.Contains('@import "tailwindcss"') -and -not $current.Contains("@import 'tailwindcss'")) {
  Write-Warning 'Tailwind import not found in globals.css. Review the stylesheet before installing.'
  throw 'Unexpected globals.css format. No changes were made.'
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$cssPath.b419-backup-$stamp"
Copy-Item -LiteralPath $cssPath -Destination $backup -ErrorAction Stop
$addition = [System.IO.File]::ReadAllText($sourcePath)
[System.IO.File]::WriteAllText($cssPath, $current.TrimEnd() + [Environment]::NewLine + [Environment]::NewLine + $addition, [System.Text.UTF8Encoding]::new($false))
Write-Host "Installed site-wide B4.1.9 spacing rules into: $cssPath" -ForegroundColor Green
Write-Host "Backup created: $backup" -ForegroundColor Green
Write-Host 'No other files, API routes, environment variables, or databases were changed.'
