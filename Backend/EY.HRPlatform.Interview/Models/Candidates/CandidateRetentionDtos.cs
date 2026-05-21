namespace EY.HRPlatform.Interview.Models.Candidates;

public class CandidateRetentionSettingsDto
{
    public bool Enabled { get; set; }
    public string RetentionAction { get; set; } = "Anonymize";
    public int RetentionPeriodDays { get; set; } = 90;
    public int ScanIntervalHours { get; set; } = 24;
    public string? LastRunAtUtc { get; set; }
}

public class UpdateCandidateRetentionSettingsDto
{
    public bool Enabled { get; set; }
    public string RetentionAction { get; set; } = "Anonymize";
    public int RetentionPeriodDays { get; set; }
    public int ScanIntervalHours { get; set; }
}

public class CandidateRetentionRunDto
{
    public string Id { get; set; } = string.Empty;
    public string TriggeredBy { get; set; } = string.Empty;
    public string TriggerSource { get; set; } = string.Empty;
    public string RetentionAction { get; set; } = string.Empty;
    public int RetentionPeriodDays { get; set; }
    public int CandidatesScanned { get; set; }
    public int CandidatesProcessed { get; set; }
    public int CandidatesAnonymized { get; set; }
    public int CandidatesDeleted { get; set; }
    public int CandidatesExpired { get; set; }
    public string StartedAtUtc { get; set; } = string.Empty;
    public string? CompletedAtUtc { get; set; }
}

public class CandidateRetentionStateDto
{
    public CandidateRetentionSettingsDto Settings { get; set; } = new();
    public int PendingCount { get; set; }
    public IReadOnlyList<CandidateRetentionRunDto> RecentRuns { get; set; } = [];
}

public class RunCandidateRetentionRequestDto
{
    public string TriggeredBy { get; set; } = string.Empty;
}
