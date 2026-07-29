[CmdletBinding()]
param(
    [string]$ManifestPath,
    [string]$RunbookPath
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($ManifestPath)) { $ManifestPath = Join-Path $root "Backend\EY.HRPlatform.DemoSeed\CanonicalDemoTenantManifest.json" }
if ([string]::IsNullOrWhiteSpace($RunbookPath)) { $RunbookPath = Join-Path $root "docs\demo-seed\canonical-tenant.md" }
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$runbook = Get-Content -LiteralPath $RunbookPath -Raw
$required = @(
    $manifest.displayName, $manifest.tenantId, $manifest.manifestVersion,
    "$($manifest.employeeCount) employees", "$($manifest.activeEmployeeCount) active",
    "$($manifest.endedEmployeeCount) ended/inactive", "$($manifest.departmentCount) departments",
    "$($manifest.teamCount) teams", $manifest.performance.asOfUtc,
    ".\scripts\fusion-demo.ps1 up -Fresh"
)
foreach ($value in $required) {
    if ($runbook -notlike "*$value*") { throw "Runbook drift: missing '$value'. Run scripts/generate-demo-runbook.ps1." }
}
foreach ($persona in $manifest.personas) {
    if ($runbook -notlike "*$($persona.email)*") { throw "Runbook drift: missing persona '$($persona.email)'." }
}
Write-Host "Canonical runbook is consistent with the manifest." -ForegroundColor Green
