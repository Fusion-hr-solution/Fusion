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
}

public class CandidateTimelineMilestoneDto
{
    public string Name { get; set; } = string.Empty;
    public string State { get; set; } = "Pending";
    public string? OccurredAtUtc { get; set; }
}
