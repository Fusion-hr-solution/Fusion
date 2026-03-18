using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Interview.Tests.Domain.Entities;

public class InterviewTests : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Discipline { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string DifficultyLevel { get; set; } = "medium";
    public int EstimatedDurationMinutes { get; set; } = 60;
    public string? InternalNotes { get; set; }
    public string Status { get; set; } = "Draft"; // Draft, Published, Archived
    public bool IsActive { get; set; } = true;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public InterviewTestConfig? Config { get; set; }
    public List<InterviewTestQuestion> Questions { get; set; } = new();
}

public class InterviewTestsConfig
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TestId { get; set; }

    public bool TimeLimitEnabled { get; set; } = true;
    public int? TimeLimitMinutes { get; set; } = 60;
    public int MaxAttempts { get; set; } = 1;
    public bool RandomizeOrder { get; set; } = false;
    public string AccessType { get; set; } = "Public";
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime? LinkExpiry { get; set; }
    public int PassingThresholdPercent { get; set; } = 70;
    public bool AllowPartialCredit { get; set; } = true;
    public Guid? AssignedReviewerId { get; set; }

    public InterviewTest? Test { get; set; }
}

public class InterviewTestsQuestion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TestId { get; set; }
    public Guid QuestionId { get; set; }

    public int SortOrder { get; set; }
    public int? PointsOverride { get; set; }
    public int? DurationOverrideMinutes { get; set; }

    public InterviewTest? Test { get; set; }
}