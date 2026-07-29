[CmdletBinding()]
param(
    [ValidateSet("up", "verify", "down")]
    [string]$Command = "up",
    [switch]$Fresh
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$artifactRoot = Join-Path $root ".artifacts\demo-runtime"
$logRoot = Join-Path $artifactRoot "logs"
$pidFile = Join-Path $artifactRoot "pids.json"
$gatewayUrl = "http://localhost:5000"
$canonicalTenantId = "fa918a81-2147-45e0-934a-9eeec9a4ca14"
$performanceCampaignSlug = "atlas-progress-demo"
$owned = [System.Collections.Generic.List[object]]::new()

function Import-LocalEnvironment {
    $legacyLauncher = Join-Path $root ".local-docs\runtime-config\start-runtime.ps1"
    if (Test-Path $legacyLauncher) {
        foreach ($line in Get-Content $legacyLauncher) {
            if ($line -match '^\$env:(?<name>[A-Za-z0-9_]+)\s*=\s*"(?<value>.*)"\s*$') {
                [Environment]::SetEnvironmentVariable($Matches.name, $Matches.value, "Process")
            }
        }
    }

    $env:ASPNETCORE_ENVIRONMENT = "Development"
    $env:Database__AutoMigrate = "true"
    $env:Database__AutoSeed = "false"
    $env:Database__CanonicalSeed__Enabled = "true"
    $env:Database__CanonicalSeed__Reset = if ($Fresh) { "true" } else { "false" }
    $env:Database__DemoTenantId = $canonicalTenantId
    $env:DemoSeed__Canonical__Enabled = "true"
    $env:DemoSeed__Canonical__Reset = if ($Fresh) { "true" } else { "false" }
    $env:ServiceUrls__IdentityApiBaseUrl = "http://localhost:5101"
    $env:ServiceUrls__CoreApiBaseUrl = "http://localhost:5301"
    $env:DemoSeed__Canonical__TenantId = $canonicalTenantId

    foreach ($name in @("ConnectionStrings__IdentityDb", "ConnectionStrings__CoreHRDb", "ConnectionStrings__PerformanceDb", "Jwt__Secret")) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
            throw "Missing $name. Set it in local environment configuration before running fusion-demo.ps1."
        }
    }
}

function Test-Ready([string]$url) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    } catch {
        return $false
    }
}

function Wait-Ready([string]$name, [string]$url) {
    $deadline = (Get-Date).AddSeconds(300)
    while ((Get-Date) -lt $deadline) {
        if (Test-Ready $url) {
            Write-Host "$name ready: $url" -ForegroundColor Green
            return
        }
        Start-Sleep -Seconds 2
    }
    throw "$name did not become ready at $url"
}

function Assert-PortAvailable([string]$name, [string]$url) {
    $uri = [Uri]$url
    $listeners = Get-NetTCPConnection -LocalPort $uri.Port -State Listen -ErrorAction SilentlyContinue
    if ($listeners) {
        $owners = $listeners | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
            $process = Get-Process -Id $_ -ErrorAction SilentlyContinue
            if ($process) { "$($process.ProcessName) (PID $_)" } else { "PID $_" }
        }
        throw "$name cannot start because port $($uri.Port) is already owned by $($owners -join ', '). Stop that process explicitly or choose another local runtime configuration."
    }
}

function Start-FusionService([string]$name, [string]$project, [string]$url, [string]$healthPath) {
    if (Test-Ready "$url$healthPath") {
        Write-Host "$name already running: $url" -ForegroundColor DarkYellow
        return
    }

    Assert-PortAvailable $name $url

    $stdout = Join-Path $logRoot "$name.out.log"
    $stderr = Join-Path $logRoot "$name.err.log"
    $process = Start-Process -FilePath "dotnet" -ArgumentList @(
        "run", "--project", $project, "--no-launch-profile", "--no-restore", "--urls", $url
    ) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $owned.Add([pscustomobject]@{ Name = $name; ProcessId = $process.Id; Url = $url })
    Wait-Ready $name "$url$healthPath"
}

function Start-FusionFrontend([string]$name, [string]$filter, [string]$url) {
    if (Test-Ready $url) {
        Write-Host "$name already running: $url" -ForegroundColor DarkYellow
        return
    }

    Assert-PortAvailable $name $url
    $stdout = Join-Path $logRoot "$filter.out.log"
    $stderr = Join-Path $logRoot "$filter.err.log"
    $process = Start-Process -FilePath "pnpm" -ArgumentList @(
        "--dir", "Frontend", "--filter", $filter, "dev"
    ) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $owned.Add([pscustomobject]@{ Name = $name; ProcessId = $process.Id; Url = $url })
    Wait-Ready $name $url
}

