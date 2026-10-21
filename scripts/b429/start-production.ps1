[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-ConfigSeparation
Assert-ClearForNext -Port 3000
Assert-LocalSafety
Assert-BuiltAssets -TargetDir '.next'
Set-Location (Get-DujuanRoot)
$env:DUJUAN_BUILD_TARGET = 'prod'
Write-Host 'Starting production website on http://localhost:3000; keep this terminal open.' -ForegroundColor Cyan
Invoke-CheckedNative 'npm.cmd' @('run','start')
