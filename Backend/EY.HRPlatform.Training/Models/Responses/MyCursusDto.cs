namespace EY.HRPlatform.Training.Models.Responses;

public class MyCursusDto
{
    public MyCursusSummaryDto Summary { get; set; } = new();
    public List<MyCursusItemDto> Items { get; set; } = [];
}

public class MyCursusSummaryDto
{
    public int TotalCount { get; set; }
    public int CompletedCount { get; set; }
    public int InProgressCount { get; set; }
    public int NotStartedCount { get; set; }
    public int RequiredCreditsTotal { get; set; }
    public int RequiredCreditsEarned { get; set; }
    public int EstimatedRemainingMinutes { get; set; }
}

public class MyCursusItemDto
{
    public Guid MappingId { get; set; }
    public Guid TrainingId { get; set; }
    public string TrainingTitle { get; set; } = string.Empty;
    public string? TrainingDescription { get; set; }
    public string TrainingType { get; set; } = string.Empty;
    public int Credits { get; set; }
    public string? Duration { get; set; }
    public string BadgeLevel { get; set; } = string.Empty;
    public DateTime? ScheduledDate { get; set; }
    public bool IsRequired { get; set; }
    public int OrderIndex { get; set; }
    public string Status { get; set; } = "not-started";
    public int ProgressPercentage { get; set; }
    public DateTime? LastActivityAt { get; set; }
    public bool IsFromSharedServiceLine { get; set; }
}
