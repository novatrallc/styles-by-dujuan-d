# Styles by Dujuan D — B4.2.2 Dynamic Catalog + Owner Operations Polish
# Run from this extracted package directory, with the Next.js server stopped.
# No migration, hosted Supabase change, payment flag or email flag is performed.
param([string]$ProjectRoot = 'C:\dev\projects\burtons-barbershop')
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Once([string]$Text,[string]$Needle,[string]$Name){
  $at=$Text.IndexOf($Needle,[StringComparison]::Ordinal)
  if($at -lt 0 -or $Text.IndexOf($Needle,$at+$Needle.Length,[StringComparison]::Ordinal) -ge 0){
    throw "Expected exactly one '$Name' in current source. Nothing installed. Please share the error."
  }
  return $at
}
function Replace-Once([string]$Text,[string]$Needle,[string]$Replacement,[string]$Name){
  $null=Require-Once $Text $Needle $Name
  return $Text.Replace($Needle,$Replacement)
}
function Read-Patch([string]$Name){
  $path=Join-Path $PSScriptRoot "patches\$Name"
  if(-not (Test-Path -LiteralPath $path -PathType Leaf)){throw "Missing patch file $Name"}
  return [IO.File]::ReadAllText($path).TrimEnd("`r`n".ToCharArray())
}
function Read-Required([string]$File,[string]$Label){
  if(-not (Test-Path -LiteralPath $File -PathType Leaf)){throw "Missing $Label at $File"}
  return [IO.File]::ReadAllText($File)
}

$root=(Resolve-Path -LiteralPath $ProjectRoot).Path
$owner=Join-Path $root 'app\owner\owner-dashboard.tsx'
$homePage=Join-Path $root 'app\page.tsx'
$services=Join-Path $root 'app\services\page.tsx'
$serviceDialog=Join-Path $root 'app\owner\service-action-dialog.tsx'
$ownerAction=Join-Path $root 'app\owner\owner-action-dialog.tsx'
$catalog=Join-Path $root 'lib\public-service-catalog.ts'
$ownerSource=Join-Path $PSScriptRoot 'app\owner\owner-action-dialog.tsx'
$catalogSource=Join-Path $PSScriptRoot 'lib\public-service-catalog.ts'
$servicesSource=Join-Path $PSScriptRoot 'app\services\page.tsx'
foreach($f in @($ownerSource,$catalogSource,$servicesSource,$serviceDialog)){if(-not (Test-Path -LiteralPath $f)){throw "Required file missing: $f"}}

$originalOwner=Read-Required $owner 'owner-dashboard.tsx'
$originalHome=Read-Required $homePage 'homepage'
$originalServices=Read-Required $services 'Services page'

# Reject actual partial code changes, but tolerate extracted package assets staged
# in the project tree when (and only when) their content matches the package.
$ownerInstalled=$originalOwner.Contains("import { OwnerActionDialog } from './owner-action-dialog';")
$homeInstalled=$originalHome.Contains('getPublicServices')
$servicesInstalled=$originalServices.Contains('getPublicServices')
if($ownerInstalled -and $homeInstalled -and $servicesInstalled -and
   (Test-Path -LiteralPath $ownerAction) -and (Test-Path -LiteralPath $catalog)){
  Write-Host 'PASS: B4.2.2 already installed. No files changed.' -ForegroundColor Green;exit 0
}
if($ownerInstalled -or $homeInstalled){
  throw 'Partial owner/home B4.2.2 code already installed. No files changed; share this message.'
}
foreach($pair in @(@($ownerAction,$ownerSource),@($catalog,$catalogSource))){
  if((Test-Path -LiteralPath $pair[0]) -and
     (Get-FileHash -LiteralPath $pair[0] -Algorithm SHA256).Hash -ne
     (Get-FileHash -LiteralPath $pair[1] -Algorithm SHA256).Hash){
    throw "Conflicting staged file: $($pair[0]). No files changed."
  }
}
if($servicesInstalled -and
   (Get-FileHash -LiteralPath $services -Algorithm SHA256).Hash -ne
   (Get-FileHash -LiteralPath $servicesSource -Algorithm SHA256).Hash){
  throw 'Existing Services page uses a different dynamic catalog implementation. No files changed.'
}
if(-not $originalOwner.Contains("import { ServiceActionDialog } from './service-action-dialog';")){
  throw 'B4.2.1a premium service dialog is not installed in the owner dashboard. Nothing changed.'
}
if(-not $originalServices.Contains('Every detail') -or -not $originalServices.Contains('Pricing coming soon')){
  throw 'Services page differs from the approved B4.1.x design. No files changed; send app/services/page.tsx for a custom patch.'
}
if(-not $originalHome.Contains('Pricing to be confirmed')){
  throw 'Homepage differs from the approved B4.1.8 design. No files changed; send app/page.tsx for a custom patch.'
}

# Normalize line endings for matching; restore them before saving.
$ownerNL=$originalOwner.Replace("`r`n","`n")
$homeNL=$originalHome.Replace("`r`n","`n")
$ownerNL=Replace-Once $ownerNL "import { ServiceActionDialog } from './service-action-dialog';" "import { ServiceActionDialog } from './service-action-dialog';`nimport { OwnerActionDialog } from './owner-action-dialog';" 'owner modal import'
$stateAnchor=Read-Patch 'owner-state-anchor.txt'
$stateNew=Read-Patch 'owner-state-new.txt'
$ownerNL=Replace-Once $ownerNL $stateAnchor "$stateAnchor`n$stateNew" 'owner modal state'

