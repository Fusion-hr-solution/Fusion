#requires -Version 7.0
<#
 Refuses a heavy job up front when RAM is short, instead of letting it be killed halfway.
   pwsh -File <skill>/scripts/memory-check.ps1 [-NeedGB 2.5] [-Job "the pre-commit hook"]
 Exit 0 = enough available memory; exit 1 = not enough (prints the biggest processes).
 Called by test-backend.ps1, stack.ps1 and the local husky init (~/.config/husky/init.sh).
#>
param(
    [double]$NeedGB = 2.5,
    [string]$Job = 'this job'
)

# Available = free + standby pages Windows hands back on demand (what Task Manager calls Available).
$availableGB = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory).AvailableMBytes / 1024
if ($availableGB -ge $NeedGB) { exit 0 }

Write-Host ("Only {0:N1} GB of RAM available; {1} needs about {2:N1} GB and would likely be killed halfway." -f $availableGB, $Job, $NeedGB) -ForegroundColor Yellow
Write-Host 'Biggest users:' -ForegroundColor Yellow
Get-Process |
    Group-Object ProcessName |
    ForEach-Object { [pscustomobject]@{ Name = $_.Name; Count = $_.Count; GB = ($_.Group | Measure-Object WorkingSet64 -Sum).Sum / 1GB } } |
    Sort-Object GB -Descending |
    Select-Object -First 6 |
    ForEach-Object { Write-Host ("  {0,-28} x{1,-3} {2:N1} GB" -f $_.Name, $_.Count, $_.GB) }
Write-Host 'Free some memory (close apps, or stop the frontend: stack.ps1 -Down -Only Frontend) and run it again.' -ForegroundColor Yellow
exit 1
