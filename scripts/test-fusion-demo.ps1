[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $PSScriptRoot "fusion-demo.ps1"
$content = Get-Content -LiteralPath $scriptPath -Raw

foreach ($required in @(
    '[ValidateSet("up", "verify", "down")]',
    '$env:Database__CanonicalSeed__Reset = if ($Fresh) { "true" } else { "false" }',
    'Start-FusionService "Performance"',
    'Start-FusionService "Gateway"',
    'Start-FusionFrontend "Shell"',
    'Assert-PortAvailable',
    'Verify-Personas',
    'Stop-OwnedProcesses')) {
    if ($content -notlike "*$required*") { throw "Orchestrator contract drift: missing '$required'." }
}

if ($content.IndexOf('Start-FusionService "Performance"') -gt $content.IndexOf('Start-FusionService "Gateway"')) {
    throw "Orchestrator contract drift: Gateway must start after Performance readiness."
}
if ($content.IndexOf('Start-FusionService "CoreHR"') -gt $content.IndexOf('Start-FusionService "Performance"')) {
    throw "Orchestrator contract drift: CoreHR must start before Performance."
}
if ($content -notmatch 'throw "\$name cannot start because port') {
    throw "Orchestrator contract drift: occupied ports must fail closed."
}

Write-Host "fusion-demo orchestrator contract checks passed." -ForegroundColor Green
