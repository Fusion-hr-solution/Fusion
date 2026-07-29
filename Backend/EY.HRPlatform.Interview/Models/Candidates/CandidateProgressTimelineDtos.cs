namespace EY.HRPlatform.Interview.Models.Candidates;

public class CandidateTimelineCandidateDto
{
    public string CandidateEmail { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
    public string LatestStatus { get; set; } = "Invited";
    public string? LatestActivityAtUtc { get; set; }
}

public class CandidateProgressTimelineDto
{
    public string TestId { get; set; } = string.Empty;
    public string TestTitle { get; set; } = string.Empty;
    public string CandidateEmail { get; set; } = string.Empty;
    public string? CandidateName { get; set; }
    public List<CandidateAttemptTimelineDto> Attempts { get; set; } = [];
}

public class CandidateAttemptTimelineDto
{
    public int AttemptNumber { get; set; }
    public string? AttemptId { get; set; }
    public string Status { get; set; } = "Invited";
    public string GradingStatus { get; set; } = "Pending";
    public decimal? TotalScore { get; set; }
    public decimal? MaxScore { get; set; }
    public List<CandidateTimelineMilestoneDto> Milestones { get; set; } = [];
    /// <summary>Aggregated proctoring summary for this attempt; null when proctoring was neither
    /// enabled nor produced any events (so the reviewer UI can omit the panel entirely).</summary>
    public CandidateAttemptProctoringSummaryDto? Proctoring { get; set; }
}

/// <summary>An aggregate roll-up of an attempt's proctoring signals — counts + severity + heartbeat
/// gap — deliberately NOT a raw event firehose.</summary>
public class CandidateAttemptProctoringSummaryDto
{
    /// <summary>Any proctoring layer was enabled on the test for this attempt.</summary>
    public bool Enabled { get; set; }
    public int TotalEvents { get; set; }
    /// <summary>Highest severity present across all events: none | low | medium | high.</summary>
    public string Severity { get; set; } = "none";
    public List<ProctoringTypeCountDto> CountsByType { get; set; } = [];
    public string? FirstEventAtUtc { get; set; }
    public string? LastEventAtUtc { get; set; }
    public string? LastHeartbeatAtUtc { get; set; }
    /// <summary>Seconds from the last heartbeat (or attempt start, if none) to the attempt end/now.</summary>
    public int? HeartbeatGapSeconds { get; set; }
    /// <summary>Proctoring was expected but the heartbeat is missing or stale beyond the threshold.</summary>
    public bool WentDark { get; set; }
}

public class ProctoringTypeCountDto
{
    public string Type { get; set; } = string.Empty;
    public int Count { get; set; }
    public string Severity { get; set; } = "low";
}

public class CandidateTimelineMilestoneDto
{
    public string Name { get; set; } = string.Empty;
    public string State { get; set; } = "Pending";
    public string? OccurredAtUtc { get; set; }
}
