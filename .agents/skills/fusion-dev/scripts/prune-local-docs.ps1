#requires -Version 7.0
<#
 Keeps .local-docs/agents lean, driven by the board (BACKLOG.md):
   - Screens live only while their item is In progress or In review: after that, the images in
     plans/B-NNN-*screens*/ are deleted (HTML canvases and notes in them stay).
   - Plans of items no longer on the board move to archive/plans/.
   - data/: only the newest build folder per demo preset (demo-presets/.work/<preset>-<n>) is kept,
     and the importer's *.inspect.ndjson dumps are deleted.
   pwsh -File <skill>/scripts/prune-local-docs.ps1 [-DryRun]
 stack.ps1 runs it on every start; it is quiet when there is nothing to do.
 .local-docs/agents is tracked in git, except archive/, screen images and data's *.local.json and
 .work/: a plan it moves to archive/ shows as a deletion, to be committed with the next change.
#>
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$Repo = $PSScriptRoot
while ($Repo -and -not (Test-Path (Join-Path $Repo 'AGENTS.md'))) { $Repo = Split-Path -Parent $Repo }
$Agents = Join-Path $Repo '.local-docs/agents'
$Plans = Join-Path $Agents 'plans'
$Backlog = Join-Path $Agents 'BACKLOG.md'
if (-not (Test-Path $Plans) -or -not (Test-Path $Backlog)) { exit 0 }

# IDs on the board, and IDs in the In progress / In review lanes (children included).
$onBoard = [System.Collections.Generic.HashSet[string]]::new()
$reviewing = [System.Collections.Generic.HashSet[string]]::new()
$lane = ''
foreach ($line in Get-Content $Backlog) {
    if ($line -match '^## (.+)$') { $lane = $Matches[1].Trim(); continue }
    if ($line -match '^\s*- \[[ x]\] \*\*(B-\d+)\*\*') {
        [void]$onBoard.Add($Matches[1])
        if ($lane -in 'In progress', 'In review') { [void]$reviewing.Add($Matches[1]) }
    }
}
if ($onBoard.Count -eq 0) { Write-Host 'prune-local-docs: no items found on the board; nothing pruned.' -ForegroundColor Yellow; exit 0 }

$images = '*.png', '*.jpg', '*.jpeg', '*.webp', '*.gif'
$freed = 0L; $deleted = 0; $moved = @()
$verb = if ($DryRun) { 'would' } else { 'did' }

foreach ($entry in Get-ChildItem $Plans) {
    if ($entry.Name -notmatch '^(B-\d+)') { continue }
    $id = $Matches[1]

    if ($entry.PSIsContainer -and $entry.Name -match 'screens' -and -not $reviewing.Contains($id)) {
        foreach ($file in Get-ChildItem $entry.FullName -Recurse -File -Include $images) {
            $freed += $file.Length; $deleted++
            if (-not $DryRun) { Remove-Item $file.FullName -Force }
        }
        if (-not $DryRun -and -not (Get-ChildItem $entry.FullName -Recurse -File)) { Remove-Item $entry.FullName -Recurse -Force; continue }
    }

    if (-not $onBoard.Contains($id)) {
        $target = Join-Path $Agents "archive/plans/$($entry.Name)"
        if (Test-Path $target) { Write-Host "prune-local-docs: archive/plans/$($entry.Name) exists; left $($entry.Name) in plans/." -ForegroundColor Yellow; continue }
        $moved += $entry.Name
        if (-not $DryRun) {
            New-Item -ItemType Directory -Force (Split-Path $target) | Out-Null
            Move-Item $entry.FullName $target
        }
    }
}

# Demo-preset builds: keep the newest folder per preset; drop the importer's inspection dumps.
$data = Join-Path $Agents 'data'
$outputs = @()
$work = Join-Path $data 'demo-presets/.work'
if (Test-Path $work) {
    Get-ChildItem $work -Directory | Where-Object { $_.Name -match '^(.+)-(\d+)$' } |
        Group-Object { ($_.Name -split '-(?=\d+$)')[0] } |
        ForEach-Object { $_.Group | Sort-Object { [int]($_.Name -split '-')[-1] } -Descending | Select-Object -Skip 1 } |
        ForEach-Object { $outputs += $_ }
}
if (Test-Path $data) { $outputs += Get-ChildItem $data -Recurse -File -Filter '*.inspect.ndjson' | Where-Object { $outputs.FullName -notcontains $_.Directory.FullName } }
foreach ($item in $outputs) {
    $freed += ($item.PSIsContainer ? (Get-ChildItem $item.FullName -Recurse -File | Measure-Object Length -Sum).Sum : $item.Length)
    if (-not $DryRun) { Remove-Item $item.FullName -Recurse -Force }
}

if ($deleted -or $moved.Count -or $outputs.Count) {
    Write-Host ("prune-local-docs: {0} delete {1} screen image(s) and {2} old data output(s), {3:N1} MB in all; {0} archive {4} closed plan(s){5}" -f `
        $verb, $deleted, $outputs.Count, ($freed / 1MB), $moved.Count, $(if ($moved.Count) { ': ' + ($moved -join ', ') } else { '' }))
}
