$ErrorActionPreference = 'Stop'
$commands = @('typecheck', 'lint', 'test', 'build')
foreach ($name in $commands) {
  Write-Host "`n=== Running $name ===" -ForegroundColor Cyan
  & npm run $name
  if ($LASTEXITCODE -ne 0) { throw "Verification failed: $name" }
}
Write-Host "B1 verification passed" -ForegroundColor Green
