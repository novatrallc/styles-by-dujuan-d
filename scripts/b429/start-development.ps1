[CmdletBinding()]
param()
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-ConfigSeparation
Assert-ClearForNext -Port 3001
Assert-LocalSafety
Set-Location (Get-DujuanRoot)
$env:DUJUAN_BUILD_TARGET = 'dev'
Write-Host 'Starting development website on http://localhost:3001 using .next-dev; keep this terminal open.' -ForegroundColor Cyan
Write-Warning 'Payment/booking origin stays localhost:3000. Development mode is for UI/code checks, not checkout testing.'
Invoke-CheckedNative 'npm.cmd' @('run','dev','--','--port','3001')
