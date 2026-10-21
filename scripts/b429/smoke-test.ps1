[CmdletBinding()]
param([string]$BaseUrl = 'http://localhost:3000')
$ErrorActionPreference = 'Stop'
$base = [Uri]($BaseUrl.TrimEnd('/') + '/')
if ($base.Host -notin @('localhost','127.0.0.1')) { throw 'STOP: This smoke test is local-only.' }
if ($base.Scheme -ne 'http') { throw 'STOP: Expected http localhost URL.' }
$paths = @('/','/owner')
$cssRefs = @{}
$jsRefs = @{}
foreach ($route in $paths) {
  $url = [Uri]::new($base, $route)
  $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
  if ($resp.StatusCode -ne 200) { throw "FAIL: $route returned HTTP $($resp.StatusCode)" }
  Write-Host "PASS: $route returned HTTP 200" -ForegroundColor Green
  $html = [string]$resp.Content
  foreach ($hit in [regex]::Matches($html, '(?i)(?:href|src)=["'']([^"'']*/_next/static/[^"'']+?\.(?:css|js)(?:\?[^"'']*)?)["'']')) {
    $value = [System.Net.WebUtility]::HtmlDecode($hit.Groups[1].Value)
    if ($value -match '(?i)\.css(?:\?|$)') { $cssRefs[$value] = $true }
    if ($value -match '(?i)\.js(?:\?|$)') { $jsRefs[$value] = $true }
  }
}
if ($cssRefs.Count -eq 0 -or $jsRefs.Count -eq 0) {
  throw "FAIL: HTML references missing Next static assets: CSS=$($cssRefs.Count), JS=$($jsRefs.Count)."
}
foreach ($asset in (@($cssRefs.Keys | Select-Object -First 3) + @($jsRefs.Keys | Select-Object -First 3))) {
  $url = [Uri]::new($base, $asset)
  $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20
  if ($resp.StatusCode -ne 200 -or $resp.RawContentLength -le 0) { throw "FAIL: $url returned HTTP $($resp.StatusCode) or empty body." }
  Write-Host "PASS: $($url.AbsolutePath) HTTP 200 ($($resp.RawContentLength) bytes)" -ForegroundColor Green
}
Write-Host 'SMOKE TEST PASSED: Home, owner, and generated CSS/JS are reachable.' -ForegroundColor Green