function Save-OwnedProcesses {
    New-Item -ItemType Directory -Force -Path $artifactRoot, $logRoot | Out-Null
    $owned | ConvertTo-Json | Set-Content -Path $pidFile -Encoding UTF8
}

function Verify-Personas {
    $personas = @(
        @{ Email = "admin@ey-hr.com"; Password = "Admin@123456"; EmployeeId = $null },
        @{ Email = "atlas.hr@atlas.example"; Password = "Demo@123456"; EmployeeId = "required" },
        @{ Email = "atlas.orgadmin@atlas.example"; Password = "Demo@123456"; EmployeeId = "required" },
        @{ Email = "direction@atlas.example"; Password = "Demo@123456"; EmployeeId = "required" },
        @{ Email = "flit.manager@atlas.example"; Password = "Demo@123456"; EmployeeId = "20000000-0000-0000-0000-000000000001" },
        @{ Email = "nour.pending@atlas.example"; Password = "Demo@123456"; EmployeeId = "20000000-0000-0000-0000-000000000101" },
        @{ Email = "yassine.draft@atlas.example"; Password = "Demo@123456"; EmployeeId = "20000000-0000-0000-0000-000000000102" },
        @{ Email = "meriem.submitted@atlas.example"; Password = "Demo@123456"; EmployeeId = "20000000-0000-0000-0000-000000000103" },
        @{ Email = "oussama.review@atlas.example"; Password = "Demo@123456"; EmployeeId = "20000000-0000-0000-0000-000000000104" },
        @{ Email = "amel.finalized@atlas.example"; Password = "Demo@123456"; EmployeeId = "20000000-0000-0000-0000-000000000105" },
        @{ Email = "hatem.acknowledged@atlas.example"; Password = "Demo@123456"; EmployeeId = "20000000-0000-0000-0000-000000000106" },
        @{ Email = "empty.employee@atlas.example"; Password = "Demo@123456"; EmployeeId = "required" }
    )

    foreach ($persona in $personas) {
        $body = @{ email = $persona.Email; password = $persona.Password } | ConvertTo-Json
        try {
            $result = Invoke-RestMethod -Uri "$gatewayUrl/api/identity/auth/login" -Method Post -ContentType "application/json" -Body $body
            $data = $result.data
            if ($data.tenantId -ne $canonicalTenantId) { throw "tenant mismatch ($($data.tenantId))" }
            if ($persona.EmployeeId -eq "required" -and $null -eq $data.employeeId) { throw "missing employee link" }
            if ($persona.EmployeeId -and $persona.EmployeeId -ne "required" -and "$($data.employeeId)" -ne $persona.EmployeeId) { throw "employee mismatch ($($data.employeeId))" }
            Write-Host "verified $($persona.Email)" -ForegroundColor Green
        } catch {
            throw "Persona verification failed for $($persona.Email): $($_.Exception.Message)"
        }
    }

    $hrBody = @{ email = "atlas.hr@atlas.example"; password = "Demo@123456" } | ConvertTo-Json
    $hrLogin = Invoke-RestMethod -Uri "$gatewayUrl/api/identity/auth/login" -Method Post -ContentType "application/json" -Body $hrBody
    $headers = @{ Authorization = "Bearer $($hrLogin.data.accessToken)" }
    $workforce = Invoke-RestMethod -Uri "$gatewayUrl/api/corehr/employees?page=1&pageSize=1" -Headers $headers
    $totalCount = [int]$workforce.data.totalCount
    if ($totalCount -ne 320) { throw "Canonical workforce count mismatch ($totalCount; expected 320)." }
    Write-Host "verified CoreHR workforce count: $totalCount" -ForegroundColor Green

    $planningConfiguration = Invoke-RestMethod -Uri "$gatewayUrl/api/performance/objective-planning/configuration" -Headers $headers
    if (-not $planningConfiguration.data.isConfigured -or $null -eq $planningConfiguration.data.configuration) {
        throw "Canonical Performance objective planning configuration was not provisioned."
    }
    Write-Host "verified Performance objective planning configuration" -ForegroundColor Green

    $managerBody = @{ email = "flit.manager@atlas.example"; password = "Demo@123456" } | ConvertTo-Json
    $managerLogin = Invoke-RestMethod -Uri "$gatewayUrl/api/identity/auth/login" -Method Post -ContentType "application/json" -Body $managerBody
    $managerHeaders = @{ Authorization = "Bearer $($managerLogin.data.accessToken)" }
    $campaign = Invoke-RestMethod -Uri "$gatewayUrl/api/performance/team-progress/campaigns/$performanceCampaignSlug" -Headers $managerHeaders
    if ($null -eq $campaign.data) { throw "Canonical Performance campaign verification returned no data." }
    Write-Host "verified Performance campaign: $performanceCampaignSlug" -ForegroundColor Green

    $notifications = Invoke-RestMethod -Uri "$gatewayUrl/api/performance/notifications" -Headers $managerHeaders
    if ($null -eq $notifications.data) { throw "Canonical Performance notification verification returned no data." }
    Write-Host "verified Performance notifications" -ForegroundColor Green

    $access = Invoke-RestMethod -Uri "$gatewayUrl/api/identity/core-access/me" -Headers $managerHeaders
    if ($null -eq $access.data) { throw "Manager access profile/permission verification returned no data." }
    $workforceContext = Invoke-RestMethod -Uri "$gatewayUrl/api/corehr/workforce/me" -Headers $managerHeaders
    if ($null -eq $workforceContext.data) { throw "Manager workforce identity verification returned no data." }
    $downline = Invoke-RestMethod -Uri "$gatewayUrl/api/corehr/workforce/employees/20000000-0000-0000-0000-000000000001/downline" -Headers $managerHeaders
    if ($null -eq $downline.data) { throw "Manager downline scope verification returned no data." }
    Write-Host "verified manager access profile, permissions, and workforce context" -ForegroundColor Green

    $history = Invoke-RestMethod -Uri "$gatewayUrl/api/corehr/employees/import/history?page=1&pageSize=10" -Headers $headers
    if ($null -eq $history.data) { throw "CoreHR import history verification returned no data." }
    $approvals = Invoke-RestMethod -Uri "$gatewayUrl/api/performance/plan-approvals/my-campaigns" -Headers $managerHeaders
    if ($null -eq $approvals.data) { throw "Performance plan approval verification returned no data." }
    Write-Host "verified CoreHR import history and Performance planning data" -ForegroundColor Green
}

