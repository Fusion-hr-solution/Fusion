[CmdletBinding()]
param(
    [string]$ManifestPath,
    [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if ([string]::IsNullOrWhiteSpace($ManifestPath)) { $ManifestPath = Join-Path $root "Backend\EY.HRPlatform.DemoSeed\CanonicalDemoTenantManifest.json" }
if ([string]::IsNullOrWhiteSpace($OutputPath)) { $OutputPath = Join-Path $root "docs\demo-seed\canonical-tenant.md" }
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$platformPassword = $manifest.credentials.platformPassword
$tenantPassword = $manifest.credentials.tenantPassword
$personaRows = ($manifest.personas | ForEach-Object {
    $password = if ($_.passwordKind -eq "platform") { $platformPassword } else { $tenantPassword }
    "| $($_.name) | ``$($_.email)`` | ``$password`` |"
}) -join "`n"

$content = @"
# Canonical Fusion Demo Tenant

The repository uses one Development-only tenant as the shared CoreHR and Performance verification baseline.

## Tenant

- Display name: $($manifest.displayName)
- Tenant ID: ``$($manifest.tenantId)``
- Manifest version: ``$($manifest.manifestVersion)``
- Workforce: $($manifest.employeeCount) employees — $($manifest.activeEmployeeCount) active, $($manifest.endedEmployeeCount) ended/inactive
- Organization: $($manifest.departmentCount) departments, $($manifest.teamCount) teams
- Fixed scenario date: $($manifest.performance.asOfUtc)

## Credentials

These are development-only demo credentials and must never be reused outside local verification.

| Persona | Login | Password |
| --- | --- | --- |
$personaRows

## Commands

````powershell
.\scripts\fusion-demo.ps1 up
.\scripts\fusion-demo.ps1 up -Fresh
.\scripts\fusion-demo.ps1 verify
.\scripts\fusion-demo.ps1 down
````

The script reads local database connection strings and JWT secrets from ignored runtime configuration. ``up -Fresh`` is Development-only and resets the exact canonical tenant in reverse service dependency order.

## Surfaces

- Shell: http://localhost:3000
- CoreHR: http://localhost:3002
- Performance: http://localhost:3004
- Gateway: http://localhost:5000
- Identity: http://localhost:5101
- CoreHR API: http://localhost:5301
- Performance API: http://localhost:5401
"@

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
Set-Content -LiteralPath $OutputPath -Value $content.Trim() -Encoding UTF8
Write-Host "Generated $OutputPath from $ManifestPath" -ForegroundColor Green
