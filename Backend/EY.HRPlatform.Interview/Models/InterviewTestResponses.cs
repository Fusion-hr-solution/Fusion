namespace EY.HRPlatform.Interview.Models;

public class InterviewTestDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Discipline { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string DifficultyLevel { get; set; } = string.Empty;
    public int EstimatedDurationMinutes { get; set; }
    public string? InternalNotes { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public InterviewTestConfigDto? Config { get; set; }
    public List<InterviewTestQuestionDto> Questions { get; set; } = new();
}

public class InterviewTestConfigDto
{
    public Guid Id { get; set; }
    public bool TimeLimitEnabled { get; set; }
    public int? TimeLimitMinutes { get; set; }
    public int MaxAttempts { get; set; }
    public bool RandomizeOrder { get; set; }
    public string AccessType { get; set; } = string.Empty;
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime? LinkExpiry { get; set; }
    public int PassingThresholdPercent { get; set; }
    public bool AllowPartialCredit { get; set; }
    public Guid? AssignedReviewerId { get; set; }
}

public class InterviewTestQuestionDto
{
    public Guid Id { get; set; }
    public Guid QuestionId { get; set; }
    public int SortOrder { get; set; }
    public int? PointsOverride { get; set; }
    public int? DurationOverrideMinutes { get; set; }
}