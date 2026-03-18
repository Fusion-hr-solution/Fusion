namespace EY.HRPlatform.Interview.Models;

public class CreateInterviewTestRequest
{
    public string Title { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Discipline { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string DifficultyLevel { get; set; } = "medium";
    public int EstimatedDurationMinutes { get; set; } = 60;
    public string? InternalNotes { get; set; }
}

public class UpdateInterviewTestRequest
{
    public string? Title { get; set; }
    public string? Role { get; set; }
    public string? Discipline { get; set; }
    public string? Description { get; set; }
    public string? DifficultyLevel { get; set; }
    public int? EstimatedDurationMinutes { get; set; }
    public string? InternalNotes { get; set; }
}

public class UpdateTestQuestionsRequest
{
    public List<TestQuestionDto> Questions { get; set; } = new();
}

public class TestQuestionDto
{
    public Guid QuestionId { get; set; }
    public int SortOrder { get; set; }
    public int? PointsOverride { get; set; }
    public int? DurationOverrideMinutes { get; set; }
}