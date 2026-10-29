#requires -Version 7.0
<#
 Read-only SQL against a local Fusion database.
   pwsh -File <skill>/scripts/sql.ps1 -Database performance 'select count(*) from performance."PerformanceCycles"'
 Runs inside a READ ONLY transaction that is rolled back, so writes fail.
#>
param(
    [Parameter(Mandatory)][ValidateSet('identity', 'corehr', 'performance')][string]$Database,
    [Parameter(Mandatory, Position = 0)][string]$Query,
    [switch]$Csv
)

$ErrorActionPreference = 'Stop'
$psql = Get-ChildItem 'C:\Program Files\PostgreSQL' -Recurse -Filter psql.exe -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $psql) { throw 'psql.exe not found under C:\Program Files\PostgreSQL' }

if (-not $env:FUSION_PG_PASSWORD) { throw 'Set FUSION_PG_PASSWORD to the local postgres password.' }
$env:PGPASSWORD = $env:FUSION_PG_PASSWORD
$env:PGCLIENTENCODING = 'UTF8'
$sql = "BEGIN READ ONLY;`n$($Query.TrimEnd().TrimEnd(';'));`nROLLBACK;"
$fmt = if ($Csv) { @('--csv') } else { @() }
& $psql -U postgres -h localhost -d "hris_$Database" -v ON_ERROR_STOP=1 -q @fmt -c $sql
exit $LASTEXITCODE
