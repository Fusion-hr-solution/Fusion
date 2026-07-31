namespace EY.HRPlatform.Interview.Models.Questions;

public class QuestionDto
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public string GradingMethod { get; set; } = string.Empty;
    public int Points { get; set; }
    public int DurationMinutes { get; set; }
    public List<string> Tags { get; set; } = [];
    public int UsageCount { get; set; }
    public List<QuestionOptionDto> Options { get; set; } = [];
    public string Language { get; set; } = string.Empty;
    public string StarterCode { get; set; } = string.Empty;
    public string? ProjectFiles { get; set; }
    /// <summary>Frontend Project questions: framework ("react" | "angular" | "next").</summary>
    public string? Framework { get; set; }
    /// <summary>Frontend Project questions: author grading tests (JSON). Author-facing DTO only —
    /// NOT the candidate DTO (candidates never receive this).</summary>
    public string? FrontendTestFiles { get; set; }
    public string EvaluationCriteria { get; set; } = string.Empty;
    public string? TestCases { get; set; }
}