function Stop-OwnedProcesses {
    if (-not (Test-Path $pidFile)) { return }
    foreach ($entry in (Get-Content $pidFile -Raw | ConvertFrom-Json)) {
        $process = Get-Process -Id $entry.ProcessId -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $entry.ProcessId -Force
            Write-Host "stopped $($entry.Name) ($($entry.ProcessId))"
        }
    }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

switch ($Command) {
    "down" {
        Stop-OwnedProcesses
        break
    }
    "verify" {
        Import-LocalEnvironment
        Wait-Ready "Gateway" "$gatewayUrl/health"
        Verify-Personas
        Write-Host "Canonical tenant verification passed." -ForegroundColor Green
        break
    }
    "up" {
        Import-LocalEnvironment
        New-Item -ItemType Directory -Force -Path $artifactRoot, $logRoot | Out-Null
        Start-FusionService "Identity" "Backend/EY.HRPlatform.Identity/EY.HRPlatform.Identity.csproj" "http://localhost:5101" "/health"
        Start-FusionService "CoreHR" "Backend/EY.HRPlatform.CoreHR/EY.HRPlatform.CoreHR.csproj" "http://localhost:5301" "/health/ready"
        Start-FusionService "Performance" "Backend/EY.HRPlatform.Performance/EY.HRPlatform.Performance.csproj" "http://localhost:5401" "/health/ready"
        Start-FusionService "Gateway" "Backend/EY.HRPlatform.Gateway/EY.HRPlatform.Gateway.csproj" $gatewayUrl "/health"
        Start-FusionFrontend "Shell" "shell" "http://localhost:3000"
        Start-FusionFrontend "Core frontend" "core" "http://localhost:3002"
        Start-FusionFrontend "Performance frontend" "performance" "http://localhost:3004"
        Save-OwnedProcesses
        Verify-Personas
        Write-Host "Canonical tenant is ready for verification." -ForegroundColor Green
        break
    }
}