$startAnchor=' async function changeAppointment('
$endAnchor=' async function signOut('
$first=Require-Once $ownerNL $startAnchor 'appointment confirmation handler'
$last=Require-Once $ownerNL $endAnchor 'sign-out handler'
if($last -le $first -or ($last-$first) -gt 3000){throw 'Unexpected appointment handler structure. Nothing changed.'}
$replacement=Read-Patch 'owner-confirmation-functions.txt'
$ownerNL=$ownerNL.Substring(0,$first)+$replacement+"`n"+$ownerNL.Substring($last)

$oldTimeOff=Read-Patch 'owner-timeoff-remove-old.txt'
$newTimeOff=Read-Patch 'owner-timeoff-remove-new.txt'
$ownerNL=Replace-Once $ownerNL $oldTimeOff $newTimeOff 'time-off Remove button'
$oldList='{data.exceptions.map(x=>'
$newList=(Read-Patch 'owner-timeoff-empty.txt')+$oldList
$ownerNL=Replace-Once $ownerNL $oldList $newList 'time-off empty state'

$ownerNL=Replace-Once $ownerNL ' return <main' " const confirmationDetails=ownerConfirmationDetails();`n return <main" 'owner render statement'
$dialogPoint=' {authDialog&&'
$ownerNL=Replace-Once $ownerNL $dialogPoint " {ownerConfirmation&&confirmationDetails&&<OwnerActionDialog {...confirmationDetails} onCancel={()=>setOwnerConfirmation(null)} onConfirm={confirmedOwnerAction}/>} `n$dialogPoint" 'owner modal rendering'
if($ownerNL.Contains('window.confirm(')){throw 'An unexpected native confirmation remains. Nothing changed.'}

# Keep the entire existing visual home layout: swap only data source and price caption.
$homeNL=Replace-Once $homeNL 'import { services } from "@/lib/business";' 'import { getPublicServices, formatServicePrice } from "@/lib/public-service-catalog";' 'homepage curated-service import'
$homeNL=Replace-Once $homeNL 'export default function Home() {' "export const dynamic = 'force-dynamic';`nexport default async function Home() {`n  const { services, pricesEnabled } = await getPublicServices();" 'homepage Home function'
$homeNL=Replace-Once $homeNL 'Pricing to be confirmed' '{pricesEnabled ? formatServicePrice(s.priceCents) : "Pricing to be confirmed"}' 'homepage price placeholder'

if($originalOwner.Contains("`r`n")){$ownerNL=$ownerNL.Replace("`n","`r`n")}
if($originalHome.Contains("`r`n")){$homeNL=$homeNL.Replace("`n","`r`n")}

# All validations completed, and every new file exists in the extracted package.
$backup=Join-Path $root ('backups\b422-catalog-ops-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -Path $backup -ItemType Directory -Force | Out-Null
Copy-Item -LiteralPath $owner -Destination (Join-Path $backup 'owner-dashboard.tsx') -ErrorAction Stop
Copy-Item -LiteralPath $homePage -Destination (Join-Path $backup 'home-page.tsx') -ErrorAction Stop
Copy-Item -LiteralPath $services -Destination (Join-Path $backup 'services-page.tsx') -ErrorAction Stop
$created=@()
try{
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ownerAction) | Out-Null
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $catalog) | Out-Null
  if(-not (Test-Path -LiteralPath $ownerAction)){
    Copy-Item -LiteralPath $ownerSource -Destination $ownerAction -ErrorAction Stop; $created += $ownerAction
  }
  if(-not (Test-Path -LiteralPath $catalog)){
    Copy-Item -LiteralPath $catalogSource -Destination $catalog -ErrorAction Stop; $created += $catalog
  }
  [IO.File]::WriteAllText($owner,$ownerNL,[Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($homePage,$homeNL,[Text.UTF8Encoding]::new($false))
  if(-not $servicesInstalled){
    Copy-Item -LiteralPath $servicesSource -Destination $services -Force -ErrorAction Stop
  }
}catch{
  Copy-Item -LiteralPath (Join-Path $backup 'owner-dashboard.tsx') -Destination $owner -Force
  Copy-Item -LiteralPath (Join-Path $backup 'home-page.tsx') -Destination $homePage -Force
  Copy-Item -LiteralPath (Join-Path $backup 'services-page.tsx') -Destination $services -Force
  foreach($f in $created){if(Test-Path -LiteralPath $f){Remove-Item -LiteralPath $f -Force}}
  throw
}
Write-Host 'PASS: B4.2.2 installed — guarded service catalog + premium owner confirmations + Time Off empty state.' -ForegroundColor Green
Write-Host "Backups: $backup"
Write-Host 'Catalog publishing and price publishing both default to OFF. No database migrations or payment flags changed.'
Write-Host 'NEXT: npx tsc --noEmit; npm run build; npm run dev' -ForegroundColor Cyan
