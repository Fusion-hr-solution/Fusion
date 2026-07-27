[CmdletBinding()]
param([string]$GatewayUrl = "http://localhost:5000")

$ErrorActionPreference = "Stop"
$base = "$GatewayUrl/api/performance"

function Login([string]$email) {
    $body = @{ email = $email; password = "Demo@123456" } | ConvertTo-Json
    (Invoke-RestMethod -Uri "$GatewayUrl/api/identity/auth/login" -Method Post -ContentType "application/json" -Body $body).data.accessToken
}

function CallApi([string]$method, [string]$uri, [string]$token, [object]$body = $null, [int]$version = -1) {
    $headers = @{ Authorization = "Bearer $token" }
    if ($version -ge 0) { $headers["If-Match"] = "`"$version`"" }
    $params = @{ Uri = $uri; Method = $method; Headers = $headers }
    if ($null -ne $body) {
        $params.ContentType = "application/json"
        $params.Body = ($body | ConvertTo-Json -Depth 10)
    }
    Invoke-RestMethod @params
}

$hr = Login "atlas.hr@atlas.example"
$manager = Login "flit.manager@atlas.example"
$round = (CallApi "Get" "$base/evaluations" $hr).data | Where-Object name -eq "FY2026 Year-end evaluation"
$assignments = (CallApi "Get" "$base/evaluations/$($round.id)/assignments?page=1&pageSize=50" $hr).data.items
$personaByEmployee = @{
    "20000000-0000-0000-0000-000000000101" = "nour.pending@atlas.example"
    "20000000-0000-0000-0000-000000000102" = "yassine.draft@atlas.example"
    "20000000-0000-0000-0000-000000000103" = "meriem.submitted@atlas.example"
    "20000000-0000-0000-0000-000000000104" = "oussama.review@atlas.example"
    "20000000-0000-0000-0000-000000000105" = "amel.finalized@atlas.example"
    "20000000-0000-0000-0000-000000000106" = "hatem.acknowledged@atlas.example"
}
$tokens = @{}
foreach ($email in $personaByEmployee.Values) { $tokens[$email] = Login $email }

foreach ($assignment in $assignments | Where-Object kind -eq "SelfAssessment") {
    if ($assignment.status -in @("Finalized", "Submitted")) { continue }
    $token = $tokens[$personaByEmployee[$assignment.participantEmployeeId]]
    $workspace = (CallApi "Get" "$base/assessments/rounds/$($round.id)/self" $token).data
    $draft = @{
        objectiveRatings = @($workspace.objectives | ForEach-Object { @{ objectiveSnapshotId = $_.objectiveSnapshotId; ratingOrdinal = 4; comment = "Demonstrated delivery against the seeded objective." } })
        skillRatings = @($workspace.skills | ForEach-Object { @{ skillSnapshotItemId = $_.skillSnapshotItemId; proficiencyOrdinal = [Math]::Min(4, [int]$_.expectedLevelOrdinal + 1); comment = "Demonstrated capability in the seeded workflow." } })
        questionAnswers = @($workspace.questions | ForEach-Object { @{ questionSnapshotId = $_.questionSnapshotId; textAnswer = "Carry forward the demonstrated delivery practice."; ratingOrdinal = $null; isNotApplicable = $false; notApplicableReason = $null } })
    }
    $saved = CallApi "Post" "$base/assessments/assignments/$($assignment.id)/self/draft" $token $draft $workspace.version
    $version = [int](CallApi "Get" "$base/assessments/rounds/$($round.id)/self" $token).data.version
    CallApi "Post" "$base/assessments/assignments/$($assignment.id)/self/submit" $token $null $version | Out-Null
}

foreach ($assignment in $assignments | Where-Object kind -eq "ManagerAssessment") {
    $current = (CallApi "Get" "$base/assessments/rounds/$($round.id)/participants/$($assignment.participantEmployeeId)" $manager).data
    if ($assignment.status -eq "Finalized") { continue }
    if ($assignment.status -ne "Submitted") {
        $draft = @{
            objectiveRatings = @($current.objectives | ForEach-Object { @{ objectiveSnapshotId = $_.objectiveSnapshotId; ratingOrdinal = 4; comment = "Manager review confirms the seeded outcome." } })
            skillRatings = @($current.skills | ForEach-Object { @{ skillSnapshotItemId = $_.skillSnapshotItemId; proficiencyOrdinal = 4; comment = "Manager review confirms the seeded capability." } })
            questionAnswers = @($current.questions | ForEach-Object { @{ questionSnapshotId = $_.questionSnapshotId; textAnswer = "Discussed the outcome and next development step."; ratingOrdinal = $null; isNotApplicable = $false; notApplicableReason = $null } })
        }
        CallApi "Post" "$base/assessments/assignments/$($assignment.id)/manager/draft" $manager $draft ([int]$current.managerVersion) | Out-Null
        $version = [int](CallApi "Get" "$base/assessments/rounds/$($round.id)/participants/$($assignment.participantEmployeeId)" $manager).data.managerVersion
        CallApi "Post" "$base/assessments/assignments/$($assignment.id)/manager/submit" $manager $null $version | Out-Null
    }
    $finalVersion = [int](CallApi "Get" "$base/assessments/rounds/$($round.id)/participants/$($assignment.participantEmployeeId)" $manager).data.managerVersion
    $finalize = @{ overallObjectivesRatingOrdinal = 4; overallSkillsRatingOrdinal = 4; discussionSummary = "Seeded manager review completed for verification." }
    CallApi "Post" "$base/assessments/assignments/$($assignment.id)/finalize" $manager $finalize $finalVersion | Out-Null
}

$completion = (CallApi "Get" "$base/assessments/rounds/$($round.id)/completion" $hr).data
if ($completion.finalized -ne $completion.participantCount) { throw "Evaluation completion still has pending work." }
$cycle = (CallApi "Get" "$GatewayUrl/api/performance/cycles/$($round.campaignId)" $hr).data
$impact = (CallApi "Get" "$GatewayUrl/api/performance/cycles/$($round.campaignId)/closure-impact" $hr).data
Write-Output ("round=$($round.status) completion=" + ($completion | ConvertTo-Json -Compress))
Write-Output ("campaignBeforeClose=$($cycle.status) closureImpact=" + ($impact | ConvertTo-Json -Compress))
if ($cycle.status -ne "Closed") {
    CallApi "Post" "$GatewayUrl/api/performance/cycles/$($round.campaignId)/close" $hr @{ confirm = $true } ([int]$cycle.version) | Out-Null
}
$closed = (CallApi "Get" "$GatewayUrl/api/performance/cycles/$($round.campaignId)" $hr).data
Write-Output "campaignAfterClose=$($closed.status)"

try {
    CallApi "Post" "$base/evaluations/$($round.id)/launch" $hr $null ([int]$round.version) | Out-Null
    throw "Post-close launch unexpectedly succeeded."
} catch {
    if ($_.Exception.Message -notmatch "Closed|409") { throw }
    Write-Output "postCloseMutation=Rejected"
}
