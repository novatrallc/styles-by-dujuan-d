param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference='Stop'
$root=(Resolve-Path -LiteralPath $ProjectRoot).Path
$paths=@('app\owner\owner-dashboard.tsx','app\owner\owner-action-dialog.tsx','lib\public-service-catalog.ts','app\services\page.tsx','app\page.tsx')
foreach($path in $paths){if(-not (Test-Path -LiteralPath (Join-Path $root $path))){throw "Missing $path"}}
$owner=[IO.File]::ReadAllText((Join-Path $root 'app\owner\owner-dashboard.tsx'))
$homePage=[IO.File]::ReadAllText((Join-Path $root 'app\page.tsx'))
$menu=[IO.File]::ReadAllText((Join-Path $root 'app\services\page.tsx'))
foreach($check in @(@($owner,'OwnerActionDialog'),@($owner,'Remove block'),@($homePage,'getPublicServices'),@($menu,'getPublicServices'))){if(-not $check[0].Contains($check[1])){throw "Missing marker $($check[1])"}}
Write-Host 'PASS: B4.2.2 files and UI markers present.' -ForegroundColor Green
Write-Host 'NEXT: run npx tsc --noEmit and npm run build in project root; then test visually.'
