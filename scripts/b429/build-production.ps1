[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-ConfigSeparation
Assert-ClearForNext -Port 3000
Assert-LocalSafety
Set-Location (Get-DujuanRoot)
$env:DUJUAN_BUILD_TARGET = 'prod'
Write-Host 'Checking TypeScript... (all Next.js servers must remain stopped)' -ForegroundColor Cyan
Invoke-CheckedNative 'npx.cmd' @('tsc','--noEmit')
Write-Host 'Creating production build...' -ForegroundColor Cyan
Invoke-CheckedNative 'npm.cmd' @('run','build')
Assert-BuiltAssets -TargetDir '.next'
Write-Host 'PRODUCTION BUILD PASSED. Start with start-production.ps1.' -ForegroundColor Green
